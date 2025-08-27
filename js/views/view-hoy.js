import { getReal, getAccounts } from '../storage.js'; 
import { fmtEUR, groupBy, showError } from '../utils.js';

const view = {
  route:'#/hoy', title:'Hoy',
  async mount(root){
    try {
      const rows = getReal();
      const accounts = getAccounts();
      
      // Cálculos básicos
      const monthIncome = rows.filter(r=>r.amount>0).reduce((a,b)=>a+b.amount,0);
      const monthExpenses = rows.filter(r=>r.amount<0).reduce((a,b)=>a+b.amount,0);
      const monthNet = monthIncome + monthExpenses;
      
      // Transacciones recientes (últimas 5)
      const recentTransactions = rows
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);
      
      // Análisis por bancos
      const byBank = groupBy(rows, r=>r.bank||'SIN_BANCO');
      const bankAnalysis = Object.entries(byBank).map(([bank, transactions]) => {
        const balance = transactions.reduce((sum, t) => sum + t.amount, 0);
        const account = accounts.find(acc => acc.id === bank);
        const threshold = account?.threshold || 0;
        const isLowBalance = balance < threshold;
        
        return {
          bank,
          balance,
          threshold,
          isLowBalance,
          transactions: transactions.length
        };
      });
      
      // Top gastos del mes
      const topExpenses = rows
        .filter(r => r.amount < 0)
        .sort((a, b) => a.amount - b.amount)
        .slice(0, 3);
      
      // Gastos por categoría (basado en palabras clave del concepto)
      const categoryKeywords = {
        'Vivienda': ['alquiler', 'hipoteca', 'gas', 'luz', 'agua', 'internet', 'teléfono'],
        'Transporte': ['gasolina', 'metro', 'bus', 'taxi', 'parking', 'combustible'],
        'Alimentación': ['supermercado', 'mercadona', 'carrefour', 'restaurante', 'comida'],
        'Servicios': ['banco', 'comisión', 'seguro', 'médico', 'farmacia'],
        'Ocio': ['cine', 'teatro', 'bar', 'entretenimiento', 'spotify', 'netflix']
      };
      
      const expensesByCategory = {};
      rows.filter(r => r.amount < 0).forEach(transaction => {
        const concept = transaction.concept.toLowerCase();
        let categorized = false;
        
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
          if (keywords.some(keyword => concept.includes(keyword))) {
            expensesByCategory[category] = (expensesByCategory[category] || 0) + Math.abs(transaction.amount);
            categorized = true;
            break;
          }
        }
        
        if (!categorized) {
          expensesByCategory['Otros'] = (expensesByCategory['Otros'] || 0) + Math.abs(transaction.amount);
        }
      });
      
      root.innerHTML = `
        <div class="row">
          <div class="col"><div class="card">
            <h1>Dashboard Financiero</h1>
            <div class="muted">Resumen de tu situación financiera actual</div>
          </div></div>
        </div>
        
        <!-- KPIs principales -->
        <div class="row">
          <div class="col"><div class="card">
            <h2>Ingresos del mes</h2>
            <div class="kpi" style="color:#059669">${fmtEUR(monthIncome)}</div>
          </div></div>
          <div class="col"><div class="card">
            <h2>Gastos del mes</h2>
            <div class="kpi" style="color:#dc2626">${fmtEUR(monthExpenses)}</div>
          </div></div>
          <div class="col"><div class="card">
            <h2>Balance neto</h2>
            <div class="kpi" style="color:${monthNet >= 0 ? '#059669' : '#dc2626'}">${fmtEUR(monthNet)}</div>
          </div></div>
        </div>
        
        <div class="row">
          <!-- Análisis por bancos -->
          <div class="col"><div class="card">
            <h2>Estado de Cuentas</h2>
            ${bankAnalysis.length > 0 ? `
              <div class="grid" style="margin-top:8px">
                <table>
                  <thead><tr><th>Banco</th><th>Balance</th><th>Estado</th><th>Movs.</th></tr></thead>
                  <tbody>
                    ${bankAnalysis.map(bank => `
                      <tr>
                        <td>${bank.bank}</td>
                        <td style="text-align:right">${fmtEUR(bank.balance)}</td>
                        <td>
                          ${bank.isLowBalance ? 
                            '<span style="color:#dc2626">⚠️ Bajo umbral</span>' : 
                            '<span style="color:#059669">✅ OK</span>'
                          }
                        </td>
                        <td style="text-align:center">${bank.transactions}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : '<div class="small muted">No hay cuentas configuradas</div>'}
          </div></div>
          
          <!-- Transacciones recientes -->
          <div class="col"><div class="card">
            <h2>Movimientos Recientes</h2>
            ${recentTransactions.length > 0 ? `
              <div style="margin-top:8px">
                ${recentTransactions.map(t => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                    <div>
                      <div style="font-weight:500">${t.concept}</div>
                      <div class="small muted">${t.date} · ${t.bank}</div>
                    </div>
                    <div style="text-align:right;color:${t.amount >= 0 ? '#059669' : '#dc2626'}">${fmtEUR(t.amount)}</div>
                  </div>
                `).join('')}
              </div>
            ` : '<div class="small muted">No hay transacciones</div>'}
          </div></div>
        </div>
        
        <div class="row">
          <!-- Mayores gastos -->
          <div class="col"><div class="card">
            <h2>Mayores Gastos del Mes</h2>
            ${topExpenses.length > 0 ? `
              <div style="margin-top:8px">
                ${topExpenses.map((expense, index) => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
                    <div>
                      <span style="background:var(--accent);color:white;padding:2px 6px;border-radius:4px;font-size:12px;margin-right:8px">${index + 1}</span>
                      <span style="font-weight:500">${expense.concept}</span>
                      <div class="small muted">${expense.date}</div>
                    </div>
                    <div style="text-align:right;color:#dc2626;font-weight:700">${fmtEUR(expense.amount)}</div>
                  </div>
                `).join('')}
              </div>
            ` : '<div class="small muted">No hay gastos registrados</div>'}
          </div></div>
          
          <!-- Gastos por categoría -->
          <div class="col"><div class="card">
            <h2>Gastos por Categoría</h2>
            ${Object.keys(expensesByCategory).length > 0 ? `
              <div style="margin-top:8px">
                ${Object.entries(expensesByCategory)
                  .sort(([,a], [,b]) => b - a)
                  .map(([category, amount]) => {
                    const percentage = monthExpenses !== 0 ? (amount / Math.abs(monthExpenses)) * 100 : 0;
                    return `
                      <div style="margin-bottom:12px">
                        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                          <span style="font-weight:500">${category}</span>
                          <span>${fmtEUR(-amount)} (${percentage.toFixed(1)}%)</span>
                        </div>
                        <div style="background:var(--border);height:6px;border-radius:3px;overflow:hidden">
                          <div style="background:var(--accent);height:100%;width:${percentage}%;transition:width 0.3s ease"></div>
                        </div>
                      </div>
                    `;
                  }).join('')}
              </div>
            ` : '<div class="small muted">No hay gastos categorizados</div>'}
          </div></div>
        </div>
        
        <!-- Alertas y recomendaciones -->
        <div class="row">
          <div class="col"><div class="card">
            <h2>💡 Insights y Alertas</h2>
            <div style="margin-top:8px">
              ${(() => {
                const alerts = [];
                
                // Alertas de balance bajo
                bankAnalysis.forEach(bank => {
                  if (bank.isLowBalance) {
                    alerts.push(`⚠️ La cuenta <b>${bank.bank}</b> está por debajo del umbral configurado (${fmtEUR(bank.threshold)})`);
                  }
                });
                
                // Alerta de balance negativo
                if (monthNet < 0) {
                  alerts.push(`📉 Este mes tienes un balance negativo de <b>${fmtEUR(monthNet)}</b>`);
                }
                
                // Recomendación de ahorro
                if (monthNet > 0) {
                  const savingsRate = (monthNet / monthIncome) * 100;
                  if (savingsRate < 10) {
                    alerts.push(`💰 Tu tasa de ahorro es del ${savingsRate.toFixed(1)}%. Considera ahorrar al menos el 10% de tus ingresos.`);
                  } else {
                    alerts.push(`🎉 ¡Excelente! Estás ahorrando el ${savingsRate.toFixed(1)}% de tus ingresos.`);
                  }
                }
                
                // Sin transacciones
                if (rows.length === 0) {
                  alerts.push(`📊 No hay transacciones registradas. <a href="#/importar">Importa tus movimientos</a> para comenzar.`);
                }
                
                return alerts.length > 0 ? 
                  alerts.map(alert => `<div style="padding:8px;margin-bottom:8px;background:color-mix(in srgb, var(--accent) 10%, var(--card));border-left:3px solid var(--accent);border-radius:4px">${alert}</div>`).join('') :
                  '<div class="small muted">Todo parece estar en orden 👍</div>';
              })()}
            </div>
          </div></div>
        </div>
      `;
      
    } catch (error) {
      showError(`Error al cargar dashboard: ${error.message}`);
      root.innerHTML = `
        <div class="row">
          <div class="col"><div class="card">
            <h1>Error</h1>
            <div class="muted">No se pudo cargar el dashboard. ${error.message}</div>
          </div></div>
        </div>
      `;
    }
  }
};
export default view;
