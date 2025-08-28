import { calculateFrenchAmortization, fmtEUR, parseEuro, fmtDateISO, addMonths, calculateCurrentLoanState, monthsBetween } from '../utils.js';
import { getLoans, saveLoans, getAccounts, getProperties, getReal, saveReal, getBudgets, saveBudgets, getCategories, saveCategories } from '../storage.js';

function renderLoansList(loans, accounts, properties) {
  const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
  const propertyMap = Object.fromEntries(properties.map(p => [p.id, p]));
  
  return `
    <div class="grid">
      <table>
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Tipo</th>
            <th>Capital</th>
            <th>Cuota</th>
            <th>Banco</th>
            <th>Asociado a</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${loans.map(loan => {
            const account = accountMap[loan.bankId];
            const property = loan.associatedProperty ? propertyMap[loan.associatedProperty] : null;
            const schedule = calculateFrenchAmortization(loan.principal, loan.annualRate / 100, loan.years);
            const monthlyPayment = schedule.length > 0 ? schedule[0].payment : 0;
            
            return `
              <tr>
                <td><strong>${loan.description}</strong></td>
                <td>${getLoanTypeLabel(loan.type)}</td>
                <td>${fmtEUR(loan.principal)}</td>
                <td>${fmtEUR(monthlyPayment)}</td>
                <td style="color:${account?.color || '#666'}">${account?.name || 'N/A'}</td>
                <td>${property ? property.address : loan.associationType === 'personal' ? 'Personal' : 'N/A'}</td>
                <td>${loan.active ? '✅ Activo' : '⏸️ Pausado'}</td>
                <td>
                  <button onclick="viewLoanDetails('${loan.id}')" style="font-size:12px">👁️ Ver</button>
                  <button onclick="calculatePartialAmortization('${loan.id}')" style="font-size:12px">🧮 Amortizar</button>
                  <button onclick="editLoan('${loan.id}')" style="font-size:12px">✏️ Editar</button>
                  <button onclick="deleteLoan('${loan.id}')" style="font-size:12px; color:red">🗑️</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getLoanTypeLabel(type) {
  const types = {
    'mortgage': '🏠 Hipoteca',
    'personal': '👤 Personal',
    'car': '🚗 Coche',
    'business': '💼 Negocio',
    'other': '📄 Otro'
  };
  return types[type] || type;
}

function renderLoanForm(accounts, properties) {
  return `
    <form id="loanForm">
      <input type="hidden" id="loanId" value="">
      
      <div class="row">
        <div class="col">
          <label class="small muted">Descripción *</label><br/>
          <input type="text" id="description" placeholder="ej: Hipoteca vivienda habitual" required style="width:100%; margin-bottom:10px">
        </div>
        <div class="col">
          <label class="small muted">Tipo de préstamo *</label><br/>
          <select id="loanType" required style="width:100%; margin-bottom:10px">
            <option value="">Seleccionar tipo</option>
            <option value="mortgage">🏠 Hipoteca</option>
            <option value="personal">👤 Personal</option>
            <option value="car">🚗 Coche</option>
            <option value="business">💼 Negocio</option>
            <option value="other">📄 Otro</option>
          </select>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <label class="small muted">Capital inicial (€) *</label><br/>
          <input type="number" id="principal" step="0.01" min="1" required style="width:100%; margin-bottom:10px">
        </div>
        <div class="col">
          <label class="small muted">Tipo de interés anual (%) *</label><br/>
          <input type="number" id="annualRate" step="0.01" min="0" max="20" required style="width:100%; margin-bottom:10px">
        </div>
        <div class="col">
          <label class="small muted">Plazo (años) *</label><br/>
          <input type="number" id="years" min="1" max="40" required style="width:100%; margin-bottom:10px">
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <label class="small muted">Banco *</label><br/>
          <select id="bankId" required style="width:100%; margin-bottom:10px">
            <option value="">Seleccionar banco</option>
            ${accounts.map(account => `<option value="${account.id}">${account.name}</option>`).join('')}
          </select>
        </div>
        <div class="col">
          <label class="small muted">Día de cobro de cuota</label><br/>
          <input type="number" id="paymentDay" min="1" max="31" value="1" style="width:100%; margin-bottom:10px">
        </div>
        <div class="col">
          <label class="small muted">Fecha de inicio</label><br/>
          <input type="date" id="startDate" value="${fmtDateISO(new Date())}" style="width:100%; margin-bottom:10px">
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <label class="small muted">Asociación *</label><br/>
          <select id="associationType" onchange="toggleAssociationOptions()" style="width:100%; margin-bottom:10px">
            <option value="">Seleccionar asociación</option>
            <option value="property">🏠 Inmueble</option>
            <option value="investment">💎 Inversión (futuro)</option>
            <option value="personal">👤 Personal</option>
          </select>
        </div>
        <div class="col">
          <div id="propertySelection" style="display:none">
            <label class="small muted">Inmueble</label><br/>
            <select id="associatedProperty" style="width:100%; margin-bottom:10px">
              <option value="">Seleccionar inmueble</option>
              ${properties.map(prop => `<option value="${prop.id}">${prop.address}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      
      <div style="margin-top:15px">
        <h3>🎁 Condiciones y Bonificaciones</h3>
        <div class="small muted">Descuentos en el tipo de interés según productos contratados</div>
        
        <div id="conditions">
          ${renderConditionsForm()}
        </div>
      </div>
      
      <div style="margin-top:15px">
        <button type="submit" class="primary">💾 Guardar préstamo</button>
        <button type="button" onclick="clearForm()" style="margin-left:10px">🧹 Limpiar</button>
      </div>
    </form>
  `;
}

function renderConditionsForm() {
  const conditions = [
    { id: 'lifeInsurance', label: 'Seguro de vida' },
    { id: 'homeInsurance', label: 'Seguro de hogar' },
    { id: 'payrollDomiciliation', label: 'Domiciliación nómina' },
    { id: 'cardTransactions', label: 'Nº operaciones tarjeta/mes' },
    { id: 'cardSpending', label: 'Gasto anual tarjeta' },
    { id: 'payrollAmount', label: 'Importe nómina' }
  ];
  
  return conditions.map(condition => `
    <div style="border:1px solid var(--border); border-radius:5px; padding:10px; margin-bottom:10px">
      <div class="row">
        <div class="col">
          <label>
            <input type="checkbox" id="${condition.id}_enabled"> 
            <span id="${condition.id}_status"></span> ${condition.label}
          </label>
        </div>
        <div class="col">
          <label class="small muted">Bonificación (%)</label><br/>
          <input type="number" id="${condition.id}_bonus" step="0.01" min="0" style="width:80px" disabled>
        </div>
        <div class="col">
          <label class="small muted">Requerimiento</label><br/>
          <input type="text" id="${condition.id}_requirement" placeholder="ej: >2.000€/mes" style="width:100%" disabled>
        </div>
        <div class="col">
          <label class="small muted">Aplicar desde mes</label><br/>
          <input type="number" id="${condition.id}_fromMonth" min="1" style="width:80px" placeholder="1" disabled>
        </div>
      </div>
    </div>
  `).join('');
}

const view = {
  route: '#/loans',
  title: 'Préstamos',
  
  async mount(root) {
    const loans = getLoans();
    const accounts = getAccounts();
    const properties = getProperties();
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>🏦 Préstamos y Hipotecas</h1>
            <div class="small muted">Gestión completa con amortización francesa e integración automática</div>
          </div>
        </div>
      </div>
      
      ${loans.length > 0 ? `
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📋 Mis Préstamos</h2>
            ${renderLoansList(loans, accounts, properties)}
          </div>
        </div>
      </div>
      ` : ''}
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>➕ ${loans.length === 0 ? 'Añadir primer préstamo' : 'Nuevo préstamo'}</h2>
            ${renderLoanForm(accounts, properties)}
          </div>
        </div>
      </div>
      
      <div id="loanDetails" style="display:none"></div>
    `;
    
    // Event handlers
    setupEventHandlers(root);
  }
};

