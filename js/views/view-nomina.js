import { getPMA, savePMA, getAccounts, getTaxTables, saveTaxTables, getYear, setYear } from '../storage.js';
import { fmtEUR, calculateNetSalary } from '../utils.js';

// Comprehensive salary calculation function
function calculateComprehensiveSalary(salaryConfig, taxTables, year) {
  const grossAnnual = salaryConfig.grossAnnual || 0;
  const variableAnnual = grossAnnual * (salaryConfig.variablePercent || 0) / 100;
  const bonusAnnual = grossAnnual * (salaryConfig.bonusPercent || 0) / 100;
  const flexiplanAnnual = (salaryConfig.socialBenefits?.flexiplan?.amount || 0) * 10; // 10 months (excluding July & August)
  
  const totalEconomic = grossAnnual + variableAnnual + bonusAnnual - flexiplanAnnual;
  
  // Calculate monthly base for SS calculation
  const monthlyGross = grossAnnual / 12;
  const ssBase = Math.min(monthlyGross, taxTables.ss.max);
  const ssContribution = ssBase * taxTables.ss.rate * 12;
  const unemploymentContribution = ssBase * 0.0155 * 12; // 1.55%
  const trainingContribution = ssBase * 0.001 * 12; // 0.10%
  
  // IRPF calculation on total taxable income
  const taxableAnnual = totalEconomic - ssContribution - unemploymentContribution - trainingContribution;
  let irpfContribution = 0;
  let accumulatedTax = 0;
  
  for (const bracket of taxTables.irpf) {
    if (taxableAnnual > bracket.min) {
      const taxableInBracket = Math.min(taxableAnnual, bracket.max) - bracket.min;
      irpfContribution += taxableInBracket * bracket.rate;
    }
  }
  
  const pensionPlanAnnual = (salaryConfig.pensionPlan || 0) * 12;
  const solidarityAnnual = (salaryConfig.solidarityFee || 0) * 12;
  
  const totalDeductions = ssContribution + unemploymentContribution + trainingContribution + irpfContribution + pensionPlanAnnual + solidarityAnnual;
  const netTotal = totalEconomic - totalDeductions;
  const netMonthly = netTotal / 12;
  
  return {
    grossAnnual,
    variableAnnual,
    bonusAnnual,
    totalEconomic,
    ssBase: ssBase * 12,
    ssContribution,
    unemploymentContribution,
    trainingContribution,
    irpfBase: taxableAnnual,
    irpfContribution,
    irpfRate: irpfContribution / taxableAnnual,
    totalDeductions,
    netTotal,
    netMonthly
  };
}

// Generate monthly breakdown table
function generateMonthlyBreakdown(salaryConfig, salaryData, year) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  const monthlyBase = salaryConfig.grossAnnual / 12;
  const monthlyDeductions = salaryData.totalDeductions / 12;
  
  return months.map((month, index) => {
    const monthNum = index + 1;
    const isExtraPayMonth = salaryConfig.extraPayMonths?.includes(monthNum);
    const isVariableMonth = monthNum === 7 || monthNum === 12;
    const isBonusMonth = monthNum === salaryConfig.bonusMonth;
    
    let salaryBase = monthlyBase;
    let variable = 0;
    let bonus = 0;
    let extraPay = 0;
    
    if (isExtraPayMonth && salaryConfig.numPayments === 14) {
      extraPay = monthlyBase;
    }
    
    if (isVariableMonth && salaryConfig.variablePercent > 0) {
      const variablePercent = salaryConfig.variableDistribution[monthNum] || 0;
      variable = (salaryConfig.grossAnnual * salaryConfig.variablePercent / 100) * (variablePercent / 100);
    }
    
    if (isBonusMonth && salaryConfig.bonusPercent > 0) {
      bonus = salaryConfig.grossAnnual * salaryConfig.bonusPercent / 100;
    }
    
    const monthlyGross = salaryBase + variable + bonus + extraPay;
    const monthlyNet = monthlyGross - monthlyDeductions;
    
    return `
      <tr>
        <td><strong>${month}</strong></td>
        <td>${fmtEUR(salaryBase)}</td>
        <td>${fmtEUR(variable)}</td>
        <td>${fmtEUR(bonus)}</td>
        <td>${fmtEUR(extraPay)}</td>
        <td>${fmtEUR(monthlyDeductions)}</td>
        <td><strong>${fmtEUR(monthlyNet)}</strong></td>
        <td><input type="number" class="monthly-adjustment" data-month="${monthNum}" value="0" style="width:80px" step="0.01"></td>
      </tr>
    `;
  }).join('');
}

