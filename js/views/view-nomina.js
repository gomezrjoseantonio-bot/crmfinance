import { getPMA, savePMA, getAccounts, getTaxTables, saveTaxTables, getYear, setYear } from '../storage.js';
import { fmtEUR, calculateNetSalary } from '../utils.js';
import { generateForecast } from '../forecast-generator.js';

// Input validation helper
function validateInput(value, min = 0, max = Infinity, defaultValue = 0) {
  const num = parseFloat(value);
  if (isNaN(num) || num < min || num > max) return defaultValue;
  return Number(num.toFixed(2));
}

// Enhanced error handling and logging
function logCalculationError(context, error) {
  console.error(`Calculation error in ${context}:`, error);
  return 0;
}

// Comprehensive salary calculation function with improved precision
function calculateComprehensiveSalary(salaryConfig, taxTables, year) {
  try {
    const grossAnnual = validateInput(salaryConfig.grossAnnual, 0, 10000000, 0);
    const variablePercent = validateInput(salaryConfig.variablePercent, 0, 100, 0);
    const bonusPercent = validateInput(salaryConfig.bonusPercent, 0, 15, 0);
    
    const variableAnnual = grossAnnual * variablePercent / 100;
    const bonusAnnual = grossAnnual * bonusPercent / 100;
    const flexiplanAnnual = validateInput(salaryConfig.socialBenefits?.flexiplan?.amount, 0, 1000, 0) * 10; // 10 months
    
    const totalEconomic = grossAnnual + variableAnnual + bonusAnnual - flexiplanAnnual;
    
    // Calculate monthly base for SS calculation
    const monthlyGross = grossAnnual / 12;
    const ssBase = Math.min(monthlyGross, taxTables.ss.max);
    const ssContribution = Number((ssBase * taxTables.ss.rate * 12).toFixed(2));
    const unemploymentContribution = Number((ssBase * 0.0155 * 12).toFixed(2)); // 1.55%
    const trainingContribution = Number((ssBase * 0.001 * 12).toFixed(2)); // 0.10%
    
    // IRPF calculation on total taxable income
    const taxableAnnual = totalEconomic - ssContribution - unemploymentContribution - trainingContribution;
    let irpfContribution = 0;
    
    // Check if manual IRPF rate is specified
    const manualIrpfRate = validateInput(salaryConfig.manualIrpfRate, 0, 50, 0);
    if (manualIrpfRate > 0) {
      irpfContribution = Number((taxableAnnual * (manualIrpfRate / 100)).toFixed(2));
    } else {
      // Use progressive tax brackets
      for (const bracket of taxTables.irpf) {
        if (taxableAnnual > bracket.min) {
          const taxableInBracket = Math.min(taxableAnnual, bracket.max) - bracket.min;
          irpfContribution += taxableInBracket * bracket.rate;
        }
      }
      irpfContribution = Number(irpfContribution.toFixed(2));
    }
    
    const pensionPlanAnnual = validateInput(salaryConfig.pensionPlan, 0, 10000, 0) * 12;
    const solidarityAnnual = validateInput(salaryConfig.solidarityFee, 0, 1000, 0) * 12;
    
    const totalDeductions = ssContribution + unemploymentContribution + trainingContribution + irpfContribution + pensionPlanAnnual + solidarityAnnual;
    const netTotal = Number((totalEconomic - totalDeductions).toFixed(2));
    const netMonthly = Number((netTotal / 12).toFixed(2));
    
    return {
      grossAnnual,
      variableAnnual: Number(variableAnnual.toFixed(2)),
      bonusAnnual: Number(bonusAnnual.toFixed(2)),
      totalEconomic: Number(totalEconomic.toFixed(2)),
      ssBase: Number((ssBase * 12).toFixed(2)),
      ssContribution,
      unemploymentContribution,
      trainingContribution,
      irpfBase: Number(taxableAnnual.toFixed(2)),
      irpfContribution,
      irpfRate: taxableAnnual > 0 ? Number((irpfContribution / taxableAnnual).toFixed(4)) : 0,
      totalDeductions: Number(totalDeductions.toFixed(2)),
      netTotal,
      netMonthly
    };
  } catch (error) {
    return logCalculationError('calculateComprehensiveSalary', error);
  }
}

