import { calculateFrenchAmortization, fmtEUR } from '../utils.js';

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
      <button id="clearCalculator" style="margin-left:10px">🧹 Limpiar</button>
    </div>
    
    <div id="simResults" style="margin-top:15px"></div>
    <div id="simAmortizationTable" style="margin-top:15px"></div>
  `;
}

const view = {
  route: '#/calculator',
  title: '🧮 Calculadora',
  
  async mount(root) {
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>🧮 Calculadora de Préstamos</h1>
            <div class="small muted">Simula diferentes escenarios de préstamos y amortizaciones</div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>💰 Simulador de Préstamos</h2>
            ${renderSimulator()}
          </div>
        </div>
      </div>
    `;
    
    // Event handlers
    setupEventHandlers(root);
  }
};

function setupEventHandlers(root) {
  // Simulator buttons
  const calculateBtn = root.querySelector('#calculate');
  if (calculateBtn) {
    calculateBtn.onclick = () => calculateSimulation(root);
  }
  
  const simulateBtn = root.querySelector('#simulate');
  if (simulateBtn) {
    simulateBtn.onclick = () => simulateEarlyPayment(root);
  }
  
  const clearBtn = root.querySelector('#clearCalculator');
  if (clearBtn) {
    clearBtn.onclick = () => clearCalculator(root);
  }
}

function clearCalculator(root) {
  root.querySelector('#simPrincipal').value = '200000';
  root.querySelector('#simRate').value = '3.5';
  root.querySelector('#simYears').value = '30';
  root.querySelector('#simResults').innerHTML = '';
  root.querySelector('#simAmortizationTable').innerHTML = '';
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
    
    <div style="margin-top:15px">
      <button onclick="exportSimulationCSV()" class="primary">📊 Exportar CSV</button>
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

// Global function for CSV export
window.exportSimulationCSV = function() {
  const principal = parseFloat(document.querySelector('#simPrincipal').value) || 0;
  const annualRate = (parseFloat(document.querySelector('#simRate').value) || 0) / 100;
  const years = parseInt(document.querySelector('#simYears').value) || 0;
  
  if (principal <= 0 || annualRate <= 0 || years <= 0) {
    alert('Por favor, calcula una simulación primero');
    return;
  }
  
  const schedule = calculateFrenchAmortization(principal, annualRate, years);
  
  // Create CSV content
  let csvContent = 'Mes,Cuota,Capital,Interés,Pendiente\n';
  
  schedule.forEach(payment => {
    csvContent += `${payment.month},${payment.payment.toFixed(2)},${payment.principal.toFixed(2)},${payment.interest.toFixed(2)},${payment.balance.toFixed(2)}\n`;
  });
  
  // Add summary
  const totalInterest = schedule.reduce((sum, p) => sum + p.interest, 0);
  csvContent += '\n\nResumen:\n';
  csvContent += `Capital inicial,${principal.toFixed(2)}\n`;
  csvContent += `Tipo de interés,${(annualRate * 100).toFixed(2)}%\n`;
  csvContent += `Plazo,${years} años\n`;
  csvContent += `Cuota mensual,${schedule[0].payment.toFixed(2)}\n`;
  csvContent += `Total intereses,${totalInterest.toFixed(2)}\n`;
  csvContent += `Total a pagar,${(principal + totalInterest).toFixed(2)}\n`;
  
  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `simulacion_prestamo_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

export default view;