function setupEventHandlers(root) {
  // Loan form submission
  const loanForm = root.querySelector('#loanForm');
  if (loanForm) {
    loanForm.onsubmit = (e) => {
      e.preventDefault();
      saveLoan(root);
    };
  }
  
  // Condition checkboxes
  const conditions = ['lifeInsurance', 'homeInsurance', 'payrollDomiciliation', 'cardTransactions', 'cardSpending', 'payrollAmount'];
  conditions.forEach(condition => {
    const checkbox = root.querySelector(`#${condition}_enabled`);
    const bonusInput = root.querySelector(`#${condition}_bonus`);
    const reqInput = root.querySelector(`#${condition}_requirement`);
    const fromMonthInput = root.querySelector(`#${condition}_fromMonth`);
    
    if (checkbox && bonusInput && reqInput && fromMonthInput) {
      checkbox.onchange = () => {
        const enabled = checkbox.checked;
        bonusInput.disabled = !enabled;
        reqInput.disabled = !enabled;
        fromMonthInput.disabled = !enabled;
        if (!enabled) {
          bonusInput.value = '';
          reqInput.value = '';
          fromMonthInput.value = '';
        }
      };
    }
  });
  
  // Update bonification status icons
  updateBonificationStatus(root);
}

// Global functions for onclick handlers
window.toggleAssociationOptions = function() {
  const associationType = document.querySelector('#associationType').value;
  const propertySelection = document.querySelector('#propertySelection');
  
  if (propertySelection) {
    propertySelection.style.display = associationType === 'property' ? 'block' : 'none';
  }
};

