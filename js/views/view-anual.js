import { getReal, getBudget, getAccounts, getYear } from '../storage.js';
import { fmtEUR, groupBy } from '../utils.js';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const view = {
  route: '#/anual',
  title: 'Vista Anual',
  
  async mount(root) {
    const real = getReal();
    const budget = getBudget();
    const accounts = getAccounts();
    const year = getYear();
    
    // Check accounts data integrity
    if (!Array.isArray(accounts) || accounts.length === 0) {
      console.warn('Accounts data is not properly loaded, using fallback');
      accounts = [
        {id:'SANTANDER', name:'Santander', threshold:200},
        {id:'BBVA', name:'BBVA', threshold:200},
        {id:'CAIXABANK', name:'CaixaBank', threshold:300},
        {id:'BANKINTER', name:'Bankinter', threshold:250},
        {id:'ING', name:'ING', threshold:150},
        {id:'OPENBANK', name:'Openbank', threshold:100},
        {id:'BANCO_SABADELL', name:'Banco Sabadell', threshold:200},
        {id:'UNICAJA', name:'Unicaja', threshold:180}
      ];
    }
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <h1>Vista Anual ${year}</h1>
          <div class="muted">Overview anual con presupuesto vs realidad</div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Filtros</h2>
            <div style="display: flex; gap: 10px; align-items: end;">
              <div>
                <label class="small muted">Banco</label>
                <select id="bankFilter" style="width: 200px;">
                  <option value="">Todos los bancos</option>
                  ${accounts && Array.isArray(accounts) ? accounts.map(a => `<option value="${a.id || ''}">${a.name || a.id || 'Sin nombre'}</option>`).join('') : ''}
                </select>
              </div>
              <button id="applyFilter" class="primary">Aplicar filtro</button>
              <button id="transferRecommendations" class="secondary">Recomendaciones de transferencia</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Resumen anual</h2>
            <div id="annualSummary"></div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Comparativa mensual: Presupuesto vs Realidad</h2>
            <div id="monthlyComparison"></div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Análisis por banco</h2>
            <div id="bankAnalysis"></div>
          </div>
        </div>
      </div>
      
      <div id="transferModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000;">
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; max-width: 600px; width: 90%;">
          <h3>Recomendaciones de transferencia</h3>
          <div id="transferContent"></div>
          <button id="closeModal" style="margin-top: 15px;">Cerrar</button>
        </div>
      </div>
    `;
    
    let selectedBank = '';
    
    // Apply filter
    root.querySelector('#applyFilter').onclick = () => {
      selectedBank = root.querySelector('#bankFilter').value;
      renderData();
    };
    
    // Transfer recommendations
    root.querySelector('#transferRecommendations').onclick = () => {
      showTransferRecommendations();
    };
    
    // Close modal
    root.querySelector('#closeModal').onclick = () => {
      root.querySelector('#transferModal').style.display = 'none';
    };
    
    function renderData() {
      renderAnnualSummary(selectedBank);
      renderMonthlyComparison(selectedBank);
      renderBankAnalysis(selectedBank);
    }
    
    function renderAnnualSummary(bankFilter = '') {
      const summaryEl = root.querySelector('#annualSummary');
      
      // Filter data by bank if needed
      const filteredReal = bankFilter ? real.filter(r => r.bank === bankFilter) : real;
      const filteredBudget = bankFilter ? budget.filter(b => b.bank === bankFilter) : budget;
      
      const realIncome = filteredReal.filter(r => r.amount > 0).reduce((sum, r) => sum + r.amount, 0);
      const realExpenses = Math.abs(filteredReal.filter(r => r.amount < 0).reduce((sum, r) => sum + r.amount, 0));
      const realNet = realIncome - realExpenses;
      
      const budgetIncome = filteredBudget.filter(b => b.amount > 0).reduce((sum, b) => sum + b.amount, 0);
      const budgetExpenses = Math.abs(filteredBudget.filter(b => b.amount < 0).reduce((sum, b) => sum + b.amount, 0));
      const budgetNet = budgetIncome - budgetExpenses;
      
      const incomeDiff = realIncome - budgetIncome;
      const expensesDiff = realExpenses - budgetExpenses;
      const netDiff = realNet - budgetNet;
      
      summaryEl.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          <div class="text-center">
            <div class="small muted">Ingresos</div>
            <div>Real: <span style="color: green;"><b>${fmtEUR(realIncome)}</b></span></div>
            <div>Presupuesto: <span class="muted"><b>${fmtEUR(budgetIncome)}</b></span></div>
            <div>Diferencia: <span style="color: ${incomeDiff >= 0 ? 'green' : 'red'};"><b>${fmtEUR(incomeDiff)}</b></span></div>
          </div>
          
          <div class="text-center">
            <div class="small muted">Gastos</div>
            <div>Real: <span style="color: red;"><b>${fmtEUR(realExpenses)}</b></span></div>
            <div>Presupuesto: <span class="muted"><b>${fmtEUR(budgetExpenses)}</b></span></div>
            <div>Diferencia: <span style="color: ${expensesDiff <= 0 ? 'green' : 'red'};"><b>${fmtEUR(expensesDiff)}</b></span></div>
          </div>
          
          <div class="text-center">
            <div class="small muted">Neto</div>
            <div>Real: <span style="color: ${realNet >= 0 ? 'green' : 'red'};"><b>${fmtEUR(realNet)}</b></span></div>
            <div>Presupuesto: <span class="muted"><b>${fmtEUR(budgetNet)}</b></span></div>
            <div>Diferencia: <span style="color: ${netDiff >= 0 ? 'green' : 'red'};"><b>${fmtEUR(netDiff)}</b></span></div>
          </div>
        </div>
        
        ${bankFilter ? `<div class="small muted" style="margin-top: 10px; text-align: center;">Filtrado por: ${accounts.find(a => a.id === bankFilter)?.name || bankFilter}</div>` : ''}
      `;
    }
    
    function renderMonthlyComparison(bankFilter = '') {
      const comparisonEl = root.querySelector('#monthlyComparison');
      
      // Group by month
      const realByMonth = groupBy(real, r => {
        const date = new Date(r.date);
        return date.getMonth() + 1;
      });
      
      const budgetByMonth = groupBy(budget, b => b.month);
      
      const monthlyData = MONTHS.map((monthName, index) => {
        const monthNum = index + 1;
        const monthReal = (realByMonth[monthNum] || []).filter(r => !bankFilter || r.bank === bankFilter);
        const monthBudget = (budgetByMonth[monthNum] || []).filter(b => !bankFilter || b.bank === bankFilter);
        
        const realIncome = monthReal.filter(r => r.amount > 0).reduce((sum, r) => sum + r.amount, 0);
        const realExpenses = Math.abs(monthReal.filter(r => r.amount < 0).reduce((sum, r) => sum + r.amount, 0));
        const realNet = realIncome - realExpenses;
        
        const budgetIncome = monthBudget.filter(b => b.amount > 0).reduce((sum, b) => sum + b.amount, 0);
        const budgetExpenses = Math.abs(monthBudget.filter(b => b.amount < 0).reduce((sum, b) => sum + b.amount, 0));
        const budgetNet = budgetIncome - budgetExpenses;
        
        return {
          month: monthName,
          realIncome, realExpenses, realNet,
          budgetIncome, budgetExpenses, budgetNet,
          incomeDiff: realIncome - budgetIncome,
          expensesDiff: realExpenses - budgetExpenses,
          netDiff: realNet - budgetNet
        };
      });
      
      comparisonEl.innerHTML = `
        <div style="overflow-x: auto;">
          <table style="width: 100%; font-size: 0.9em;">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Ingresos Real</th>
                <th>Ingresos Ppto</th>
                <th>Dif. Ingresos</th>
                <th>Gastos Real</th>
                <th>Gastos Ppto</th>
                <th>Dif. Gastos</th>
                <th>Neto Real</th>
                <th>Neto Ppto</th>
                <th>Dif. Neto</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyData.map(data => `
                <tr>
                  <td><b>${data.month}</b></td>
                  <td style="color: green;">${fmtEUR(data.realIncome)}</td>
                  <td class="muted">${fmtEUR(data.budgetIncome)}</td>
                  <td style="color: ${data.incomeDiff >= 0 ? 'green' : 'red'};">${fmtEUR(data.incomeDiff)}</td>
                  <td style="color: red;">${fmtEUR(data.realExpenses)}</td>
                  <td class="muted">${fmtEUR(data.budgetExpenses)}</td>
                  <td style="color: ${data.expensesDiff <= 0 ? 'green' : 'red'};">${fmtEUR(data.expensesDiff)}</td>
                  <td style="color: ${data.realNet >= 0 ? 'green' : 'red'};">${fmtEUR(data.realNet)}</td>
                  <td class="muted">${fmtEUR(data.budgetNet)}</td>
                  <td style="color: ${data.netDiff >= 0 ? 'green' : 'red'};">${fmtEUR(data.netDiff)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    function renderBankAnalysis(bankFilter = '') {
      const analysisEl = root.querySelector('#bankAnalysis');
      
      const banksToShow = bankFilter ? [bankFilter] : accounts.map(a => a.id);
      
      const bankData = banksToShow.map(bankId => {
        const account = accounts.find(a => a.id === bankId);
        const bankReal = real.filter(r => r.bank === bankId);
        const bankBudget = budget.filter(b => b.bank === bankId);
        
        const realBalance = bankReal.reduce((sum, r) => sum + r.amount, 0);
        const budgetBalance = bankBudget.reduce((sum, b) => sum + b.amount, 0);
        const threshold = account?.threshold || 0;
        
        const isLowBalance = realBalance < threshold;
        const recommendation = isLowBalance ? 'Transferencia recomendada' : 'Saldo adecuado';
        
        return {
          bankId,
          name: account?.name || bankId,
          realBalance,
          budgetBalance,
          threshold,
          isLowBalance,
          recommendation
        };
      });
      
      analysisEl.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          ${bankData.map(bank => `
            <div class="card" style="border: ${bank.isLowBalance ? '2px solid orange' : '1px solid #ddd'};">
              <h4>${bank.name}</h4>
              <div>
                <div class="small muted">Saldo real</div>
                <div style="color: ${bank.realBalance >= 0 ? 'green' : 'red'};"><b>${fmtEUR(bank.realBalance)}</b></div>
              </div>
              <div style="margin-top: 5px;">
                <div class="small muted">Saldo presupuestado</div>
                <div class="muted"><b>${fmtEUR(bank.budgetBalance)}</b></div>
              </div>
              <div style="margin-top: 5px;">
                <div class="small muted">Umbral mínimo</div>
                <div><b>${fmtEUR(bank.threshold)}</b></div>
              </div>
              <div style="margin-top: 10px; padding: 5px; border-radius: 4px; background: ${bank.isLowBalance ? '#fff3cd' : '#d4edda'};">
                <div class="small" style="color: ${bank.isLowBalance ? '#856404' : '#155724'};">
                  ${bank.recommendation}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    function showTransferRecommendations() {
      const modal = root.querySelector('#transferModal');
      const content = root.querySelector('#transferContent');
      
      // Calculate bank balances and find recommendations
      const bankBalances = accounts.map(account => {
        const bankReal = real.filter(r => r.bank === account.id);
        const balance = bankReal.reduce((sum, r) => sum + r.amount, 0);
        return {
          ...account,
          balance,
          isLow: balance < account.threshold,
          surplus: balance - account.threshold
        };
      });
      
      const lowBalanceBanks = bankBalances.filter(b => b.isLow);
      const highBalanceBanks = bankBalances.filter(b => b.surplus > 1000).sort((a, b) => b.surplus - a.surplus);
      
      if (lowBalanceBanks.length === 0) {
        content.innerHTML = `
          <div class="text-center">
            <div style="color: green; margin-bottom: 10px;">✓ Todas las cuentas tienen saldos adecuados</div>
            <div class="small muted">No se requieren transferencias en este momento</div>
          </div>
        `;
      } else {
        const recommendations = lowBalanceBanks.map(lowBank => {
          const needed = lowBank.threshold - lowBank.balance;
          const bestSource = highBalanceBanks.find(highBank => highBank.surplus >= needed);
          
          return {
            target: lowBank,
            source: bestSource,
            amount: needed
          };
        });
        
        content.innerHTML = `
          <div>
            <div class="small muted" style="margin-bottom: 15px;">
              Recomendaciones para mantener los umbrales mínimos:
            </div>
            
            ${recommendations.map(rec => `
              <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px; background: #f8f9fa;">
                <div style="margin-bottom: 5px;">
                  <strong style="color: orange;">⚠ ${rec.target.name}</strong>
                  <div class="small">Saldo actual: ${fmtEUR(rec.target.balance)} (umbral: ${fmtEUR(rec.target.threshold)})</div>
                </div>
                
                ${rec.source ? `
                  <div style="color: green;">
                    <strong>→ Transferir ${fmtEUR(rec.amount)} desde ${rec.source.name}</strong>
                    <div class="small">Saldo disponible en ${rec.source.name}: ${fmtEUR(rec.source.balance)}</div>
                  </div>
                ` : `
                  <div style="color: red;">
                    <strong>⚠ No hay cuentas con suficiente saldo para transferir</strong>
                    <div class="small">Se necesitan ${fmtEUR(rec.amount)} adicionales</div>
                  </div>
                `}
              </div>
            `).join('')}
            
            <div style="margin-top: 15px; padding: 10px; background: #e9ecef; border-radius: 4px;">
              <div class="small muted">
                <strong>Resumen de cuentas:</strong>
                ${bankBalances.map(bank => `
                  <div>${bank.name}: ${fmtEUR(bank.balance)} ${bank.isLow ? '⚠' : '✓'}</div>
                `).join('')}
              </div>
            </div>
          </div>
        `;
      }
      
      modal.style.display = 'block';
    }
    
    // Initial render
    renderData();
  }
};

export default view;