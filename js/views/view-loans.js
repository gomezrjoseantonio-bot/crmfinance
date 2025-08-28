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
        <button type="button" onclick="clearForm()" style="margin-left:10px">🔄 Limpiar</button>
      </div>
    </form>
  `;
}

function renderConditionsForm() {
  const conditions = [
    { id: 'lifeInsurance', label: 'Seguro de vida', maxBonus: 0.5 },
    { id: 'homeInsurance', label: 'Seguro de hogar', maxBonus: 0.3 },
    { id: 'payrollDomiciliation', label: 'Domiciliación nómina', maxBonus: 0.5 },
    { id: 'cardTransactions', label: 'Nº operaciones tarjeta/mes', maxBonus: 0.2 },
    { id: 'cardSpending', label: 'Gasto anual tarjeta', maxBonus: 0.3 },
    { id: 'payrollAmount', label: 'Importe nómina', maxBonus: 0.4 }
  ];
  
  return conditions.map(condition => `
    <div style="border:1px solid var(--border); border-radius:5px; padding:10px; margin-bottom:10px">
      <div class="row">
        <div class="col">
          <label>
            <input type="checkbox" id="${condition.id}_enabled"> ${condition.label}
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
      </div>
    </div>
  `).join('');
}

function renderSimulator() {
  return `
    <div class="row">
      <div class="col">
        <label class="small muted">Capital (€)</label><br/>
        <input type="number" id="simPrincipal" value="200000" step="0.01" style="width:140px">
      </div>
      <div class="col">
        <label class="small muted">Tipo anual (%)</label><br/>
        <input type="number" id="simRate" value="3.5" step="0.01" style="width:100px">
      </div>
      <div class="col">
        <label class="small muted">Años</label><br/>
        <input type="number" id="simYears" value="30" min="1" max="40" style="width:80px">
      </div>
    </div>
    
    <div style="margin-top:15px">
      <button id="calculate" class="primary">🧮 Calcular amortización</button>
      <button id="simulate" style="margin-left:10px">📊 Simular amortización anticipada</button>
    </div>
    
    <div id="simResults" style="margin-top:15px"></div>
    <div id="simAmortizationTable" style="margin-top:15px"></div>
  `;
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
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>💰 Calculadora de préstamos</h2>
            <button id="toggleSimulator" class="primary" style="margin-bottom:15px">🧮 Mostrar calculadora</button>
            <div id="simulatorContent" style="display:none">
              ${renderSimulator()}
            </div>
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
  
  // Simulator toggle
  const toggleBtn = root.querySelector('#toggleSimulator');
  const simulatorContent = root.querySelector('#simulatorContent');
  if (toggleBtn && simulatorContent) {
    toggleBtn.onclick = () => {
      const isVisible = simulatorContent.style.display !== 'none';
      simulatorContent.style.display = isVisible ? 'none' : 'block';
      toggleBtn.textContent = isVisible ? '🧮 Mostrar calculadora' : '❌ Ocultar calculadora';
      
      // Calculate initial simulation when showing
      if (!isVisible) {
        setTimeout(() => calculateSimulation(root), 100);
      }
    };
  }
  
  // Simulator buttons
  const calculateBtn = root.querySelector('#calculate');
  if (calculateBtn) {
    calculateBtn.onclick = () => calculateSimulation(root);
  }
  
  const simulateBtn = root.querySelector('#simulate');
  if (simulateBtn) {
    simulateBtn.onclick = () => simulateEarlyPayment(root);
  }
  
  // Condition checkboxes
  const conditions = ['lifeInsurance', 'homeInsurance', 'payrollDomiciliation', 'cardTransactions', 'cardSpending', 'payrollAmount'];
  conditions.forEach(condition => {
    const checkbox = root.querySelector(`#${condition}_enabled`);
    const bonusInput = root.querySelector(`#${condition}_bonus`);
    const reqInput = root.querySelector(`#${condition}_requirement`);
    
    if (checkbox && bonusInput && reqInput) {
      checkbox.onchange = () => {
        const enabled = checkbox.checked;
        bonusInput.disabled = !enabled;
        reqInput.disabled = !enabled;
        if (!enabled) {
          bonusInput.value = '';
          reqInput.value = '';
        }
      };
    }
  });
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
    
    if (enabled && bonus > 0) {
      conditions[id] = { bonus, requirement };
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
      
      if (checkbox && bonusInput && reqInput) {
        checkbox.checked = true;
        bonusInput.disabled = false;
        reqInput.disabled = false;
        bonusInput.value = cond.bonus;
        reqInput.value = cond.requirement;
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

function calculateSimulation(root) {
  const principal = parseFloat(root.querySelector('#simPrincipal').value) || 0;
  const annualRate = (parseFloat(root.querySelector('#simRate').value) || 0) / 100;
  const years = parseInt(root.querySelector('#simYears').value) || 0;
  
  if (principal <= 0 || annualRate <= 0 || years <= 0) {
    root.querySelector('#simResults').innerHTML = '<div class="small" style="color:red">Por favor, introduce valores válidos</div>';
    return;
  }
  
  const schedule = calculateFrenchAmortization(principal, annualRate, years);
  
  if (schedule.length === 0) {
    root.querySelector('#simResults').innerHTML = '<div class="small" style="color:red">Error en el cálculo</div>';
    return;
  }
  
  const monthlyPayment = schedule[0].payment;
  const totalInterest = schedule.reduce((sum, payment) => sum + payment.interest, 0);
  const totalPaid = principal + totalInterest;
  
  // Results summary
  root.querySelector('#simResults').innerHTML = `
    <div style="background:var(--card); border:1px solid var(--border); border-radius:8px; padding:15px">
      <div class="row">
        <div class="col">
          <div class="small muted">Cuota mensual</div>
          <div style="font-size:20px; font-weight:bold">${fmtEUR(monthlyPayment)}</div>
        </div>
        <div class="col">
          <div class="small muted">Total intereses</div>
          <div style="font-size:16px; font-weight:bold">${fmtEUR(totalInterest)}</div>
        </div>
        <div class="col">
          <div class="small muted">Total a pagar</div>
          <div style="font-size:16px; font-weight:bold">${fmtEUR(totalPaid)}</div>
        </div>
      </div>
      
      <div style="margin-top:10px">
        <div class="small muted">Plazo: ${schedule.length} meses (${years} años)</div>
        <div class="small muted">Deuda viva final: ${fmtEUR(schedule[schedule.length - 1].balance)}</div>
      </div>
    </div>
  `;
  
  // Amortization table (first 12 months + last 12 months)
  const firstYear = schedule.slice(0, 12);
  const lastYear = schedule.slice(-12);
  const showData = schedule.length > 24 ? [...firstYear, {separator: true}, ...lastYear] : schedule;
  
  const tableRows = showData.map(payment => {
    if (payment.separator) {
      return '<tr><td colspan="5" style="text-align:center; color:var(--muted)">... ...</td></tr>';
    }
    
    return `
      <tr>
        <td>${payment.month}</td>
        <td>${fmtEUR(payment.payment)}</td>
        <td>${fmtEUR(payment.principal)}</td>
        <td>${fmtEUR(payment.interest)}</td>
        <td>${fmtEUR(payment.balance)}</td>
      </tr>
    `;
  }).join('');
  
  root.querySelector('#simAmortizationTable').innerHTML = `
    <h3>📋 Cuadro de amortización</h3>
    <div class="grid">
      <table>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Cuota</th>
            <th>Capital</th>
            <th>Interés</th>
            <th>Pendiente</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;
}

function simulateEarlyPayment(root) {
  const extraPayment = prompt('¿Cuánto quieres amortizar anticipadamente?', '10000');
  const extraAmount = parseFloat(extraPayment);
  
  if (!extraAmount || extraAmount <= 0) {
    alert('Introduce una cantidad válida');
    return;
  }
  
  const principal = parseFloat(root.querySelector('#simPrincipal').value) || 0;
  const annualRate = (parseFloat(root.querySelector('#simRate').value) || 0) / 100;
  const years = parseInt(root.querySelector('#simYears').value) || 0;
  
  // Calculate original schedule
  const originalSchedule = calculateFrenchAmortization(principal, annualRate, years);
  
  // Calculate with early payment (assume payment after 12 months)
  const remainingAfter12 = originalSchedule[11].balance - extraAmount;
  
  if (remainingAfter12 <= 0) {
    alert('La amortización anticipada cubre toda la deuda restante');
    return;
  }
  
  // Recalculate remaining payments with reduced principal
  const remainingMonths = originalSchedule.length - 12;
  const newSchedule = calculateFrenchAmortization(remainingAfter12, annualRate, remainingMonths / 12);
  
  const originalTotal = originalSchedule.reduce((sum, p) => sum + p.interest, 0);
  const newTotal = originalSchedule.slice(0, 12).reduce((sum, p) => sum + p.interest, 0) + 
                  newSchedule.reduce((sum, p) => sum + p.interest, 0);
  const savings = originalTotal - newTotal;
  
  alert(`
    Simulación de amortización anticipada:
    
    Amortización: ${fmtEUR(extraAmount)} tras 12 meses
    Ahorro en intereses: ${fmtEUR(savings)}
    Nueva cuota: ${fmtEUR(newSchedule[0]?.payment || 0)}
    Plazo reducido: ${12 + newSchedule.length} meses (vs ${originalSchedule.length} original)
  `);
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

window.calculatePartialAmortizationResults = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const extraAmount = parseFloat(document.querySelector('#extraAmount').value);
  const monthToAmortize = parseInt(document.querySelector('#monthToAmortize').value);
  const amortizationType = document.querySelector('#amortizationType').value;
  
  if (!extraAmount || extraAmount <= 0) {
    alert('Introduce un importe válido para amortizar');
    return;
  }
  
  if (!monthToAmortize || monthToAmortize <= 0) {
    alert('Introduce un mes válido');
    return;
  }
  
  // Get current loan state
  const currentState = calculateCurrentLoanState(loan);
  
  if (currentState.isComplete) {
    alert('El préstamo ya está completado');
    return;
  }
  
  if (monthToAmortize > currentState.monthsRemaining) {
    alert('El mes especificado supera la duración restante del préstamo');
    return;
  }
  
  // Get balance at the specified month from current schedule
  const balanceAtMonth = monthToAmortize <= currentState.currentSchedule.length ? 
                        currentState.currentSchedule[monthToAmortize - 1].balance : 0;
  const newBalance = balanceAtMonth - extraAmount;
  
  if (newBalance <= 0) {
    const totalNeeded = balanceAtMonth;
    const interestSavings = currentState.currentSchedule.slice(monthToAmortize).reduce((sum, p) => sum + p.interest, 0);
    
    document.querySelector('#amortizationResults').innerHTML = `
      <div style="background:var(--success); color:white; padding:15px; border-radius:8px">
        <h3>🎉 ¡Préstamo cancelado completamente!</h3>
        <p>Con ${fmtEUR(extraAmount)} en el mes ${monthToAmortize}, cancelas toda la deuda restante.</p>
        <p><strong>Importe necesario:</strong> ${fmtEUR(totalNeeded)}</p>
        <p><strong>Ahorro total:</strong> ${fmtEUR(interestSavings)}</p>
      </div>
    `;
    return;
  }
  
  // Calculate new schedule after partial amortization
  const remainingMonthsAfterAmortization = currentState.monthsRemaining - monthToAmortize;
  const newSchedule = calculateFrenchAmortization(newBalance, loan.effectiveRate / 100, remainingMonthsAfterAmortization / 12);
  
  // Calculate savings
  const originalInterestAfterMonth = currentState.currentSchedule.slice(monthToAmortize).reduce((sum, p) => sum + p.interest, 0);
  const newInterestAfterMonth = newSchedule.reduce((sum, p) => sum + p.interest, 0);
  const interestSavings = originalInterestAfterMonth - newInterestAfterMonth;
  
  let resultsHTML = '';
  
  if (amortizationType === 'reduce_term') {
    // Reduce term: keep same payment but reduce duration
    const newDuration = newSchedule.length;
    const monthsReduced = remainingMonthsAfterAmortization - newDuration;
    
    resultsHTML = `
      <div style="background:var(--card); border:1px solid var(--border); border-radius:8px; padding:15px">
        <h3>📉 Resultado: Reducir plazo</h3>
        <div class="row">
          <div class="col">
            <div class="small muted">Cuota mensual</div>
            <div><strong>${fmtEUR(newSchedule[0]?.payment || 0)}</strong> (igual)</div>
          </div>
          <div class="col">
            <div class="small muted">Plazo reducido</div>
            <div><strong>${monthsReduced} meses</strong> (${(monthsReduced/12).toFixed(1)} años)</div>
          </div>
          <div class="col">
            <div class="small muted">Ahorro en intereses</div>
            <div style="color:green; font-weight:bold">${fmtEUR(interestSavings)}</div>
          </div>
        </div>
        <div style="margin-top:10px; font-size:14px; color:var(--muted)">
          Nueva duración total restante: ${monthToAmortize + newDuration} meses (vs ${currentState.monthsRemaining} original)
        </div>
      </div>
    `;
  } else {
    // Reduce payment: calculate what the new payment would be with same term
    const newScheduleKeepTerm = calculateFrenchAmortization(newBalance, loan.effectiveRate / 100, remainingMonthsAfterAmortization / 12);
    const newPayment = newScheduleKeepTerm[0]?.payment || 0;
    const originalPayment = currentState.monthlyPayment;
    const paymentReduction = originalPayment - newPayment;
    
    resultsHTML = `
      <div style="background:var(--card); border:1px solid var(--border); border-radius:8px; padding:15px">
        <h3>💰 Resultado: Reducir cuota</h3>
        <div class="row">
          <div class="col">
            <div class="small muted">Nueva cuota mensual</div>
            <div><strong>${fmtEUR(newPayment)}</strong></div>
          </div>
          <div class="col">
            <div class="small muted">Reducción mensual</div>
            <div style="color:green; font-weight:bold">-${fmtEUR(paymentReduction)}</div>
          </div>
          <div class="col">
            <div class="small muted">Ahorro en intereses</div>
            <div style="color:green; font-weight:bold">${fmtEUR(interestSavings)}</div>
          </div>
        </div>
        <div style="margin-top:10px; font-size:14px; color:var(--muted)">
          Duración: ${remainingMonthsAfterAmortization} meses restantes (igual plazo)
        </div>
      </div>
    `;
  }
  
  document.querySelector('#amortizationResults').innerHTML = resultsHTML;
};

window.calculateTotalCancellation = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const monthToCancel = parseInt(document.querySelector('#monthToAmortize').value) || 1;
  const currentState = calculateCurrentLoanState(loan);
  
  if (currentState.isComplete) {
    alert('El préstamo ya está completado');
    return;
  }
  
  if (monthToCancel > currentState.monthsRemaining) {
    alert('El mes especificado supera la duración restante del préstamo');
    return;
  }
  
  // Get balance at the specified month from current schedule
  const balanceAtMonth = monthToCancel <= currentState.currentSchedule.length ? 
                        currentState.currentSchedule[monthToCancel - 1].balance : 0;
  const remainingInterest = currentState.currentSchedule.slice(monthToCancel).reduce((sum, p) => sum + p.interest, 0);
  
  document.querySelector('#amortizationResults').innerHTML = `
    <div style="background:var(--warning); color:white; padding:15px; border-radius:8px">
      <h3>🏁 Cancelación total en el mes ${monthToCancel} (desde hoy)</h3>
      <div class="row">
        <div class="col">
          <div class="small" style="opacity:0.9">Importe para cancelar</div>
          <div style="font-size:20px; font-weight:bold">${fmtEUR(balanceAtMonth)}</div>
        </div>
        <div class="col">
          <div class="small" style="opacity:0.9">Ahorro en intereses</div>
          <div style="font-size:18px; font-weight:bold">${fmtEUR(remainingInterest)}</div>
        </div>
      </div>
      <div style="margin-top:10px; font-size:14px; opacity:0.9">
        Te ahorrarías ${currentState.monthsRemaining - monthToCancel} cuotas restantes
      </div>
    </div>
  `;
};

window.showCurrentAmortizationTable = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const currentState = calculateCurrentLoanState(loan);
  const container = document.querySelector('#amortizationTableContainer');
  
  // Show full schedule with current position marked
  const allSchedule = currentState.originalSchedule;
  const monthsElapsed = currentState.monthsElapsed;
  
  const tableRows = allSchedule.map((payment, index) => {
    const isPaid = index < monthsElapsed;
    const isCurrent = index === monthsElapsed;
    const style = isPaid ? 'background-color: #e8f5e8; opacity: 0.7;' : 
                  isCurrent ? 'background-color: #fff3cd; font-weight: bold;' : '';
    
    return `
      <tr style="${style}">
        <td>${payment.month}${isPaid ? ' ✓' : isCurrent ? ' ◄' : ''}</td>
        <td>${fmtEUR(payment.payment)}</td>
        <td>${fmtEUR(payment.principal)}</td>
        <td>${fmtEUR(payment.interest)}</td>
        <td>${fmtEUR(payment.balance)}</td>
        <td>${isPaid ? 'Pagado' : isCurrent ? 'Actual' : 'Pendiente'}</td>
      </tr>
    `;
  }).join('');
  
  container.innerHTML = `
    <div class="row">
      <div class="col">
        <div class="card">
          <h3>📋 Cuadro de Amortización Completo - ${loan.description}</h3>
          <div class="small muted">
            ✓ = Pagado, ◄ = Próximo pago, Total pagado: ${fmtEUR(currentState.totalPaid)}
          </div>
          
          <div style="max-height: 400px; overflow-y: auto; margin-top: 15px;">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Cuota</th>
                  <th>Capital</th>
                  <th>Interés</th>
                  <th>Pendiente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
          
          <div style="margin-top:15px">
            <button onclick="exportAmortizationTable('${loanId}')" class="primary">📊 Exportar</button>
            <button onclick="document.querySelector('#amortizationTableContainer').style.display='none'" style="margin-left:10px">❌ Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
};

window.exportAmortizationTable = function(loanId) {
  const loans = getLoans();
  const loan = loans.find(l => l.id === loanId);
  if (!loan) return;
  
  const currentState = calculateCurrentLoanState(loan);
  const schedule = currentState.originalSchedule;
  
  // Create CSV content
  let csvContent = 'Mes,Cuota,Capital,Interés,Pendiente,Estado\n';
  
  schedule.forEach((payment, index) => {
    const isPaid = index < currentState.monthsElapsed;
    const isCurrent = index === currentState.monthsElapsed;
    const status = isPaid ? 'Pagado' : isCurrent ? 'Actual' : 'Pendiente';
    
    csvContent += `${payment.month},${payment.payment.toFixed(2)},${payment.principal.toFixed(2)},${payment.interest.toFixed(2)},${payment.balance.toFixed(2)},${status}\n`;
  });
  
  // Add summary information
  csvContent += '\n\nResumen del préstamo:\n';
  csvContent += `Descripción,${loan.description}\n`;
  csvContent += `Capital inicial,${loan.principal.toFixed(2)}\n`;
  csvContent += `Tipo efectivo,${loan.effectiveRate.toFixed(2)}%\n`;
  csvContent += `Meses transcurridos,${currentState.monthsElapsed}\n`;
  csvContent += `Meses restantes,${currentState.monthsRemaining}\n`;
  csvContent += `Capital pendiente,${currentState.currentBalance.toFixed(2)}\n`;
  csvContent += `Total pagado,${currentState.totalPaid.toFixed(2)}\n`;
  csvContent += `Intereses pagados,${currentState.interestPaid.toFixed(2)}\n`;
  
  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `amortizacion_${loan.description.replace(/\s+/g, '_')}_${fmtDateISO(new Date())}.csv`;
  link.click();
};

export default view;