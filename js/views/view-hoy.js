import { getReal, getBudgetAlerts, getBudgets, getCategories } from '../storage.js'; import { fmtEUR, groupBy } from '../utils.js';
const view = {
  route:'#/hoy', title:'Hoy',
  async mount(root){
    const rows = getReal();
    const alerts = getBudgetAlerts();
    const budgets = getBudgets();
    const categories = getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    
    const monthIncome = rows.filter(r=>r.amount>0).reduce((a,b)=>a+b.amount,0);
    const monthNet = rows.reduce((a,b)=>a+b.amount,0);
    
    // Calculate current month spending by category for budget tracking
    const currentMonth = new Date().toISOString().substring(0, 7);
    const monthlyRows = rows.filter(r => r.date.startsWith(currentMonth));
    const categorySpending = {};
    
    monthlyRows.forEach(row => {
      if (row.amount < 0 && row.category) {
        categorySpending[row.category] = (categorySpending[row.category] || 0) + Math.abs(row.amount);
      }
    });
    
    // Create budget progress cards
    const budgetCards = budgets.map(budget => {
      const spent = categorySpending[budget.categoryId] || 0;
      const category = catMap[budget.categoryId];
      if (!category) return '';
      
      const percentage = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0;
      const barColor = percentage >= 100 ? '#ef4444' : percentage >= 80 ? '#f59e0b' : '#10b981';
      
      return `<div class="col">
        <div class="card">
          <h3>${category.name}</h3>
          <div class="small muted">Presupuesto mensual</div>
          <div>${fmtEUR(spent)} / ${fmtEUR(budget.monthlyLimit)}</div>
          <div style="background:#e5e7eb;border-radius:4px;height:8px;margin:8px 0;overflow:hidden">
            <div style="background:${barColor};height:100%;width:${Math.min(percentage, 100)}%;transition:width 0.3s"></div>
          </div>
          <div class="small">${percentage.toFixed(1)}% usado</div>
        </div>
      </div>`;
    }).join('');
    
    // Create alerts section
    const alertsHtml = alerts.length > 0 ? `
      <div class="row">
        <div class="col">
          <div class="card" style="border-left:4px solid ${alerts.some(a=>a.level==='danger')?'#ef4444':'#f59e0b'}">
            <h2>⚠️ Alertas</h2>
            ${alerts.map(alert => `
              <div class="small" style="color:${alert.level==='danger'?'#ef4444':'#f59e0b'};margin-bottom:4px">
                ${alert.message}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    ` : '';
    
    root.innerHTML = `
      <div class="row">
        <div class="col"><div class="card">
          <h1>Hoy</h1>
          <div class="muted">Panel rápido.</div>
        </div></div>
      </div>
      ${alertsHtml}
      <div class="row">
        <div class="col"><div class="card"><h2>Ingresos del mes</h2><div class="kpi">${fmtEUR(monthIncome)}</div></div></div>
        <div class="col"><div class="card"><h2>Neto del mes</h2><div class="kpi">${fmtEUR(monthNet)}</div></div></div>
      </div>
      ${budgetCards ? `<div class="row">${budgetCards}</div>` : ''}`;
  }
};
export default view;