window.clearForm = function() {
  const form = document.querySelector('#loanForm');
  if (form) form.reset();
  window.toggleAssociationOptions();
};

window.viewLoanDetails = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  showLoanDetails(loan);
};

window.editLoan = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  populateLoanForm(loan);
};

window.deleteLoan = function(loanId) {
  if (!confirm('¿Estás seguro de que quieres eliminar este préstamo?')) return;
  
  const loans = getLoans();
  const updatedLoans = loans.filter(l => l.id !== loanId);
  saveLoans(updatedLoans);
  
  // Refresh the view
  view.mount(document.getElementById('app'));
};

window.calculatePartialAmortization = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  showPartialAmortizationCalculator(loan);
};

function saveLoan(root) {
  const loanId = root.querySelector('#loanId').value || generateId();
  const description = root.querySelector('#description').value;
  const type = root.querySelector('#loanType').value;
  const principal = parseFloat(root.querySelector('#principal').value);
  const annualRate = parseFloat(root.querySelector('#annualRate').value);
  const years = parseInt(root.querySelector('#years').value);
  const bankId = root.querySelector('#bankId').value;
  const paymentDay = parseInt(root.querySelector('#paymentDay').value) || 1;
  const startDate = root.querySelector('#startDate').value;
  const associationType = root.querySelector('#associationType').value;
  const associatedProperty = root.querySelector('#associatedProperty').value;
  
  // Collect conditions
  const conditions = {};
  const conditionIds = ['lifeInsurance', 'homeInsurance', 'payrollDomiciliation', 'cardTransactions', 'cardSpending', 'payrollAmount'];
  conditionIds.forEach(id => {
    const enabled = root.querySelector(`#${id}_enabled`).checked;
    const bonus = parseFloat(root.querySelector(`#${id}_bonus`).value) || 0;
    const requirement = root.querySelector(`#${id}_requirement`).value;
    const fromMonth = parseInt(root.querySelector(`#${id}_fromMonth`).value) || 1;
    
    if (enabled && bonus > 0) {
      conditions[id] = { bonus, requirement, fromMonth };
    }
  });
  
  // Calculate effective rate with bonuses
  const totalBonus = Object.values(conditions).reduce((sum, cond) => sum + cond.bonus, 0);
  const effectiveRate = Math.max(0, annualRate - totalBonus);
  
  const loan = {
    id: loanId,
    description,
    type,
    principal,
    annualRate,
    effectiveRate,
    years,
    bankId,
    paymentDay,
    startDate,
    associationType,
    associatedProperty: associationType === 'property' ? associatedProperty : null,
    conditions,
    active: true,
    createdAt: new Date().toISOString(),
    lastPaymentDate: null
  };
  
  const loans = getLoans();
  const existingIndex = loans.findIndex(l => l.id === loanId);
  
  if (existingIndex >= 0) {
    loans[existingIndex] = loan;
  } else {
    loans.push(loan);
  }
  
  saveLoans(loans);
  
  // Add to budget category if not exists
  addLoanToBudget(loan);
  
  alert('Préstamo guardado correctamente');
  
  // Refresh the view
  view.mount(root.parentElement);
}

