import { getLoans, saveLoans, getAccounts } from '../storage.js';
import { fmtEUR, parseEuro, fmtDateISO } from '../utils.js';

const view = {
  route: '#/prestamos',
  title: 'Préstamos',
  
  async mount(root) {
    const loans = getLoans();
    const accounts = getAccounts();
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <h1>Gestión de Préstamos</h1>
          <div class="muted">Cuadros de amortización y simulaciones</div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Crear nuevo préstamo</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
              <div>
                <label class="small muted">Nombre del préstamo</label>
                <input type="text" id="loanName" placeholder="Hipoteca casa" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Capital inicial (€)</label>
                <input type="number" id="loanPrincipal" step="0.01" placeholder="150000.00" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Tipo de interés anual (%)</label>
                <input type="number" id="loanInterest" step="0.01" placeholder="3.50" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Plazo (años)</label>
                <input type="number" id="loanYears" min="1" placeholder="25" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Banco</label>
                <select id="loanBank" style="width: 100%">
                  ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="small muted">Día de pago</label>
                <input type="number" id="loanPaymentDay" min="1" max="31" value="15" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Activo asociado</label>
                <input type="text" id="loanAsset" placeholder="Vivienda principal" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Fecha de inicio</label>
                <input type="date" id="loanStartDate" style="width: 100%" value="${fmtDateISO(new Date())}">
              </div>
            </div>
            <button id="addLoan" class="primary">Crear préstamo</button>
            <button id="simulateLoan" style="margin-left: 10px;">Simular</button>
          </div>
        </div>
      </div>
      
      <div class="row" id="simulationResults" style="display: none;">
        <div class="col">
          <div class="card">
            <h2>Simulación</h2>
            <div id="simulationContent"></div>
          </div>
        </div>
      </div>
      
      <div class="row" id="loansList">
      </div>
    `;
    
    // Add loan
    root.querySelector('#addLoan').onclick = () => {
      const name = root.querySelector('#loanName').value.trim();
      const principal = parseFloat(root.querySelector('#loanPrincipal').value) || 0;
      const annualRate = parseFloat(root.querySelector('#loanInterest').value) || 0;
      const years = parseInt(root.querySelector('#loanYears').value) || 0;
      const bank = root.querySelector('#loanBank').value;
      const paymentDay = parseInt(root.querySelector('#loanPaymentDay').value) || 15;
      const asset = root.querySelector('#loanAsset').value.trim();
      const startDate = root.querySelector('#loanStartDate').value;
      
      if (!name || !principal || !annualRate || !years) {
        alert('Por favor, completa todos los campos obligatorios');
        return;
      }
      
      const loan = {
        id: Date.now(),
        name,
        principal,
        annualRate,
        years,
        bank,
        paymentDay,
        asset,
        startDate,
        created: new Date().toISOString(),
        amortizationTable: generateAmortizationTable(principal, annualRate, years, startDate)
      };
      
      const currentLoans = getLoans();
      currentLoans.push(loan);
      saveLoans(currentLoans);
      
      // Reset form
      root.querySelector('#loanName').value = '';
      root.querySelector('#loanPrincipal').value = '';
      root.querySelector('#loanInterest').value = '';
      root.querySelector('#loanYears').value = '';
      root.querySelector('#loanAsset').value = '';
      
      // Refresh view
      view.mount(root);
    };
    
    // Simulate loan
    root.querySelector('#simulateLoan').onclick = () => {
      const principal = parseFloat(root.querySelector('#loanPrincipal').value) || 0;
      const annualRate = parseFloat(root.querySelector('#loanInterest').value) || 0;
      const years = parseInt(root.querySelector('#loanYears').value) || 0;
      const startDate = root.querySelector('#loanStartDate').value || fmtDateISO(new Date());
      
      if (!principal || !annualRate || !years) {
        alert('Por favor, completa los campos de simulación');
        return;
      }
      
      const amortizationTable = generateAmortizationTable(principal, annualRate, years, startDate);
      renderSimulation(root, amortizationTable, principal, annualRate, years);
    };
    
    // Render loans
    renderLoans(root, loans);
  }
};

function generateAmortizationTable(principal, annualRate, years, startDate) {
  const monthlyRate = annualRate / 100 / 12;
  const totalPayments = years * 12;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);
  
  const table = [];
  let remainingBalance = principal;
  let currentDate = new Date(startDate);
  
  for (let payment = 1; payment <= totalPayments; payment++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    remainingBalance -= principalPayment;
    
    // Ensure we don't have negative balance due to rounding
    if (remainingBalance < 0.01) remainingBalance = 0;
    
    table.push({
      payment,
      date: fmtDateISO(currentDate),
      monthlyPayment,
      principalPayment,
      interestPayment,
      remainingBalance
    });
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  return table;
}

function renderSimulation(root, amortizationTable, principal, annualRate, years) {
  const simulationEl = root.querySelector('#simulationResults');
  const contentEl = root.querySelector('#simulationContent');
  
  const totalPaid = amortizationTable.reduce((sum, row) => sum + row.monthlyPayment, 0);
  const totalInterest = totalPaid - principal;
  const monthlyPayment = amortizationTable[0]?.monthlyPayment || 0;
  
  // Show summary
  contentEl.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
      <div class="text-center">
        <div class="small muted">Cuota mensual</div>
        <div class="kpi">${fmtEUR(monthlyPayment)}</div>
      </div>
      <div class="text-center">
        <div class="small muted">Total a pagar</div>
        <div class="kpi">${fmtEUR(totalPaid)}</div>
      </div>
      <div class="text-center">
        <div class="small muted">Total intereses</div>
        <div class="kpi" style="color: red;">${fmtEUR(totalInterest)}</div>
      </div>
      <div class="text-center">
        <div class="small muted">Ahorro total</div>
        <div class="kpi" style="color: green;">${fmtEUR(totalInterest)}</div>
      </div>
    </div>
    
    <div style="margin-bottom: 15px;">
      <h3>Cuadro de amortización (primeros 12 meses)</h3>
      <div style="max-height: 300px; overflow-y: auto;">
        <table style="width: 100%; font-size: 0.9em;">
          <thead>
            <tr>
              <th>Cuota</th>
              <th>Fecha</th>
              <th>Cuota mensual</th>
              <th>Capital</th>
              <th>Intereses</th>
              <th>Saldo pendiente</th>
            </tr>
          </thead>
          <tbody>
            ${amortizationTable.slice(0, 12).map(row => `
              <tr>
                <td>${row.payment}</td>
                <td>${row.date}</td>
                <td>${fmtEUR(row.monthlyPayment)}</td>
                <td>${fmtEUR(row.principalPayment)}</td>
                <td>${fmtEUR(row.interestPayment)}</td>
                <td>${fmtEUR(row.remainingBalance)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="small muted" style="margin-top: 10px;">
        Mostrando los primeros 12 meses de ${amortizationTable.length} cuotas totales
      </div>
    </div>
    
    <div>
      <h3>Simulaciones adicionales</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <div>
          <label class="small muted">Amortización extra (€)</label>
          <input type="number" id="extraPayment" step="0.01" placeholder="5000.00" style="width: 100%">
        </div>
        <div>
          <label class="small muted">En la cuota número</label>
          <input type="number" id="extraPaymentMonth" min="1" max="${amortizationTable.length}" placeholder="12" style="width: 100%">
        </div>
      </div>
      <button id="simulateExtra" class="secondary">Simular amortización extra</button>
    </div>
  `;
  
  simulationEl.style.display = 'block';
  
  // Extra payment simulation
  contentEl.querySelector('#simulateExtra').onclick = () => {
    const extraPayment = parseFloat(contentEl.querySelector('#extraPayment').value) || 0;
    const extraPaymentMonth = parseInt(contentEl.querySelector('#extraPaymentMonth').value) || 1;
    
    if (!extraPayment) {
      alert('Introduce un importe para la amortización extra');
      return;
    }
    
    const newTable = simulateExtraPayment(amortizationTable, extraPayment, extraPaymentMonth);
    const newTotalPaid = newTable.reduce((sum, row) => sum + row.monthlyPayment, 0) + extraPayment;
    const newTotalInterest = newTotalPaid - principal;
    const savings = totalPaid - newTotalPaid;
    const monthsSaved = amortizationTable.length - newTable.length;
    
    alert(`
      Simulación con amortización extra de ${fmtEUR(extraPayment)}:
      - Nuevo total a pagar: ${fmtEUR(newTotalPaid)}
      - Ahorro en intereses: ${fmtEUR(savings)}
      - Meses ahorrados: ${monthsSaved}
      - Nueva duración: ${Math.floor(newTable.length / 12)} años y ${newTable.length % 12} meses
    `);
  };
}

function simulateExtraPayment(originalTable, extraPayment, extraPaymentMonth) {
  // This is a simplified simulation - in reality, you'd recalculate the entire table
  const newTable = [...originalTable];
  
  if (extraPaymentMonth <= newTable.length) {
    const row = newTable[extraPaymentMonth - 1];
    row.remainingBalance = Math.max(0, row.remainingBalance - extraPayment);
    
    // Remove payments where remaining balance is 0
    const cutoffIndex = newTable.findIndex(r => r.remainingBalance <= 0);
    if (cutoffIndex > -1) {
      return newTable.slice(0, cutoffIndex + 1);
    }
  }
  
  return newTable;
}

function renderLoans(root, loans) {
  const loansEl = root.querySelector('#loansList');
  
  if (loans.length === 0) {
    loansEl.innerHTML = `
      <div class="col">
        <div class="card">
          <div class="text-center muted">No hay préstamos registrados</div>
        </div>
      </div>
    `;
    return;
  }
  
  const loanCards = loans.map(loan => {
    const currentDate = new Date();
    const currentPayment = loan.amortizationTable.find(row => new Date(row.date) >= currentDate) || loan.amortizationTable[loan.amortizationTable.length - 1];
    const remainingPayments = loan.amortizationTable.filter(row => new Date(row.date) >= currentDate).length;
    const totalPaid = loan.amortizationTable.reduce((sum, row) => sum + row.monthlyPayment, 0);
    const totalInterest = totalPaid - loan.principal;
    
    return `
      <div class="col-lg-6" style="margin-bottom: 20px;">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <h3>${loan.name}</h3>
              <div class="small muted">${loan.asset} · ${loan.bank}</div>
              <div class="small">Día de pago: ${loan.paymentDay} de cada mes</div>
            </div>
            <button class="small delete-loan" data-id="${loan.id}" style="color: red;">×</button>
          </div>
          
          <div style="margin-top: 15px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
              <div>
                <div class="small muted">Cuota mensual</div>
                <div><b>${fmtEUR(currentPayment?.monthlyPayment || 0)}</b></div>
              </div>
              <div>
                <div class="small muted">Saldo pendiente</div>
                <div><b>${fmtEUR(currentPayment?.remainingBalance || 0)}</b></div>
              </div>
              <div>
                <div class="small muted">Cuotas restantes</div>
                <div><b>${remainingPayments}</b></div>
              </div>
              <div>
                <div class="small muted">Total intereses</div>
                <div style="color: red;"><b>${fmtEUR(totalInterest)}</b></div>
              </div>
            </div>
            
            <div style="margin-top: 10px;">
              <button class="small view-schedule" data-id="${loan.id}">Ver cuadro completo</button>
            </div>
          </div>
          
          <div id="schedule-${loan.id}" style="display: none; margin-top: 15px;">
            <h4>Cuadro de amortización</h4>
            <div style="max-height: 200px; overflow-y: auto;">
              <table style="width: 100%; font-size: 0.8em;">
                <thead>
                  <tr><th>Cuota</th><th>Fecha</th><th>Capital</th><th>Intereses</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  ${loan.amortizationTable.slice(0, 24).map(row => `
                    <tr>
                      <td>${row.payment}</td>
                      <td>${row.date}</td>
                      <td>${fmtEUR(row.principalPayment)}</td>
                      <td>${fmtEUR(row.interestPayment)}</td>
                      <td>${fmtEUR(row.remainingBalance)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <div class="small muted">Mostrando primeras 24 cuotas de ${loan.amortizationTable.length}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  loansEl.innerHTML = loanCards;
  
  // Add delete functionality
  loansEl.querySelectorAll('.delete-loan').forEach(btn => {
    btn.onclick = () => {
      if (confirm('¿Estás seguro de que quieres eliminar este préstamo?')) {
        const id = parseInt(btn.getAttribute('data-id'));
        const currentLoans = getLoans();
        const filteredLoans = currentLoans.filter(l => l.id !== id);
        saveLoans(filteredLoans);
        view.mount(root);
      }
    };
  });
  
  // Add view schedule functionality
  loansEl.querySelectorAll('.view-schedule').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const scheduleEl = loansEl.querySelector(`#schedule-${id}`);
      const isVisible = scheduleEl.style.display !== 'none';
      
      scheduleEl.style.display = isVisible ? 'none' : 'block';
      btn.textContent = isVisible ? 'Ver cuadro completo' : 'Ocultar cuadro';
    };
  });
}

export default view;