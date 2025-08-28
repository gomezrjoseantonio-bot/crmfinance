import { getPMA, savePMA, getAccounts, getTaxTables, saveTaxTables } from '../storage.js';
import { fmtEUR, calculateNetSalary } from '../utils.js';

const view = {
  route: '#/pma',
  title: 'Plan Maestro Anual',
  
  async mount(root) {
    const pma = getPMA();
    const accounts = getAccounts();
    const taxTables = getTaxTables();
    
    // Initialize default PMA structure if empty
    if (!pma.salary) {
      pma.salary = {
        grossAnnual: 50000,
        extraPayMonths: [6, 12],
        variableByMonth: {},
        payDay: 25,
        accountId: accounts[0]?.id || 'SANTANDER'
      };
    }
    if (!pma.freelance) pma.freelance = [];
    if (!pma.company) pma.company = [];
    if (!pma.rentals) pma.rentals = [];
    if (!pma.loans) pma.loans = [];
    if (!pma.pensions) pma.pensions = [];
    
    const accountOptions = accounts.map(a => `<option value="${a.id}" ${pma.salary.accountId === a.id ? 'selected' : ''}>${a.name}</option>`).join('');
    
    const netSalary = calculateNetSalary(pma.salary.grossAnnual, taxTables);
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>Plan Maestro Anual</h1>
            <div class="small muted">Configura tus ingresos y gastos recurrentes principales</div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>💰 Nómina</h2>
            <div class="row">
              <div class="col">
                <label class="small muted">Bruto anual (€)</label><br/>
                <input type="number" id="grossAnnual" value="${pma.salary.grossAnnual}" style="width:140px">
              </div>
              <div class="col">
                <label class="small muted">Día de cobro</label><br/>
                <input type="number" id="payDay" value="${pma.salary.payDay}" min="1" max="31" style="width:80px">
              </div>
              <div class="col">
                <label class="small muted">Cuenta destino</label><br/>
                <select id="accountId" style="width:180px">${accountOptions}</select>
              </div>
            </div>
            
            <div style="margin-top:10px">
              <label class="small muted">Meses con paga extra (separados por coma)</label><br/>
              <input type="text" id="extraPayMonths" value="${pma.salary.extraPayMonths.join(',')}" placeholder="6,12" style="width:140px">
            </div>
            
            <div style="margin-top:10px; padding:10px; background:var(--card); border:1px solid var(--border); border-radius:8px">
              <div class="small muted">Neto mensual estimado: <strong>${fmtEUR(netSalary)}</strong></div>
              <div class="small muted">Neto anual estimado: <strong>${fmtEUR(netSalary * 12)}</strong></div>
            </div>
            
            <button id="saveSalary" class="primary" style="margin-top:10px">Guardar nómina</button>
          </div>
        </div>
        
        <div class="col">
          <div class="card">
            <h2>📊 Tablas fiscales (IRPF y SS)</h2>
            <div class="small muted">Editable para ajustar cálculos</div>
            
            <h3>IRPF</h3>
            <div class="grid">
              <table>
                <thead>
                  <tr><th>Desde</th><th>Hasta</th><th>Tipo (%)</th></tr>
                </thead>
                <tbody id="irpfTable">
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
            
            <h3>Seguridad Social</h3>
            <div>
              <label class="small muted">Tipo (%)</label><br/>
              <input type="number" id="ssRate" value="${(taxTables.ss.rate * 100).toFixed(2)}" step="0.01" style="width:80px">%
            </div>
            <div style="margin-top:5px">
              <label class="small muted">Base máxima mensual</label><br/>
              <input type="number" id="ssMax" value="${taxTables.ss.max}" step="0.01" style="width:120px">€
            </div>
            
            <button id="saveTaxes" class="primary" style="margin-top:10px">Guardar tablas</button>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>🏠 Alquileres</h2>
            <div class="small muted">Próximamente - gestión de propiedades y contratos</div>
            <div style="padding:20px; text-align:center; color:var(--muted)">
              Funcionalidad pendiente de implementar
            </div>
          </div>
        </div>
        
        <div class="col">
          <div class="card">
            <h2>🏦 Préstamos</h2>
            <div class="small muted">Próximamente - sistema de amortización francesa</div>
            <div style="padding:20px; text-align:center; color:var(--muted)">
              Funcionalidad pendiente de implementar
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Event handlers
    root.querySelector('#saveSalary').onclick = () => {
      pma.salary.grossAnnual = parseFloat(root.querySelector('#grossAnnual').value) || 0;
      pma.salary.payDay = parseInt(root.querySelector('#payDay').value) || 25;
      pma.salary.accountId = root.querySelector('#accountId').value;
      pma.salary.extraPayMonths = root.querySelector('#extraPayMonths').value
        .split(',')
        .map(m => parseInt(m.trim()))
        .filter(m => m >= 1 && m <= 12);
      
      savePMA(pma);
      alert('Nómina guardada correctamente');
      view.mount(root); // Refresh to show updated calculations
    };
    
    root.querySelector('#saveTaxes').onclick = () => {
      const updatedTaxTables = getTaxTables();
      updatedTaxTables.ss.rate = parseFloat(root.querySelector('#ssRate').value) / 100 || 0.0635;
      updatedTaxTables.ss.max = parseFloat(root.querySelector('#ssMax').value) || 4495.50;
      
      saveTaxTables(updatedTaxTables);
      alert('Tablas fiscales guardadas correctamente');
      view.mount(root); // Refresh to show updated calculations
    };
  }
};

export default view;