function addLoanToBudget(loan) {
  const categories = getCategories();
  const budgets = getBudgets();
  
  // Check if loan category exists
  let loanCategory = categories.find(c => c.id === 'loans');
  if (!loanCategory) {
    loanCategory = {
      id: 'loans',
      name: 'Préstamos e Hipotecas',
      color: '#dc2626',
      type: 'expense'
    };
    categories.push(loanCategory);
    saveCategories(categories);
  }
  
  // Add or update budget
  const schedule = calculateFrenchAmortization(loan.principal, loan.effectiveRate / 100, loan.years);
  const monthlyPayment = schedule.length > 0 ? schedule[0].payment : 0;
  
  let loanBudget = budgets.find(b => b.categoryId === 'loans');
  if (!loanBudget) {
    loanBudget = {
      categoryId: 'loans',
      monthlyLimit: monthlyPayment,
      alertThreshold: 0.9
    };
    budgets.push(loanBudget);
  } else {
    loanBudget.monthlyLimit += monthlyPayment;
  }
  
  saveBudgets(budgets);
}

function populateLoanForm(loan) {
  document.querySelector('#loanId').value = loan.id;
  document.querySelector('#description').value = loan.description;
  document.querySelector('#loanType').value = loan.type;
  document.querySelector('#principal').value = loan.principal;
  document.querySelector('#annualRate').value = loan.annualRate;
  document.querySelector('#years').value = loan.years;
  document.querySelector('#bankId').value = loan.bankId;
  document.querySelector('#paymentDay').value = loan.paymentDay;
  document.querySelector('#startDate').value = loan.startDate;
  document.querySelector('#associationType').value = loan.associationType;
  
  if (loan.associatedProperty) {
    document.querySelector('#associatedProperty').value = loan.associatedProperty;
  }
  
  window.toggleAssociationOptions();
  
  // Populate conditions
  if (loan.conditions) {
    Object.keys(loan.conditions).forEach(condId => {
      const cond = loan.conditions[condId];
      const checkbox = document.querySelector(`#${condId}_enabled`);
      const bonusInput = document.querySelector(`#${condId}_bonus`);
      const reqInput = document.querySelector(`#${condId}_requirement`);
      const fromMonthInput = document.querySelector(`#${condId}_fromMonth`);
      
      if (checkbox && bonusInput && reqInput && fromMonthInput) {
        checkbox.checked = true;
        bonusInput.disabled = false;
        reqInput.disabled = false;
        fromMonthInput.disabled = false;
        bonusInput.value = cond.bonus;
        reqInput.value = cond.requirement;
        fromMonthInput.value = cond.fromMonth || 1;
      }
    });
  }
}