// Enhanced monthly breakdown calculation with better precision
function calculateMonthlyDetails(salaryConfig, salaryData, monthNum) {
  try {
    const monthlyBase = salaryConfig.grossAnnual / salaryConfig.numPayments;
    const taxTables = getTaxTables();
    
    const isExtraPayMonth = salaryConfig.extraPayMonths?.includes(monthNum);
    const isVariableMonth = salaryConfig.variableMonths?.includes(monthNum);
    const isBonusMonth = monthNum === salaryConfig.bonusMonth;
    const isFlexiplanMonth = ![7, 8].includes(monthNum);
    
    let salaryBase = monthlyBase;
    let variable = 0;
    let bonus = 0;
    let extraPay = 0;
    
    if (isExtraPayMonth && salaryConfig.numPayments === 14) {
      extraPay = monthlyBase;
    }
    
    if (isVariableMonth && salaryConfig.variablePercent > 0) {
      const monthKey = salaryConfig.variableMonths.indexOf(monthNum);
      const variablePercent = monthKey === 0 ? 
        validateInput(salaryConfig.variableDistribution?.month1, 0, 200, 40) : 
        validateInput(salaryConfig.variableDistribution?.month2, 0, 200, 60);
      variable = Number(((salaryConfig.grossAnnual * salaryConfig.variablePercent / 100) * (variablePercent / 100)).toFixed(2));
    }
    
    if (isBonusMonth && salaryConfig.bonusPercent > 0) {
      bonus = Number((salaryConfig.grossAnnual * salaryConfig.bonusPercent / 100).toFixed(2));
    }
    
    const monthlyGross = Number((salaryBase + variable + bonus + extraPay).toFixed(2));
    
    // Calculate proper monthly deductions based on actual monthly gross
    const flexiplanDeduction = isFlexiplanMonth ? validateInput(salaryConfig.socialBenefits?.flexiplan?.amount, 0, 1000, 0) : 0;
    const grossBeforeFlexiplan = Number((monthlyGross - flexiplanDeduction).toFixed(2));
    
    // Social Security contributions (capped at max base)
    const ssBaseMonthly = Math.min(grossBeforeFlexiplan, taxTables.ss.max);
    const ssContribution = Number((ssBaseMonthly * taxTables.ss.rate).toFixed(2));
    const unemploymentContribution = Number((ssBaseMonthly * 0.0155).toFixed(2)); // 1.55%
    const trainingContribution = Number((ssBaseMonthly * 0.001).toFixed(2)); // 0.10%
    
    // Calculate monthly taxable income
    const monthlyTaxableIncome = Number((grossBeforeFlexiplan - ssContribution - unemploymentContribution - trainingContribution).toFixed(2));
    
    // IRPF calculation for this month based on monthly income
    let irpfContribution = 0;
    const manualIrpfRate = validateInput(salaryConfig.manualIrpfRate, 0, 50, 0);
    if (manualIrpfRate > 0) {
      irpfContribution = Number((monthlyTaxableIncome * (manualIrpfRate / 100)).toFixed(2));
    } else {
      const effectiveIrpfRate = salaryData.irpfRate;
      irpfContribution = Number((monthlyTaxableIncome * effectiveIrpfRate).toFixed(2));
    }
    
    // Other deductions
    const solidarityFee = validateInput(salaryConfig.solidarityFee, 0, 1000, 0);
    const pensionPlan = validateInput(salaryConfig.pensionPlan, 0, 10000, 0);
    
    const monthlyDeductions = Number((ssContribution + unemploymentContribution + trainingContribution + 
                                     irpfContribution + solidarityFee + pensionPlan + flexiplanDeduction).toFixed(2));
    const monthlyNet = Number((monthlyGross - monthlyDeductions).toFixed(2));
    
    return {
      salaryBase: Number(salaryBase.toFixed(2)),
      variable,
      bonus,
      extraPay: Number(extraPay.toFixed(2)),
      monthlyGross,
      monthlyDeductions,
      monthlyNet,
      flexiplanDeduction
    };
  } catch (error) {
    return logCalculationError(`calculateMonthlyDetails for month ${monthNum}`, error);
  }
}

// Generate monthly breakdown table with enhanced calculations
function generateMonthlyBreakdown(salaryConfig, salaryData, year) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  return months.map((month, index) => {
    const monthNum = index + 1;
    const monthlyDetails = calculateMonthlyDetails(salaryConfig, salaryData, monthNum);
    
    return `
      <tr>
        <td><strong>${month}</strong></td>
        <td>${fmtEUR(monthlyDetails.salaryBase)}</td>
        <td>${fmtEUR(monthlyDetails.variable)}</td>
        <td>${fmtEUR(monthlyDetails.bonus)}</td>
        <td>${fmtEUR(monthlyDetails.extraPay)}</td>
        <td>${fmtEUR(monthlyDetails.monthlyDeductions)}</td>
        <td><strong>${fmtEUR(monthlyDetails.monthlyNet)}</strong></td>
      </tr>
    `;
  }).join('');
}

