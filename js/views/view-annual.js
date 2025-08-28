import { getReal, getForecast, getYear } from '../storage.js';
import { fmtEUR, groupBy } from '../utils.js';

const view = {
  route: '#/annual',
  title: 'Presupuesto',
  
  async mount(root) {
    const year = getYear();
    const real = getReal(year);
    const forecast = getForecast(year);
    
    // Group data by month and category
    const annualData = generateAnnualComparison(real, forecast, year);
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>📊 Presupuesto vs Real ${year}</h1>
            <div class="small muted">Comparativa anual por categorías y bancos</div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>💰 Por categorías</h2>
            <div class="grid">
              <table>
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Presupuesto</th>
                    <th>Real</th>
                    <th>Desviación</th>
                    <th>% Cumplido</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateCategoryRows(annualData.categories)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>🏦 Por bancos</h2>
            <div class="grid">
              <table>
                <thead>
                  <tr>
                    <th>Banco</th>
                    <th>Presupuesto</th>
                    <th>Real</th>
                    <th>Desviación</th>
                    <th>% Cumplido</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateBankRows(annualData.banks)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📅 Evolución mensual</h2>
            <div class="grid">
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Ingresos Prev.</th>
                    <th>Ingresos Real</th>
                    <th>Gastos Prev.</th>
                    <th>Gastos Real</th>
                    <th>Neto Prev.</th>
                    <th>Neto Real</th>
                  </tr>
                </thead>
                <tbody>
                  ${generateMonthlyRows(annualData.monthly)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📈 Resumen anual</h2>
            <div class="row">
              <div class="col">
                <div style="text-align:center; padding:15px; background:var(--card); border:1px solid var(--border); border-radius:8px">
                  <div class="small muted">Ingresos previstos</div>
                  <div class="kpi" style="color:green">${fmtEUR(annualData.totals.forecastIncome)}</div>
                </div>
              </div>
              <div class="col">
                <div style="text-align:center; padding:15px; background:var(--card); border:1px solid var(--border); border-radius:8px">
                  <div class="small muted">Ingresos reales</div>
                  <div class="kpi" style="color:green">${fmtEUR(annualData.totals.realIncome)}</div>
                </div>
              </div>
              <div class="col">
                <div style="text-align:center; padding:15px; background:var(--card); border:1px solid var(--border); border-radius:8px">
                  <div class="small muted">Gastos previstos</div>
                  <div class="kpi" style="color:red">${fmtEUR(annualData.totals.forecastExpenses)}</div>
                </div>
              </div>
              <div class="col">
                <div style="text-align:center; padding:15px; background:var(--card); border:1px solid var(--border); border-radius:8px">
                  <div class="small muted">Gastos reales</div>
                  <div class="kpi" style="color:red">${fmtEUR(annualData.totals.realExpenses)}</div>
                </div>
              </div>
            </div>
            
            <div style="margin-top:15px; text-align:center; padding:20px; background:var(--card); border:2px solid var(--accent); border-radius:12px">
              <div class="small muted">NETO ANUAL</div>
              <div style="font-size:24px; font-weight:bold">
                Previsto: ${fmtEUR(annualData.totals.forecastNet)} | 
                Real: ${fmtEUR(annualData.totals.realNet)}
              </div>
              <div class="small muted">
                Desviación: ${fmtEUR(annualData.totals.realNet - annualData.totals.forecastNet)}
                (${((annualData.totals.realNet / annualData.totals.forecastNet) * 100).toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

function generateAnnualComparison(real, forecast, year) {
  // Group by category
  const categoriesData = {};
  const banksData = {};
  const monthlyData = {};
  
  // Process forecast data
  forecast.forEach(item => {
    const category = item.category || 'SIN_CATEGORIA';
    const bank = item.accountId || 'SIN_BANCO';
    const month = new Date(item.date).getMonth() + 1;
    
    // Categories
    if (!categoriesData[category]) categoriesData[category] = { forecast: 0, real: 0 };
    categoriesData[category].forecast += item.amount;
    
    // Banks  
    if (!banksData[bank]) banksData[bank] = { forecast: 0, real: 0 };
    banksData[bank].forecast += item.amount;
    
    // Monthly
    if (!monthlyData[month]) monthlyData[month] = { 
      forecastIncome: 0, forecastExpenses: 0, realIncome: 0, realExpenses: 0 
    };
    if (item.amount > 0) {
      monthlyData[month].forecastIncome += item.amount;
    } else {
      monthlyData[month].forecastExpenses += item.amount;
    }
  });
  
  // Process real data
  real.forEach(item => {
    const category = item.category || 'SIN_CATEGORIA';
    const bank = item.bank || 'SIN_BANCO';
    const month = new Date(item.date).getMonth() + 1;
    
    // Categories
    if (!categoriesData[category]) categoriesData[category] = { forecast: 0, real: 0 };
    categoriesData[category].real += item.amount;
    
    // Banks
    if (!banksData[bank]) banksData[bank] = { forecast: 0, real: 0 };
    banksData[bank].real += item.amount;
    
    // Monthly
    if (!monthlyData[month]) monthlyData[month] = { 
      forecastIncome: 0, forecastExpenses: 0, realIncome: 0, realExpenses: 0 
    };
    if (item.amount > 0) {
      monthlyData[month].realIncome += item.amount;
    } else {
      monthlyData[month].realExpenses += item.amount;
    }
  });
  
  // Calculate totals
  const totals = {
    forecastIncome: forecast.filter(f => f.amount > 0).reduce((sum, f) => sum + f.amount, 0),
    forecastExpenses: forecast.filter(f => f.amount < 0).reduce((sum, f) => sum + f.amount, 0),
    realIncome: real.filter(r => r.amount > 0).reduce((sum, r) => sum + r.amount, 0),
    realExpenses: real.filter(r => r.amount < 0).reduce((sum, r) => sum + r.amount, 0)
  };
  totals.forecastNet = totals.forecastIncome + totals.forecastExpenses;
  totals.realNet = totals.realIncome + totals.realExpenses;
  
  return {
    categories: categoriesData,
    banks: banksData,
    monthly: monthlyData,
    totals
  };
}

function generateCategoryRows(categories) {
  return Object.entries(categories).map(([category, data]) => {
    const deviation = data.real - data.forecast;
    const percentage = data.forecast !== 0 ? (data.real / data.forecast) * 100 : 0;
    const deviationColor = deviation >= 0 ? 'green' : 'red';
    
    return `
      <tr>
        <td><strong>${category}</strong></td>
        <td>${fmtEUR(data.forecast)}</td>
        <td>${fmtEUR(data.real)}</td>
        <td style="color:${deviationColor}">${fmtEUR(deviation)}</td>
        <td>${percentage.toFixed(1)}%</td>
      </tr>
    `;
  }).join('');
}

function generateBankRows(banks) {
  return Object.entries(banks).map(([bank, data]) => {
    const deviation = data.real - data.forecast;
    const percentage = data.forecast !== 0 ? (data.real / data.forecast) * 100 : 0;
    const deviationColor = deviation >= 0 ? 'green' : 'red';
    
    return `
      <tr>
        <td><strong>${bank}</strong></td>
        <td>${fmtEUR(data.forecast)}</td>
        <td>${fmtEUR(data.real)}</td>
        <td style="color:${deviationColor}">${fmtEUR(deviation)}</td>
        <td>${percentage.toFixed(1)}%</td>
      </tr>
    `;
  }).join('');
}

function generateMonthlyRows(monthly) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  return months.map((monthName, index) => {
    const month = index + 1;
    const data = monthly[month] || { 
      forecastIncome: 0, forecastExpenses: 0, realIncome: 0, realExpenses: 0 
    };
    
    const forecastNet = data.forecastIncome + data.forecastExpenses;
    const realNet = data.realIncome + data.realExpenses;
    
    return `
      <tr>
        <td><strong>${monthName}</strong></td>
        <td>${fmtEUR(data.forecastIncome)}</td>
        <td>${fmtEUR(data.realIncome)}</td>
        <td>${fmtEUR(data.forecastExpenses)}</td>
        <td>${fmtEUR(data.realExpenses)}</td>
        <td>${fmtEUR(forecastNet)}</td>
        <td>${fmtEUR(realNet)}</td>
      </tr>
    `;
  }).join('');
}

export default view;