// Generate forecast from nomina
function generateNominaForecast(salaryConfig, year) {
  // This will integrate with the existing forecast system
  // Implementation will be done in the forecast-generator.js
  console.log('Generating nomina forecast for year:', year, salaryConfig);
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
        variableDistribution: { 7: 40, 12: 60 }, // Julio 40%, Diciembre 60%
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
    if (!nomina.salary.variableDistribution) nomina.salary.variableDistribution = {};
    if (!nomina.salary.bonusPercent) nomina.salary.bonusPercent = 0;
    if (!nomina.salary.bonusMonth) nomina.salary.bonusMonth = 4;
    if (!nomina.salary.company) nomina.salary.company = '';
    if (!nomina.salary.socialBenefits) nomina.salary.socialBenefits = {};
    
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
            <div class="small muted">Configuración completa de nómina con cálculos fiscales españoles</div>
            
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
                <input type="text" id="company" value="${nomina.salary.company}" placeholder="Nombre de la empresa" style="width:280px">
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
                <input type="number" id="grossAnnual" value="${nomina.salary.grossAnnual}" style="width:140px">
              </div>
              <div class="col">
                <label class="small muted">Número de pagas</label><br/>
                <select id="numPayments" style="width:100px">
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
                  <select id="extraPay1" style="width:140px">
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
                  <select id="extraPay2" style="width:140px">
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
                <input type="number" id="variablePercent" value="${nomina.salary.variablePercent}" min="0" max="100" style="width:80px">%
              </div>
            </div>
            <div class="small muted">Total salario variable: <strong>${fmtEUR(nomina.salary.grossAnnual * nomina.salary.variablePercent / 100)}</strong></div>
            
            <div style="margin-top:15px">
              <h3>Distribución del variable</h3>
              <div class="row">
                <div class="col">
                  <label class="small muted">Mes pago variable 1 (Julio)</label><br/>
                  <input type="number" id="variableJulio" value="${nomina.salary.variableDistribution[7] || 40}" min="0" max="100" style="width:60px">%
                </div>
                <div class="col">
                  <label class="small muted">Mes pago variable 2 (Diciembre)</label><br/>
                  <input type="number" id="variableDiciembre" value="${nomina.salary.variableDistribution[12] || 60}" min="0" max="100" style="width:60px">%
                </div>
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
                <input type="number" id="bonusPercent" value="${nomina.salary.bonusPercent}" min="0" max="15" step="0.1" style="width:80px">%
              </div>
              <div class="col">
                <label class="small muted">Mes de pago</label><br/>
                <select id="bonusMonth" style="width:120px">
                  ${Array.from({length: 12}, (_, i) => {
                    const month = i + 1;
                    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                    const selected = nomina.salary.bonusMonth === month ? 'selected' : '';
                    return `<option value="${month}" ${selected}>${monthNames[i]}</option>`;
                  }).join('')}
                </select>
              </div>
            </div>
            <div class="small muted">Total bono extra: <strong>${fmtEUR(nomina.salary.grossAnnual * nomina.salary.bonusPercent / 100)}</strong></div>
          </div>
        </div>
        
        <div class="col">
          <div class="card">
            <h2>💼 Beneficios sociales</h2>
            <div class="row">
              <div class="col">
                <label class="small muted">Flexiplan mensual (€)</label><br/>
                <input type="number" id="flexiplan" value="${nomina.salary.socialBenefits.flexiplan?.amount || 15}" style="width:80px">
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
                <input type="number" id="solidarityFee" value="${nomina.salary.solidarityFee || 0}" step="0.01" style="width:100px">€
              </div>
            </div>
            
            <div style="margin-top:15px">
              <h3>IRPF</h3>
              <div class="small muted">Base: ${fmtEUR(salaryData.irpfBase)} · Tipo efectivo: ${(salaryData.irpfRate * 100).toFixed(2)}%</div>
              <div><strong>${fmtEUR(salaryData.irpfContribution)}</strong></div>
            </div>
            
            <div style="margin-top:15px">
              <h3>Plan de pensiones</h3>
              <input type="number" id="pensionPlan" value="${nomina.salary.pensionPlan || 0}" step="0.01" style="width:100px">€/mes
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
                <input type="number" id="payDay" value="${nomina.salary.payDay}" min="1" max="31" style="width:80px">
              </div>
              <div class="col">
                <label class="small muted">Cuenta destino</label><br/>
                <select id="accountId" style="width:180px">${accountOptions}</select>
              </div>
            </div>
            
            <div style="margin-top:20px; padding:15px; background:var(--success-bg); border-radius:8px">
              <h3>💰 Total a percibir</h3>
              <div style="font-size:1.5em; color:var(--success)"><strong>${fmtEUR(salaryData.netTotal)}</strong></div>
              <div class="small muted">Mensual: <strong>${fmtEUR(salaryData.netMonthly)}</strong></div>
            </div>
            
            <button id="saveNomina" class="primary" style="margin-top:15px; width:100%">💾 Guardar nómina</button>
            <button id="generateForecast" class="secondary" style="margin-top:8px; width:100%">📊 Generar previsión de ingresos</button>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📊 Vista mensual detallada</h2>
            <div class="small muted">Previsión mensual con posibilidad de ajustes manuales</div>
            
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
                    <th>Ajuste manual</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateMonthlyBreakdown(nomina.salary, salaryData, currentYear)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📊 Tablas fiscales editables</h2>
            <div class="small muted">Configuración de IRPF y Seguridad Social para ${currentYear}</div>
            
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
                  <input type="number" id="ssRate" value="${(taxTables.ss.rate * 100).toFixed(2)}" step="0.01" style="width:80px">%
                </div>
                <div style="margin-top:10px">
                  <label class="small muted">Base máxima mensual (€)</label><br/>
                  <input type="number" id="ssMax" value="${taxTables.ss.max}" step="0.01" style="width:120px">
                </div>
                <div style="margin-top:10px">
                  <label class="small muted">Desempleo (%)</label><br/>
                  <input type="number" id="unemploymentRate" value="1.55" step="0.01" style="width:80px">%
                </div>
                <div style="margin-top:10px">
                  <label class="small muted">Formación (%)</label><br/>
                  <input type="number" id="trainingRate" value="0.10" step="0.01" style="width:80px">%
                </div>
                
                <button id="saveTaxes" class="primary" style="margin-top:15px">Guardar tablas</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Event handlers
    root.querySelector('#yearSelect').onchange = (e) => {
      setYear(parseInt(e.target.value));
      view.mount(root); // Refresh with new year
    };
    
    root.querySelector('#numPayments').onchange = (e) => {
      const extraSection = root.querySelector('#extraPaySection');
      if (e.target.value === '12') {
        extraSection.style.display = 'none';
      } else {
        extraSection.style.display = 'block';
      }
    };
    
    root.querySelector('#saveNomina').onclick = () => {
      nomina.salary.company = root.querySelector('#company').value;
      nomina.salary.grossAnnual = parseFloat(root.querySelector('#grossAnnual').value) || 0;
      nomina.salary.numPayments = parseInt(root.querySelector('#numPayments').value) || 14;
      nomina.salary.variablePercent = parseFloat(root.querySelector('#variablePercent').value) || 0;
      nomina.salary.bonusPercent = parseFloat(root.querySelector('#bonusPercent').value) || 0;
      nomina.salary.bonusMonth = parseInt(root.querySelector('#bonusMonth').value) || 4;
      nomina.salary.payDay = parseInt(root.querySelector('#payDay').value) || 25;
      nomina.salary.accountId = root.querySelector('#accountId').value;
      nomina.salary.solidarityFee = parseFloat(root.querySelector('#solidarityFee').value) || 0;
      nomina.salary.pensionPlan = parseFloat(root.querySelector('#pensionPlan').value) || 0;
      
      if (nomina.salary.numPayments === 14) {
        nomina.salary.extraPayMonths = [
          parseInt(root.querySelector('#extraPay1').value),
          parseInt(root.querySelector('#extraPay2').value)
        ];
      } else {
        nomina.salary.extraPayMonths = [];
      }
      
      nomina.salary.variableDistribution = {
        7: parseFloat(root.querySelector('#variableJulio').value) || 40,
        12: parseFloat(root.querySelector('#variableDiciembre').value) || 60
      };
      
      nomina.salary.socialBenefits.flexiplan = {
        amount: parseFloat(root.querySelector('#flexiplan').value) || 15,
        excludeMonths: [7, 8]
      };
      
      savePMA(nomina, currentYear);
      alert('✅ Nómina guardada correctamente');
      view.mount(root); // Refresh to show updated calculations
    };
    
    root.querySelector('#generateForecast').onclick = () => {
      // Generate forecast from nomina data
      generateNominaForecast(nomina.salary, currentYear);
      alert('📊 Previsión de ingresos generada y volcada al presupuesto');
    };
    
    root.querySelector('#saveTaxes').onclick = () => {
      const updatedTaxTables = getTaxTables();
      updatedTaxTables.ss.rate = parseFloat(root.querySelector('#ssRate').value) / 100 || 0.0635;
      updatedTaxTables.ss.max = parseFloat(root.querySelector('#ssMax').value) || 4495.50;
      
      saveTaxTables(updatedTaxTables);
      alert('📋 Tablas fiscales guardadas correctamente');
      view.mount(root); // Refresh to show updated calculations
    };
  }
};

export default view;