function showLoanDetails(loan) {
  const accounts = getAccounts();
  const properties = getProperties();
  const account = accounts.find(a => a.id === loan.bankId);
  const property = loan.associatedProperty ? properties.find(p => p.id === loan.associatedProperty) : null;
  
  const schedule = calculateFrenchAmortization(loan.principal, loan.effectiveRate / 100, loan.years);
  const monthlyPayment = schedule.length > 0 ? schedule[0].payment : 0;
  const totalInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
  const totalPaid = loan.principal + totalInterest;
  
  const detailsContainer = document.querySelector('#loanDetails');
  detailsContainer.style.display = 'block';
  detailsContainer.innerHTML = `
    <div class="row">
      <div class="col">
        <div class="card">
          <h2>📊 Detalles del préstamo: ${loan.description}</h2>
          
          <div class="row">
            <div class="col">
              <h3>📋 Información General</h3>
              <div><strong>Tipo:</strong> ${getLoanTypeLabel(loan.type)}</div>
              <div><strong>Capital inicial:</strong> ${fmtEUR(loan.principal)}</div>
              <div><strong>Tipo nominal:</strong> ${loan.annualRate}%</div>
              <div><strong>Tipo efectivo:</strong> ${loan.effectiveRate.toFixed(2)}%</div>
              <div><strong>Plazo:</strong> ${loan.years} años</div>
              <div><strong>Banco:</strong> <span style="color:${account?.color || '#666'}">${account?.name || 'N/A'}</span></div>
              <div><strong>Día de cobro:</strong> ${loan.paymentDay}</div>
              <div><strong>Fecha inicio:</strong> ${loan.startDate}</div>
              <div><strong>Asociado a:</strong> ${property ? property.address : loan.associationType === 'personal' ? 'Personal' : 'N/A'}</div>
            </div>
            <div class="col">
              <h3>💰 Resumen Financiero</h3>
              <div><strong>Cuota mensual:</strong> <span style="font-size:18px; font-weight:bold">${fmtEUR(monthlyPayment)}</span></div>
              <div><strong>Total intereses:</strong> ${fmtEUR(totalInterest)}</div>
              <div><strong>Total a pagar:</strong> ${fmtEUR(totalPaid)}</div>
              <div><strong>Estado:</strong> ${loan.active ? '✅ Activo' : '⏸️ Pausado'}</div>
            </div>
          </div>
          
          ${Object.keys(loan.conditions || {}).length > 0 ? `
          <div style="margin-top:15px">
            <h3>🎁 Condiciones Aplicadas</h3>
            <div class="grid">
              <table>
                <thead>
                  <tr><th>Condición</th><th>Bonificación</th><th>Requerimiento</th></tr>
                </thead>
                <tbody>
                  ${Object.entries(loan.conditions).map(([key, cond]) => `
                    <tr>
                      <td>${getConditionLabel(key)}</td>
                      <td>-${cond.bonus}%</td>
                      <td>${cond.requirement}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          ` : ''}
          
          <div style="margin-top:15px">
            <button onclick="document.querySelector('#loanDetails').style.display='none'" class="primary">❌ Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  detailsContainer.scrollIntoView({ behavior: 'smooth' });
}

function getConditionLabel(key) {
  const labels = {
    'lifeInsurance': 'Seguro de vida',
    'homeInsurance': 'Seguro de hogar',
    'payrollDomiciliation': 'Domiciliación nómina',
    'cardTransactions': 'Operaciones tarjeta',
    'cardSpending': 'Gasto anual tarjeta',
    'payrollAmount': 'Importe nómina'
  };
  return labels[key] || key;
}

function generateId() {
  return 'loan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function updateBonificationStatus(root) {
  const conditions = ['lifeInsurance', 'homeInsurance', 'payrollDomiciliation', 'cardTransactions', 'cardSpending', 'payrollAmount'];
  
  conditions.forEach(condition => {
    const statusElement = root.querySelector(`#${condition}_status`);
    if (statusElement) {
      // Check if the condition is met based on bank movements
      const isMet = checkBonificationCondition(condition);
      statusElement.innerHTML = isMet ? '✅' : '❌';
      statusElement.title = isMet ? 'Criterio cumplido según movimientos bancarios' : 'Criterio no cumplido';
    }
  });
}

function checkBonificationCondition(conditionId) {
  // This would check against actual bank movements
  // For now, we'll return a placeholder implementation
  // In a real system, this would analyze transactions from getReal()
  
  const real = getReal();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  // Get movements for current year
  const yearMovements = real.filter(mov => {
    const movDate = new Date(mov.date);
    return movDate.getFullYear() === currentYear;
  });
  
  switch(conditionId) {
    case 'payrollDomiciliation':
      // Check for regular salary deposits
      const salaryMovements = yearMovements.filter(mov => 
        mov.type === 'income' && 
        (mov.description?.toLowerCase().includes('nomina') || 
         mov.description?.toLowerCase().includes('salario') ||
         mov.description?.toLowerCase().includes('sueldo'))
      );
      return salaryMovements.length >= 6; // At least 6 salary payments this year
      
    case 'cardTransactions':
      // Check for card transactions (negative movements that might be card payments)
      const cardMovements = yearMovements.filter(mov => 
        mov.type === 'expense' && 
        (mov.description?.toLowerCase().includes('tarjeta') ||
         mov.description?.toLowerCase().includes('visa') ||
         mov.description?.toLowerCase().includes('mastercard'))
      );
      const avgMonthlyTransactions = cardMovements.length / currentMonth;
      return avgMonthlyTransactions >= 10; // At least 10 card transactions per month on average
      
    case 'cardSpending':
      // Check total card spending
      const cardSpending = yearMovements
        .filter(mov => mov.type === 'expense' && 
          (mov.description?.toLowerCase().includes('tarjeta') ||
           mov.description?.toLowerCase().includes('visa') ||
           mov.description?.toLowerCase().includes('mastercard')))
        .reduce((sum, mov) => sum + Math.abs(mov.amount), 0);
      return cardSpending >= 6000; // At least 6000€ annual card spending
      
    case 'payrollAmount':
      // Check payroll amount
      const recentSalaries = yearMovements
        .filter(mov => mov.type === 'income' && 
          (mov.description?.toLowerCase().includes('nomina') || 
           mov.description?.toLowerCase().includes('salario')))
        .slice(-3); // Last 3 salary payments
      
      if (recentSalaries.length === 0) return false;
      const avgSalary = recentSalaries.reduce((sum, mov) => sum + mov.amount, 0) / recentSalaries.length;
      return avgSalary >= 2000; // At least 2000€ average monthly salary
      
    case 'lifeInsurance':
    case 'homeInsurance':
      // Check for insurance payments
      const insuranceMovements = yearMovements.filter(mov => 
        mov.type === 'expense' && 
        (mov.description?.toLowerCase().includes('seguro') ||
         mov.description?.toLowerCase().includes('insurance'))
      );
      return insuranceMovements.length > 0; // Has insurance payments
      
    default:
      return false;
  }
}

function showPartialAmortizationCalculator(loan) {
  const detailsContainer = document.querySelector('#loanDetails');
  detailsContainer.style.display = 'block';
  
  // Calculate current loan state with accurate remaining months and balance
  const currentState = calculateCurrentLoanState(loan);
  
  detailsContainer.innerHTML = `
    <div class="row">
      <div class="col">
        <div class="card">
          <h2>🧮 Calculadora de Amortización - ${loan.description}</h2>
          
          <div class="row">
            <div class="col">
              <h3>📊 Datos actuales del préstamo</h3>
              <div><strong>Capital pendiente:</strong> ${fmtEUR(currentState.currentBalance)}</div>
              <div><strong>Cuota actual:</strong> ${fmtEUR(currentState.monthlyPayment)}</div>
              <div><strong>Tipo efectivo:</strong> ${loan.effectiveRate.toFixed(2)}%</div>
              <div><strong>Meses restantes:</strong> ${currentState.monthsRemaining}</div>
              <div><strong>Meses transcurridos:</strong> ${currentState.monthsElapsed}</div>
              <div><strong>Estado:</strong> ${currentState.isComplete ? '✅ Completado' : '⏳ Activo'}</div>
            </div>
            <div class="col">
              <h3>💰 Resumen de pagos</h3>
              <div><strong>Total pagado:</strong> ${fmtEUR(currentState.totalPaid)}</div>
              <div><strong>Intereses pagados:</strong> ${fmtEUR(currentState.interestPaid)}</div>
              <div><strong>Capital amortizado:</strong> ${fmtEUR(loan.principal - currentState.currentBalance)}</div>
            </div>
          </div>
          
          <div style="margin-top:20px">
            <button onclick="showCurrentAmortizationTable('${loan.id}')" class="primary">📋 Ver cuadro actual</button>
            <button onclick="exportAmortizationTable('${loan.id}')" style="margin-left:10px">📊 Exportar cuadro</button>
          </div>
          
          ${!currentState.isComplete ? `
          <div style="margin-top:20px; border:1px solid var(--border); border-radius:8px; padding:15px">
            <h3>💰 Simular Amortización Anticipada</h3>
            
            <div class="row">
              <div class="col">
                <label class="small muted">Importe a amortizar (€)</label><br/>
                <input type="number" id="extraAmount" step="0.01" min="1" style="width:150px" placeholder="10000">
              </div>
              <div class="col">
                <label class="small muted">¿En qué mes amortizar?</label><br/>
                <input type="number" id="monthToAmortize" min="1" max="${currentState.monthsRemaining}" value="${Math.min(12, currentState.monthsRemaining)}" style="width:100px">
                <div class="small muted">Relativo al mes actual</div>
              </div>
              <div class="col">
                <label class="small muted">Tipo de amortización</label><br/>
                <select id="amortizationType" style="width:180px">
                  <option value="reduce_term">Reducir plazo</option>
                  <option value="reduce_payment">Reducir cuota</option>
                </select>
              </div>
            </div>
            
            <div style="margin-top:15px">
              <button onclick="calculatePartialAmortizationResults('${loan.id}')" class="primary">🧮 Calcular</button>
              <button onclick="calculateTotalCancellation('${loan.id}')" style="margin-left:10px">🏁 Cancelación total</button>
            </div>
            
            <div id="amortizationResults" style="margin-top:15px"></div>
          </div>
          ` : `
          <div style="margin-top:20px; padding:15px; background:var(--success); color:white; border-radius:8px">
            <h3>🎉 Préstamo completado</h3>
            <p>Este préstamo ya ha sido completamente amortizado.</p>
          </div>
          `}
          
          <div style="margin-top:15px">
            <button onclick="document.querySelector('#loanDetails').style.display='none'" class="primary">❌ Cerrar</button>
          </div>
        </div>
      </div>
    </div>
    
    <div id="amortizationTableContainer" style="display:none"></div>
  `;
  
  detailsContainer.scrollIntoView({ behavior: 'smooth' });
}