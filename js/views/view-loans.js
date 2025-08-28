import { calculateFrenchAmortization, fmtEUR, parseEuro, fmtDateISO } from '../utils.js';

const view = {
  route: '#/loans',
  title: 'Préstamos',
  
  async mount(root) {
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>🏦 Préstamos y Hipotecas</h1>
            <div class="small muted">Sistema de amortización francesa con simulador</div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>💰 Simulador de préstamo</h2>
            
            <div class="row">
              <div class="col">
                <label class="small muted">Capital (€)</label><br/>
                <input type="number" id="principal" value="200000" step="1000" style="width:140px">
              </div>
              <div class="col">
                <label class="small muted">Tipo anual (%)</label><br/>
                <input type="number" id="rate" value="3.5" step="0.1" style="width:100px">
              </div>
              <div class="col">
                <label class="small muted">Años</label><br/>
                <input type="number" id="years" value="30" min="1" max="40" style="width:80px">
              </div>
            </div>
            
            <div style="margin-top:15px">
              <button id="calculate" class="primary">🧮 Calcular amortización</button>
              <button id="simulate" style="margin-left:10px">📊 Simular amortización anticipada</button>
            </div>
            
            <div id="results" style="margin-top:15px"></div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📋 Cuadro de amortización</h2>
            <div id="amortizationTable"></div>
          </div>
        </div>
      </div>
    `;
    
    // Event handlers
    root.querySelector('#calculate').onclick = () => {
      calculateLoan(root);
    };
    
    root.querySelector('#simulate').onclick = () => {
      simulateEarlyPayment(root);
    };
    
    // Calculate by default
    calculateLoan(root);
  }
};

function calculateLoan(root) {
  const principal = parseFloat(root.querySelector('#principal').value) || 0;
  const annualRate = (parseFloat(root.querySelector('#rate').value) || 0) / 100;
  const years = parseInt(root.querySelector('#years').value) || 0;
  
  if (principal <= 0 || annualRate <= 0 || years <= 0) {
    root.querySelector('#results').innerHTML = '<div class="small" style="color:red">Por favor, introduce valores válidos</div>';
    return;
  }
  
  const schedule = calculateFrenchAmortization(principal, annualRate, years);
  
  if (schedule.length === 0) {
    root.querySelector('#results').innerHTML = '<div class="small" style="color:red">Error en el cálculo</div>';
    return;
  }
  
  const monthlyPayment = schedule[0].payment;
  const totalInterest = schedule.reduce((sum, payment) => sum + payment.interest, 0);
  const totalPaid = principal + totalInterest;
  
  // Results summary
  root.querySelector('#results').innerHTML = `
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
  
  root.querySelector('#amortizationTable').innerHTML = `
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
  
  const principal = parseFloat(root.querySelector('#principal').value) || 0;
  const annualRate = (parseFloat(root.querySelector('#rate').value) || 0) / 100;
  const years = parseInt(root.querySelector('#years').value) || 0;
  
  // Calculate original schedule
  const originalSchedule = calculateFrenchAmortization(principal, annualRate, years);
  
  // Calculate with early payment (assume payment after 12 months)
  const monthlyRate = annualRate / 12;
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

export default view;