// Enhanced real-time update functions
function updateVariableCalculations(root, salaryConfig) {
  try {
    const variablePercent = parseFloat(root.querySelector('#variablePercent').value) || 0;
    const variableTotal = salaryConfig.grossAnnual * variablePercent / 100;
    root.querySelector('#variableTotalDisplay').textContent = fmtEUR(variableTotal);
    
    updateVariableDistribution(root);
  } catch (error) {
    logCalculationError('updateVariableCalculations', error);
  }
}

function updateVariableDistribution(root) {
  try {
    const percent1 = parseFloat(root.querySelector('#variablePercent1').value) || 0;
    const percent2 = parseFloat(root.querySelector('#variablePercent2').value) || 0;
    const total = percent1 + percent2;
    
    const totalDisplay = root.querySelector('#totalVariablePercent');
    totalDisplay.textContent = `Total: ${total.toFixed(1)}%`;
    
    // Add visual feedback for percentage total
    if (total < 90) {
      totalDisplay.style.color = 'var(--warning)';
      totalDisplay.title = 'Objetivos parcialmente alcanzados';
    } else if (total > 110) {
      totalDisplay.style.color = 'var(--success)';
      totalDisplay.title = 'Objetivos superados';
    } else {
      totalDisplay.style.color = 'var(--text)';
      totalDisplay.title = 'Objetivos alcanzados';
    }
  } catch (error) {
    logCalculationError('updateVariableDistribution', error);
  }
}

// Rest of the existing functions with minor improvements...
// (keeping the existing export functions, etc. for brevity)

// Generate forecast from nomina
function generateNominaForecast(salaryConfig, year) {
  try {
    const forecast = generateForecast(year, 1);
    console.log('Generated forecast with', forecast.length, 'movements for year:', year);
  } catch (err) {
    console.error('Error generating forecast:', err);
  }
}

// Export nómina calculation to Excel (keeping existing function)
function exportNominaToExcel(salaryConfig, salaryData, year) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  // Create CSV content that Excel can read
  const csvContent = [
    // Header information
    [`Cálculo de Nómina ${year}`],
    [],
    ['CONFIGURACIÓN DE NÓMINA'],
    ['Salario Bruto Anual', fmtEUR(salaryConfig.grossAnnual)],
    ['Número de Pagas', salaryConfig.numPayments],
    ['% Variable', `${salaryConfig.variablePercent}%`],
    ['Mes Variable 1', months[salaryConfig.variableMonths[0] - 1], `${salaryConfig.variableDistribution?.month1 || 40}%`],
    ['Mes Variable 2', months[salaryConfig.variableMonths[1] - 1], `${salaryConfig.variableDistribution?.month2 || 60}%`],
    ['% Bono Extra', `${salaryConfig.bonusPercent}%`],
    ['Mes Bono', months[salaryConfig.bonusMonth - 1]],
    [],
    ['CÁLCULOS ANUALES'],
    ['Total Salario Económico', fmtEUR(salaryData.totalEconomic)],
    ['Seguridad Social', fmtEUR(salaryData.ssContribution)],
    ['Desempleo', fmtEUR(salaryData.unemploymentContribution)],
    ['Formación', fmtEUR(salaryData.trainingContribution)],
    ['IRPF', fmtEUR(salaryData.irpfContribution)],
    ['Total Deducciones', fmtEUR(salaryData.totalDeductions)],
    ['Total a Percibir', fmtEUR(salaryData.netTotal)],
    ['Salario Mensual Promedio', fmtEUR(salaryData.netMonthly)]
  ];
  
  const csvText = csvContent.map(row => row.join(';')).join('\n');
  downloadFile(csvText, `nomina-calculo-${year}.csv`, 'text/csv');
  alert('✅ Cálculo de nómina exportado a Excel');
}

