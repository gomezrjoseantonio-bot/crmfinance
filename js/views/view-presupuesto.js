import { getBudget, saveBudget, getAccounts, getYear } from '../storage.js';
import { fmtEUR, parseEuro, groupBy } from '../utils.js';

const INCOME_CATEGORIES = [
  'Nómina', 'Alquiler piso', 'Trabajo autónomo'
];

const EXPENSE_CATEGORIES = [
  'Gastos personales', 'Hipoteca', 'Préstamo', 'Suministros', 'Alquiler pagado'
];

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function generateBudgetEntry(month, category, amount, bank, type, property = '') {
  return {
    id: Date.now() + Math.random(),
    month: month + 1, // 1-12
    category,
    amount: parseFloat(amount) || 0,
    bank,
    type, // 'income' | 'expense'
    property,
    validated: false,
    actualAmount: null
  };
}

const view = {
  route: '#/presupuesto', 
  title: 'Presupuesto',
  
  async mount(root) {
    const budget = getBudget();
    const accounts = getAccounts();
    const year = getYear();
    
    // Group budget by month
    const budgetByMonth = groupBy(budget, item => item.month);
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <h1>Presupuesto Anual ${year}</h1>
          <div class="muted">Planifica tus ingresos y gastos por mes</div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Crear entrada presupuestaria</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px;">
              <div>
                <label class="small muted">Mes</label>
                <select id="budgetMonth" style="width: 100%">
                  ${MONTHS.map((m, i) => `<option value="${i}">${m}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="small muted">Tipo</label>
                <select id="budgetType" style="width: 100%">
                  <option value="income">Ingreso</option>
                  <option value="expense">Gasto</option>
                </select>
              </div>
              <div>
                <label class="small muted">Categoría</label>
                <select id="budgetCategory" style="width: 100%">
                  ${INCOME_CATEGORIES.map(c => `<option value="${c}" data-type="income">${c}</option>`).join('')}
                  ${EXPENSE_CATEGORIES.map(c => `<option value="${c}" data-type="expense">${c}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="small muted">Banco</label>
                <select id="budgetBank" style="width: 100%">
                  ${accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="small muted">Importe (€)</label>
                <input type="number" id="budgetAmount" step="0.01" style="width: 100%" placeholder="0.00">
              </div>
              <div>
                <label class="small muted">Propiedad (opcional)</label>
                <input type="text" id="budgetProperty" style="width: 100%" placeholder="Piso A">
              </div>
            </div>
            <div style="margin-bottom: 10px;">
              <button id="addBudgetEntry" class="primary">Añadir entrada</button>
              <button id="deployToYear" style="margin-left: 10px;">Desplegar a todo el año</button>
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
      
      <div class="row" id="monthlyBudgets"></div>
    `;
    
    // Update category options based on type
    const typeSelect = root.querySelector('#budgetType');
    const categorySelect = root.querySelector('#budgetCategory');
    
    function updateCategories() {
      const type = typeSelect.value;
      const options = categorySelect.querySelectorAll('option');
      options.forEach(opt => {
        const optType = opt.getAttribute('data-type');
        opt.style.display = optType === type ? 'block' : 'none';
        if (optType === type && !categorySelect.value) {
          opt.selected = true;
        }
      });
    }
    
    typeSelect.addEventListener('change', updateCategories);
    updateCategories();
    
    // Add budget entry
    root.querySelector('#addBudgetEntry').onclick = () => {
      const month = parseInt(root.querySelector('#budgetMonth').value);
      const type = root.querySelector('#budgetType').value;
      const category = root.querySelector('#budgetCategory').value;
      const bank = root.querySelector('#budgetBank').value;
      const amount = parseFloat(root.querySelector('#budgetAmount').value);
      const property = root.querySelector('#budgetProperty').value;
      
      if (!amount || amount === 0) {
        alert('Por favor, introduce un importe válido');
        return;
      }
      
      const actualAmount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
      const entry = generateBudgetEntry(month, category, actualAmount, bank, type, property);
      
      const currentBudget = getBudget();
      currentBudget.push(entry);
      saveBudget(currentBudget);
      
      // Reset form
      root.querySelector('#budgetAmount').value = '';
      root.querySelector('#budgetProperty').value = '';
      
      // Refresh view
      view.mount(root);
    };
    
    // Deploy to year
    root.querySelector('#deployToYear').onclick = () => {
      const month = parseInt(root.querySelector('#budgetMonth').value);
      const type = root.querySelector('#budgetType').value;
      const category = root.querySelector('#budgetCategory').value;
      const bank = root.querySelector('#budgetBank').value;
      const amount = parseFloat(root.querySelector('#budgetAmount').value);
      const property = root.querySelector('#budgetProperty').value;
      
      if (!amount || amount === 0) {
        alert('Por favor, introduce un importe válido');
        return;
      }
      
      const actualAmount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
      const currentBudget = getBudget();
      
      // Add entry for all 12 months
      for (let m = 0; m < 12; m++) {
        const entry = generateBudgetEntry(m, category, actualAmount, bank, type, property);
        currentBudget.push(entry);
      }
      
      saveBudget(currentBudget);
      
      // Reset form
      root.querySelector('#budgetAmount').value = '';
      root.querySelector('#budgetProperty').value = '';
      
      alert('Entrada desplegada a todos los meses del año');
      
      // Refresh view
      view.mount(root);
    };
    
    // Render annual summary
    renderAnnualSummary(root, budget);
    
    // Render monthly budgets
    renderMonthlyBudgets(root, budgetByMonth, accounts);
  }
};

function renderAnnualSummary(root, budget) {
  const totalIncome = budget.filter(b => b.amount > 0).reduce((sum, b) => sum + b.amount, 0);
  const totalExpense = budget.filter(b => b.amount < 0).reduce((sum, b) => sum + b.amount, 0);
  const net = totalIncome + totalExpense;
  
  const summaryEl = root.querySelector('#annualSummary');
  summaryEl.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
      <div class="text-center">
        <div class="small muted">Ingresos anuales</div>
        <div class="kpi" style="color: green;">${fmtEUR(totalIncome)}</div>
      </div>
      <div class="text-center">
        <div class="small muted">Gastos anuales</div>
        <div class="kpi" style="color: red;">${fmtEUR(totalExpense)}</div>
      </div>
      <div class="text-center">
        <div class="small muted">Neto anual</div>
        <div class="kpi" style="color: ${net >= 0 ? 'green' : 'red'};">${fmtEUR(net)}</div>
      </div>
    </div>
  `;
}

function renderMonthlyBudgets(root, budgetByMonth, accounts) {
  const monthlyEl = root.querySelector('#monthlyBudgets');
  
  const monthCards = MONTHS.map((monthName, monthIndex) => {
    const monthData = budgetByMonth[monthIndex + 1] || [];
    const income = monthData.filter(b => b.amount > 0).reduce((sum, b) => sum + b.amount, 0);
    const expense = monthData.filter(b => b.amount < 0).reduce((sum, b) => sum + b.amount, 0);
    const net = income + expense;
    
    const byBank = groupBy(monthData, b => b.bank);
    
    const bankDetails = Object.entries(byBank).map(([bank, items]) => {
      const bankIncome = items.filter(b => b.amount > 0).reduce((sum, b) => sum + b.amount, 0);
      const bankExpense = items.filter(b => b.amount < 0).reduce((sum, b) => sum + b.amount, 0);
      const bankNet = bankIncome + bankExpense;
      
      const itemsList = items.map(item => `
        <tr>
          <td>${item.category}</td>
          <td style="text-align:right">${fmtEUR(item.amount)}</td>
          <td>${item.property || '-'}</td>
          <td>
            <button class="small delete-budget" data-id="${item.id}">×</button>
          </td>
        </tr>
      `).join('');
      
      return `
        <div style="margin-bottom: 10px;">
          <h4>${bank} (${fmtEUR(bankNet)})</h4>
          <table style="width: 100%; font-size: 0.9em;">
            <thead>
              <tr><th>Concepto</th><th>Importe</th><th>Propiedad</th><th></th></tr>
            </thead>
            <tbody>${itemsList}</tbody>
          </table>
        </div>
      `;
    }).join('');
    
    return `
      <div class="col-md-4" style="margin-bottom: 20px;">
        <div class="card">
          <h3>${monthName}</h3>
          <div class="small">
            Ingresos: <span style="color: green;"><b>${fmtEUR(income)}</b></span> · 
            Gastos: <span style="color: red;"><b>${fmtEUR(expense)}</b></span> · 
            Neto: <span style="color: ${net >= 0 ? 'green' : 'red'};"><b>${fmtEUR(net)}</b></span>
          </div>
          <div style="margin-top: 10px;">
            ${bankDetails}
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  monthlyEl.innerHTML = monthCards;
  
  // Add delete functionality
  monthlyEl.querySelectorAll('.delete-budget').forEach(btn => {
    btn.onclick = () => {
      const id = parseFloat(btn.getAttribute('data-id'));
      const budget = getBudget();
      const filteredBudget = budget.filter(b => b.id !== id);
      saveBudget(filteredBudget);
      view.mount(root);
    };
  });
}

export default view;