// Export monthly breakdown to Excel with enhanced data
function exportMonthlyBreakdownToExcel(salaryConfig, salaryData, year) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  // Create headers
  const csvContent = [
    [`Desglose Mensual de Nómina ${year}`],
    [],
    ['Mes', 'Salario Base', 'Variable', 'Bono', 'Paga Extra', 'Deducciones', 'Neto Total']
  ];
  
  // Add monthly data using enhanced calculation
  months.forEach((month, index) => {
    const monthNum = index + 1;
    const monthlyDetails = calculateMonthlyDetails(salaryConfig, salaryData, monthNum);
    
    csvContent.push([
      month,
      fmtEUR(monthlyDetails.salaryBase).replace('€', '').trim(),
      fmtEUR(monthlyDetails.variable).replace('€', '').trim(),
      fmtEUR(monthlyDetails.bonus).replace('€', '').trim(),
      fmtEUR(monthlyDetails.extraPay).replace('€', '').trim(),
      fmtEUR(monthlyDetails.monthlyDeductions).replace('€', '').trim(),
      fmtEUR(monthlyDetails.monthlyNet).replace('€', '').trim()
    ]);
  });
  
  const csvText = csvContent.map(row => row.join(';')).join('\n');
  downloadFile(csvText, `nomina-mensual-${year}.csv`, 'text/csv');
  alert('✅ Tabla mensual exportada a Excel');
}

// Helper function to download files
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

const view = {
  route: '#/nomina',
  title: 'Nómina',
  
  async mount(root) {
    const nomina = getPMA();
    const accounts = getAccounts();
    const taxTables = getTaxTables();
    const currentYear = getYear();
    
    // Initialize default nomina structure if empty
    if (!nomina.salary) {
      nomina.salary = {
        grossAnnual: 90646,
        numPayments: 14,
        extraPayMonths: [7, 12], // Julio y Diciembre
        variablePercent: 30,
        variableMonths: [7, 12], // Meses de pago variable
        variableDistribution: { month1: 40, month2: 60 }, // Distribución entre los meses seleccionados
        bonusPercent: 0,
        bonusMonth: 4, // Abril
        company: '',
        payDay: 25,
        accountId: accounts[0]?.id || 'SANTANDER',
        socialBenefits: {
          flexiplan: { amount: 15, excludeMonths: [7, 8] } // Julio y Agosto excluidos
        }
      };
    }
    
    // Ensure new fields exist for backwards compatibility
    if (!nomina.salary.numPayments) nomina.salary.numPayments = 14;
    if (!nomina.salary.variablePercent) nomina.salary.variablePercent = 0;
    if (!nomina.salary.variableMonths) nomina.salary.variableMonths = [7, 12];
    if (!nomina.salary.variableDistribution) nomina.salary.variableDistribution = { month1: 40, month2: 60 };
    if (!nomina.salary.bonusPercent) nomina.salary.bonusPercent = 0;
    if (!nomina.salary.bonusMonth) nomina.salary.bonusMonth = 4;
    if (!nomina.salary.company) nomina.salary.company = '';
    if (!nomina.salary.socialBenefits) nomina.salary.socialBenefits = {};
    if (!nomina.salary.manualIrpfRate) nomina.salary.manualIrpfRate = 0;
    
    if (!nomina.freelance) nomina.freelance = [];
    if (!nomina.company) nomina.company = [];
    if (!nomina.rentals) nomina.rentals = [];
    if (!nomina.loans) nomina.loans = [];
    if (!nomina.pensions) nomina.pensions = [];
    
    const accountOptions = accounts.map(a => `<option value="${a.id}" ${nomina.salary.accountId === a.id ? 'selected' : ''}>${a.name}</option>`).join('');
    
    // Calculate comprehensive salary data
    const salaryData = calculateComprehensiveSalary(nomina.salary, taxTables, currentYear);
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>📊 Nómina ${currentYear}</h1>
            <div class="small muted">Configuración completa de nómina con cálculos fiscales españoles mejorados</div>
            
            <div style="margin-top:15px">
              <label class="small muted">Año de cálculo</label><br/>
              <select id="yearSelect" style="width:120px">
                <option value="2024" ${currentYear === 2024 ? 'selected' : ''}>2024</option>
                <option value="2025" ${currentYear === 2025 ? 'selected' : ''}>2025</option>
                <option value="2026" ${currentYear === 2026 ? 'selected' : ''}>2026</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>🏢 Datos de la empresa</h2>
            <div class="row">
              <div class="col">
                <label class="small muted">Empresa</label><br/>
                <input type="text" id="company" value="${nomina.salary.company}" placeholder="Nombre de la empresa" style="width:280px" aria-label="Nombre de la empresa">
              </div>
            </div>
            <div class="small muted" style="margin-top:5px">Se buscará automáticamente el logotipo corporativo</div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>💰 Salario base</h2>
            <div class="row">
              <div class="col">
                <label class="small muted">Salario bruto anual (€)</label><br/>
                <input type="number" id="grossAnnual" value="${nomina.salary.grossAnnual}" style="width:140px" min="0" max="10000000" aria-label="Salario bruto anual">
              </div>
              <div class="col">
                <label class="small muted">Número de pagas</label><br/>
                <select id="numPayments" style="width:100px" aria-label="Número de pagas">
                  <option value="12" ${nomina.salary.numPayments === 12 ? 'selected' : ''}>12</option>
                  <option value="14" ${nomina.salary.numPayments === 14 ? 'selected' : ''}>14</option>
                </select>
              </div>
            </div>
            
            <div id="extraPaySection" style="margin-top:15px; ${nomina.salary.numPayments === 12 ? 'display:none' : ''}">
              <h3>Pagas extra</h3>
              <div class="row">
                <div class="col">
                  <label class="small muted">Mes paga extra 1</label><br/>
                  <select id="extraPay1" style="width:140px" aria-label="Mes paga extra 1">
                    ${Array.from({length: 12}, (_, i) => {
                      const month = i + 1;
                      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                      const selected = nomina.salary.extraPayMonths[0] === month ? 'selected' : '';
                      return `<option value="${month}" ${selected}>${monthNames[i]}</option>`;
                    }).join('')}
                  </select>
                </div>
                <div class="col">
                  <label class="small muted">Mes paga extra 2</label><br/>
                  <select id="extraPay2" style="width:140px" aria-label="Mes paga extra 2">
                    ${Array.from({length: 12}, (_, i) => {
                      const month = i + 1;
                      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                      const selected = nomina.salary.extraPayMonths[1] === month ? 'selected' : '';
                      return `<option value="${month}" ${selected}>${monthNames[i]}</option>`;
                    }).join('')}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="col">
          <div class="card">
            <h2>📈 Salario variable</h2>
            <div class="row">
              <div class="col">
                <label class="small muted">% Variable sobre salario bruto</label><br/>
                <input type="number" id="variablePercent" value="${nomina.salary.variablePercent}" min="0" max="100" style="width:80px" aria-label="Porcentaje variable">%
              </div>
            </div>
            <div class="small muted">Total salario variable: <strong id="variableTotalDisplay">${fmtEUR(nomina.salary.grossAnnual * nomina.salary.variablePercent / 100)}</strong></div>
            
            <div style="margin-top:15px">
              <h3>Distribución del variable</h3>
              <div class="row">
                <div class="col">
                  <label class="small muted">Mes pago variable 1</label><br/>
                  <select id="variableMonth1" style="width:140px" aria-label="Mes pago variable 1">
                    ${Array.from({length: 12}, (_, i) => {
                      const month = i + 1;
                      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                      const selected = nomina.salary.variableMonths[0] === month ? 'selected' : '';
                      return `<option value="${month}" ${selected}>${monthNames[i]}</option>`;
                    }).join('')}
                  </select>
                  <input type="number" id="variablePercent1" value="${nomina.salary.variableDistribution.month1 || 40}" min="0" max="200" style="width:60px; margin-left:10px" aria-label="Porcentaje mes 1">%
                </div>
                <div class="col">
                  <label class="small muted">Mes pago variable 2</label><br/>
                  <select id="variableMonth2" style="width:140px" aria-label="Mes pago variable 2">
                    ${Array.from({length: 12}, (_, i) => {
                      const month = i + 1;
                      const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                      const selected = nomina.salary.variableMonths[1] === month ? 'selected' : '';
                      return `<option value="${month}" ${selected}>${monthNames[i]}</option>`;
                    }).join('')}
                  </select>
                  <input type="number" id="variablePercent2" value="${nomina.salary.variableDistribution.month2 || 60}" min="0" max="200" style="width:60px; margin-left:10px" aria-label="Porcentaje mes 2">%
                </div>
              </div>
              <div class="small muted" style="margin-top:8px">
                Los porcentajes no necesariamente deben sumar 100%. Puede ser menos si no se alcanzan objetivos o más si se superan.
                <span id="totalVariablePercent" style="font-weight:bold">Total: ${(nomina.salary.variableDistribution.month1 || 40) + (nomina.salary.variableDistribution.month2 || 60)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>🎁 Bono extra</h2>
            <div class="row">
              <div class="col">
                <label class="small muted">% Bono extra (0-15%)</label><br/>
                <input type="number" id="bonusPercent" value="${nomina.salary.bonusPercent}" min="0" max="15" step="0.1" style="width:80px" aria-label="Porcentaje bono extra">%
              </div>
              <div class="col">
                <label class="small muted">Mes de pago</label><br/>
                <select id="bonusMonth" style="width:120px" aria-label="Mes de pago del bono">
                  ${Array.from({length: 12}, (_, i) => {
                    const month = i + 1;
                    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    const selected = nomina.salary.bonusMonth === month ? 'selected' : '';
                    return `<option value="${month}" ${selected}>${monthNames[i]}</option>`;
                  }).join('')}
                </select>
              </div>
            </div>
            <div class="small muted">Total bono extra: <strong id="bonusTotalDisplay">${fmtEUR(nomina.salary.grossAnnual * nomina.salary.bonusPercent / 100)}</strong></div>
          </div>
        </div>
        
        <div class="col">
          <div class="card">
            <h2>💼 Beneficios sociales</h2>
            <div class="row">
              <div class="col">
                <label class="small muted">Flexiplan mensual (€)</label><br/>
                <input type="number" id="flexiplan" value="${nomina.salary.socialBenefits.flexiplan?.amount || 15}" style="width:80px" min="0" max="1000" aria-label="Flexiplan mensual">
              </div>
            </div>
            <div class="small muted">Se descuenta todos los meses excepto Julio y Agosto</div>
            
            <div style="margin-top:15px">
              <h3>Total salario económico</h3>
              <div class="small"><strong>${fmtEUR(salaryData.totalEconomic)}</strong></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📋 Deducciones</h2>
            
            <div class="row">
              <div class="col">
                <h3>Seguridad Social</h3>
                <div class="small muted">Base: ${fmtEUR(salaryData.ssBase)} · Tipo: ${(taxTables.ss.rate * 100).toFixed(2)}%</div>
                <div><strong>${fmtEUR(salaryData.ssContribution)}</strong></div>
              </div>
              <div class="col">
                <h3>Desempleo</h3>
                <div class="small muted">1.55% sobre base</div>
                <div><strong>${fmtEUR(salaryData.unemploymentContribution)}</strong></div>
              </div>
            </div>
            
            <div class="row" style="margin-top:10px">
              <div class="col">
                <h3>Formación</h3>
                <div class="small muted">0.10% sobre base</div>
                <div><strong>${fmtEUR(salaryData.trainingContribution)}</strong></div>
              </div>
              <div class="col">
                <h3>Cuota Solidaridad</h3>
                <input type="number" id="solidarityFee" value="${nomina.salary.solidarityFee || 0}" step="0.01" style="width:100px" min="0" max="1000" aria-label="Cuota solidaridad">€
              </div>
            </div>
            
            <div style="margin-top:15px">
              <h3>IRPF</h3>
              <div class="row">
                <div class="col">
                  <label class="small muted">% IRPF manual (opcional)</label><br/>
                  <input type="number" id="manualIrpfRate" value="${nomina.salary.manualIrpfRate || ''}" min="0" max="50" step="0.01" style="width:80px" placeholder="Auto" aria-label="IRPF manual">%
                </div>
                <div class="col">
                  <div class="small muted">Base: ${fmtEUR(salaryData.irpfBase)} · Tipo efectivo: ${(salaryData.irpfRate * 100).toFixed(2)}%</div>
                  <div><strong>${fmtEUR(salaryData.irpfContribution)}</strong></div>
                </div>
              </div>
              <div class="small muted" style="margin-top:5px">Deja vacío para cálculo automático por tramos fiscales</div>
            </div>
            
            <div style="margin-top:15px">
              <h3>Plan de pensiones</h3>
              <input type="number" id="pensionPlan" value="${nomina.salary.pensionPlan || 0}" step="0.01" style="width:100px" min="0" max="10000" aria-label="Plan de pensiones">€/mes
            </div>
            
            <div style="margin-top:20px; padding:15px; background:var(--accent-bg); border-radius:8px">
              <h3>Total deducciones</h3>
              <div style="font-size:1.2em"><strong>${fmtEUR(salaryData.totalDeductions)}</strong></div>
            </div>
          </div>
        </div>
        
        <div class="col">
          <div class="card">
            <h2>💳 Configuración de pago</h2>
            <div class="row">
              <div class="col">
                <label class="small muted">Día de cobro</label><br/>
                <input type="number" id="payDay" value="${nomina.salary.payDay}" min="1" max="31" style="width:80px" aria-label="Día de cobro">
              </div>
              <div class="col">
                <label class="small muted">Cuenta destino</label><br/>
                <select id="accountId" style="width:180px" aria-label="Cuenta destino">${accountOptions}</select>
              </div>
            </div>
            
            <div style="margin-top:20px; padding:15px; background:var(--success-bg); border-radius:8px">
              <h3>💰 Total a percibir</h3>
              <div style="font-size:1.5em; color:var(--success)"><strong>${fmtEUR(salaryData.netTotal)}</strong></div>
              <div class="small muted">Mensual: <strong>${fmtEUR(salaryData.netMonthly)}</strong></div>
            </div>
            
            <button id="saveNomina" class="primary" style="margin-top:15px; width:100%">💾 Guardar nómina</button>
            <button id="generateForecast" class="secondary" style="margin-top:8px; width:100%">📊 Generar previsión de ingresos</button>
            <button id="exportNominaExcel" class="secondary" style="margin-top:8px; width:100%">📤 Exportar a Excel</button>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📊 Vista mensual detallada</h2>
            <div class="small muted">Previsión mensual optimizada con cálculos precisos. Para modificar, edita la configuración y reprocesa.</div>
            
            <div id="monthlyBreakdown" style="margin-top:15px">
              <table class="table">
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Salario base</th>
                    <th>Variable</th>
                    <th>Bono</th>
                    <th>Paga extra</th>
                    <th>Deducciones</th>
                    <th>Neto</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateMonthlyBreakdown(nomina.salary, salaryData, currentYear)}
                </tbody>
              </table>
            </div>
            
            <div style="margin-top:15px">
              <button id="exportMonthlyExcel" class="secondary" style="margin-right:10px">📤 Exportar tabla mensual a Excel</button>
              <button id="searchModifyNomina" class="secondary">🔍 Buscar y modificar nómina existente</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📊 Tablas fiscales editables</h2>
            <div class="small muted">Configuración actualizada de IRPF y Seguridad Social para ${currentYear}</div>
            
            <div class="row">
              <div class="col">
                <h3>IRPF</h3>
                <table class="table">
                  <thead>
                    <tr><th>Desde</th><th>Hasta</th><th>Tipo (%)</th></tr>
                  </thead>
                  <tbody>
                    ${taxTables.irpf.map((bracket, i) => `
                      <tr>
                        <td>${fmtEUR(bracket.min)}</td>
                        <td>${bracket.max === Infinity ? '∞' : fmtEUR(bracket.max)}</td>
                        <td>${(bracket.rate * 100).toFixed(1)}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              
              <div class="col">
                <h3>Seguridad Social</h3>
                <div>
                  <label class="small muted">Tipo general (%)</label><br/>
                  <input type="number" id="ssRate" value="${(taxTables.ss.rate * 100).toFixed(2)}" step="0.01" style="width:80px" min="0" max="50" aria-label="Tipo Seguridad Social">%
                </div>
                <div style="margin-top:10px">
                  <label class="small muted">Base máxima mensual (€)</label><br/>
                  <input type="number" id="ssMax" value="${taxTables.ss.max}" step="0.01" style="width:120px" min="0" max="20000" aria-label="Base máxima SS">
                </div>
                <div style="margin-top:10px">
                  <label class="small muted">Desempleo (%)</label><br/>
                  <input type="number" id="unemploymentRate" value="1.55" step="0.01" style="width:80px" min="0" max="10" aria-label="Tipo desempleo" readonly>%
                </div>
                <div style="margin-top:10px">
                  <label class="small muted">Formación (%)</label><br/>
                  <input type="number" id="trainingRate" value="0.10" step="0.01" style="width:80px" min="0" max="5" aria-label="Tipo formación" readonly>%
                </div>
                
                <button id="saveTaxes" class="primary" style="margin-top:15px">Guardar tablas</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Enhanced event handlers with error handling
    const safeEventHandler = (handler) => {
      return (e) => {
        try {
          handler(e);
        } catch (error) {
          console.error('Event handler error:', error);
          alert('Ha ocurrido un error. Por favor, revisa los datos introducidos.');
        }
      };
    };
    
    root.querySelector('#yearSelect').onchange = safeEventHandler((e) => {
      setYear(parseInt(e.target.value));
      view.mount(root); // Refresh with new year
    });
    
    root.querySelector('#numPayments').onchange = safeEventHandler((e) => {
      const extraSection = root.querySelector('#extraPaySection');
      if (e.target.value === '12') {
        extraSection.style.display = 'none';
      } else {
        extraSection.style.display = 'block';
      }
    });
    
    // Enhanced real-time updates
    root.querySelector('#grossAnnual').oninput = safeEventHandler(() => updateVariableCalculations(root, nomina.salary));
    root.querySelector('#variablePercent').oninput = safeEventHandler(() => updateVariableCalculations(root, nomina.salary));
    root.querySelector('#bonusPercent').oninput = safeEventHandler(() => {
      const bonusPercent = parseFloat(root.querySelector('#bonusPercent').value) || 0;
      const bonusTotal = nomina.salary.grossAnnual * bonusPercent / 100;
      root.querySelector('#bonusTotalDisplay').textContent = fmtEUR(bonusTotal);
    });
    
    root.querySelector('#saveNomina').onclick = safeEventHandler(() => {
      // Enhanced input validation
      nomina.salary.company = root.querySelector('#company').value.trim();
      nomina.salary.grossAnnual = validateInput(root.querySelector('#grossAnnual').value, 0, 10000000, 0);
      nomina.salary.numPayments = parseInt(root.querySelector('#numPayments').value) || 14;
      nomina.salary.variablePercent = validateInput(root.querySelector('#variablePercent').value, 0, 100, 0);
      nomina.salary.bonusPercent = validateInput(root.querySelector('#bonusPercent').value, 0, 15, 0);
      nomina.salary.bonusMonth = parseInt(root.querySelector('#bonusMonth').value) || 4;
      nomina.salary.payDay = validateInput(root.querySelector('#payDay').value, 1, 31, 25);
      nomina.salary.accountId = root.querySelector('#accountId').value;
      nomina.salary.solidarityFee = validateInput(root.querySelector('#solidarityFee').value, 0, 1000, 0);
      nomina.salary.pensionPlan = validateInput(root.querySelector('#pensionPlan').value, 0, 10000, 0);
      nomina.salary.manualIrpfRate = validateInput(root.querySelector('#manualIrpfRate').value, 0, 50, 0);
      
      if (nomina.salary.numPayments === 14) {
        nomina.salary.extraPayMonths = [
          parseInt(root.querySelector('#extraPay1').value),
          parseInt(root.querySelector('#extraPay2').value)
        ];
      } else {
        nomina.salary.extraPayMonths = [];
      }
      
      nomina.salary.variableMonths = [
        parseInt(root.querySelector('#variableMonth1').value),
        parseInt(root.querySelector('#variableMonth2').value)
      ];
      
      nomina.salary.variableDistribution = {
        month1: validateInput(root.querySelector('#variablePercent1').value, 0, 200, 40),
        month2: validateInput(root.querySelector('#variablePercent2').value, 0, 200, 60)
      };
      
      nomina.salary.socialBenefits.flexiplan = {
        amount: validateInput(root.querySelector('#flexiplan').value, 0, 1000, 15),
        excludeMonths: [7, 8]
      };
      
      savePMA(nomina, currentYear);
      alert('✅ Nómina guardada correctamente con validación mejorada');
      view.mount(root); // Refresh to show updated calculations
    });
    
    root.querySelector('#generateForecast').onclick = safeEventHandler(() => {
      generateNominaForecast(nomina.salary, currentYear);
      alert('📊 Previsión de ingresos generada y volcada al presupuesto');
    });
    
    root.querySelector('#saveTaxes').onclick = safeEventHandler(() => {
      const updatedTaxTables = getTaxTables();
      updatedTaxTables.ss.rate = validateInput(root.querySelector('#ssRate').value, 0, 50, 6.35) / 100;
      updatedTaxTables.ss.max = validateInput(root.querySelector('#ssMax').value, 0, 20000, 4495.50);
      
      saveTaxTables(updatedTaxTables);
      alert('📋 Tablas fiscales guardadas correctamente');
      view.mount(root); // Refresh to show updated calculations
    });
    
    // Export handlers
    root.querySelector('#exportNominaExcel').onclick = safeEventHandler(() => {
      exportNominaToExcel(nomina.salary, salaryData, currentYear);
    });
    
    root.querySelector('#exportMonthlyExcel').onclick = safeEventHandler(() => {
      exportMonthlyBreakdownToExcel(nomina.salary, salaryData, currentYear);
    });
    
    root.querySelector('#searchModifyNomina').onclick = safeEventHandler(() => {
      const year = prompt('Introduce el año de la nómina a buscar/modificar:', currentYear);
      if (year && parseInt(year) !== currentYear) {
        setYear(parseInt(year));
        view.mount(root);
      }
    });
    
    // Enhanced real-time updates for variable distribution
    root.querySelector('#variablePercent1').oninput = safeEventHandler(() => updateVariableDistribution(root));
    root.querySelector('#variablePercent2').oninput = safeEventHandler(() => updateVariableDistribution(root));
    
    // Initialize real-time displays
    updateVariableCalculations(root, nomina.salary);
  }
};

export default view;