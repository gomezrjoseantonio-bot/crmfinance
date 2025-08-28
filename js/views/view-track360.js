import { getAccounts, getReal, getForecast, getTrack360Config, getTrack360State, saveTrack360State, saveReal } from '../storage.js';
import { fmtEUR, fmtDateISO, groupBy } from '../utils.js';

const view = {
  route: '#/track360',
  title: 'Track 360',
  
  async mount(root) {
    const accounts = getAccounts();
    const real = getReal();
    const forecast = getForecast();
    const config = getTrack360Config();
    const state = getTrack360State();
    
    // Parse current month from state
    const [year, month] = state.currentMonth.split('-').map(Number);
    
    // Calculate daily data for the month
    const dailyData = calculateDailyData(accounts, real, forecast, config, year, month);
    
    // Calculate KPIs
    const kpis = calculateKPIs(dailyData, accounts, config);
    
    // Generate the view
    root.innerHTML = generateHTML(dailyData, accounts, kpis, config, state, year, month);
    
    // Add event listeners
    addEventListeners(root, accounts, config, state);
  }
};

/**
 * Calculate daily balances, movements, and alerts for all accounts
 */
function calculateDailyData(accounts, real, forecast, config, year, month) {
  const dailyData = {};
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Initialize daily data structure
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = fmtDateISO(new Date(year, month - 1, day));
    dailyData[dateStr] = {
      date: dateStr,
      accounts: {}
    };
    
    accounts.forEach(account => {
      dailyData[dateStr].accounts[account.id] = {
        movements: {
          real: [],
          forecast: [],
          reconciled: [],
          deviated: [],
          overdue: [],
          transfers: []
        },
        balanceStart: 0,
        balanceEnd: 0,
        alert: false,
        amber: false
      };
    });
  }
  
  // Calculate initial balances (sum of all previous movements)
  const initialBalances = {};
  accounts.forEach(account => {
    const previousMovements = real.filter(r => {
      const rDate = new Date(r.date);
      return r.bank === account.id && 
             (rDate.getFullYear() < year || 
              (rDate.getFullYear() === year && rDate.getMonth() + 1 < month));
    });
    initialBalances[account.id] = previousMovements.reduce((sum, r) => sum + r.amount, 0);
  });
  
  // Process movements day by day
  const sortedDates = Object.keys(dailyData).sort();
  
  accounts.forEach(account => {
    let runningBalance = initialBalances[account.id] || 0;
    
    sortedDates.forEach(dateStr => {
      const dayData = dailyData[dateStr].accounts[account.id];
      dayData.balanceStart = runningBalance;
      
      // Get real movements for this day
      const realMovements = real.filter(r => r.date === dateStr && r.bank === account.id);
      dayData.movements.real = realMovements;
      
      // Get forecast movements for this day
      const forecastMovements = forecast.filter(f => f.date === dateStr && f.accountId === account.id);
      
      // Perform reconciliation
      const reconciliation = reconcileMovements(realMovements, forecastMovements, config);
      dayData.movements.forecast = reconciliation.unmatchedForecast;
      dayData.movements.reconciled = reconciliation.reconciled;
      dayData.movements.deviated = reconciliation.deviated;
      dayData.movements.overdue = reconciliation.overdue;
      
      // Calculate total movements for the day
      const totalReal = realMovements.reduce((sum, m) => sum + m.amount, 0);
      const totalForecastUnmatched = reconciliation.unmatchedForecast.reduce((sum, m) => sum + (m.amount || 0), 0);
      
      // Update running balance
      runningBalance += totalReal + totalForecastUnmatched;
      dayData.balanceEnd = runningBalance;
      
      // Check for alerts
      const threshold = config.bankThresholds[account.id] || account.threshold || config.globalThreshold;
      dayData.alert = runningBalance < threshold;
      dayData.amber = runningBalance < (threshold + config.bufferAmber);
    });
  });
  
  return dailyData;
}

/**
 * Reconcile real movements with forecast movements
 */
function reconcileMovements(realMovements, forecastMovements, config) {
  const reconciled = [];
  const deviated = [];
  const overdue = [];
  const unmatchedForecast = [...forecastMovements];
  const unmatchedReal = [...realMovements];
  
  // Simple reconciliation logic - match by amount within tolerance
  realMovements.forEach(real => {
    const matchIndex = unmatchedForecast.findIndex(forecast => {
      const amountDiff = Math.abs(real.amount - (forecast.amount || 0));
      const amountTolerance = Math.max(
        config.reconciliation.toleranceEur,
        Math.abs(forecast.amount || 0) * (config.reconciliation.tolerancePercent / 100)
      );
      
      return amountDiff <= amountTolerance;
    });
    
    if (matchIndex >= 0) {
      const forecast = unmatchedForecast[matchIndex];
      reconciled.push({
        real,
        forecast,
        type: 'reconciled'
      });
      unmatchedForecast.splice(matchIndex, 1);
    }
  });
  
  return {
    reconciled,
    deviated,
    overdue,
    unmatchedForecast,
    unmatchedReal
  };
}

/**
 * Calculate KPIs for the period
 */
function calculateKPIs(dailyData, accounts, config) {
  const kpis = {
    forecastIncome: 0,
    forecastExpenses: 0,
    realIncome: 0,
    realExpenses: 0,
    minimumProjected: {},
    nextAlert: null
  };
  
  // Calculate totals and minimum balances
  Object.values(dailyData).forEach(day => {
    accounts.forEach(account => {
      const accountData = day.accounts[account.id];
      
      // Track minimum projected balance
      if (!kpis.minimumProjected[account.id] || 
          accountData.balanceEnd < kpis.minimumProjected[account.id].balance) {
        kpis.minimumProjected[account.id] = {
          balance: accountData.balanceEnd,
          date: day.date
        };
      }
      
      // Find next alert
      if (accountData.alert && (!kpis.nextAlert || day.date < kpis.nextAlert.date)) {
        kpis.nextAlert = {
          date: day.date,
          accountId: account.id,
          accountName: account.name,
          balance: accountData.balanceEnd
        };
      }
      
      // Sum movements
      accountData.movements.real.forEach(m => {
        if (m.amount > 0) kpis.realIncome += m.amount;
        else kpis.realExpenses += m.amount;
      });
      
      accountData.movements.forecast.forEach(m => {
        if ((m.amount || 0) > 0) kpis.forecastIncome += m.amount || 0;
        else kpis.forecastExpenses += m.amount || 0;
      });
    });
  });
  
  return kpis;
}

/**
 * Generate the HTML for the Track 360 view
 */
function generateHTML(dailyData, accounts, kpis, config, state, year, month) {
  const monthName = new Date(year, month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  
  return `
    <div class="track360-view">
      <!-- Header sticky -->
      <div class="track360-header sticky">
        <div class="row">
          <div class="col">
            <div class="card">
              <h1>📊 Track 360</h1>
              <div class="header-controls">
                <div class="month-selector">
                  <label>Mes:</label>
                  <input type="month" id="monthSelector" value="${state.currentMonth}" />
                </div>
                <div class="view-filter">
                  <label>Vista:</label>
                  <select id="viewFilter">
                    <option value="Mixto" ${state.viewFilter === 'Mixto' ? 'selected' : ''}>Mixto</option>
                    <option value="Real" ${state.viewFilter === 'Real' ? 'selected' : ''}>Real</option>
                    <option value="Previsión" ${state.viewFilter === 'Previsión' ? 'selected' : ''}>Previsión</option>
                  </select>
                </div>
                <div class="action-buttons">
                  <button id="suggestTransfers" class="primary">💡 Sugerir traspasos</button>
                  <button id="applyTransfers">✅ Aplicar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- KPIs -->
      <div class="row kpis-section">
        ${generateKPIsHTML(kpis, accounts)}
      </div>
      
      <!-- Calendar Grid -->
      <div class="row">
        <div class="col">
          <div class="card calendar-grid">
            <h2>📅 ${monthName}</h2>
            ${generateCalendarHTML(dailyData, accounts, state)}
          </div>
        </div>
      </div>
      
      <!-- Transfer suggestions -->
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>💸 Traspasos sugeridos</h2>
            <div id="transferSuggestions" class="small muted">
              Haz clic en "Sugerir traspasos" para ver sugerencias
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Day detail drawer -->
    <div id="dayDrawer" class="day-drawer" style="display: none;">
      <div class="drawer-content">
        <div class="drawer-header">
          <h3 id="drawerTitle">Detalle del día</h3>
          <button id="closeDrawer">✕</button>
        </div>
        <div id="drawerBody" class="drawer-body">
          <!-- Will be populated dynamically -->
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate KPIs HTML section
 */
function generateKPIsHTML(kpis, accounts) {
  const minProjectedCards = accounts.map(account => {
    const min = kpis.minimumProjected[account.id];
    if (!min) return '';
    
    return `
      <div class="col">
        <div class="kpi-card">
          <div class="small muted">${account.name} - Mínimo proyectado</div>
          <div class="kpi ${min.balance < (account.threshold || 200) ? 'alert' : ''}">${fmtEUR(min.balance)}</div>
          <div class="small">${min.date}</div>
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="col">
      <div class="kpi-card">
        <div class="small muted">Ingresos previstos</div>
        <div class="kpi positive">${fmtEUR(kpis.forecastIncome)}</div>
      </div>
    </div>
    <div class="col">
      <div class="kpi-card">
        <div class="small muted">Ingresos realizados</div>
        <div class="kpi positive">${fmtEUR(kpis.realIncome)}</div>
      </div>
    </div>
    <div class="col">
      <div class="kpi-card">
        <div class="small muted">Gastos previstos</div>
        <div class="kpi negative">${fmtEUR(kpis.forecastExpenses)}</div>
      </div>
    </div>
    <div class="col">
      <div class="kpi-card">
        <div class="small muted">Gastos realizados</div>
        <div class="kpi negative">${fmtEUR(kpis.realExpenses)}</div>
      </div>
    </div>
    ${minProjectedCards}
    ${kpis.nextAlert ? `
      <div class="col">
        <div class="kpi-card alert">
          <div class="small muted">Próxima alerta</div>
          <div class="kpi">${kpis.nextAlert.accountName}</div>
          <div class="small">${kpis.nextAlert.date} (${fmtEUR(kpis.nextAlert.balance)})</div>
        </div>
      </div>
    ` : ''}
  `;
}

/**
 * Generate calendar HTML with vertical layout
 */
function generateCalendarHTML(dailyData, accounts, state) {
  const sortedDates = Object.keys(dailyData).sort();
  
  const headerRow = `
    <tr class="calendar-header">
      <th>Fecha</th>
      ${accounts.map(account => `<th>${account.name}</th>`).join('')}
    </tr>
  `;
  
  const dataRows = sortedDates.map(dateStr => {
    const dayData = dailyData[dateStr];
    const date = new Date(dateStr);
    const dayLabel = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    
    const accountCells = accounts.map(account => {
      const accountData = dayData.accounts[account.id];
      const movementChips = generateMovementChips(accountData.movements, state.viewFilter);
      const balanceClass = accountData.alert ? 'alert' : (accountData.amber ? 'amber' : '');
      
      return `
        <td class="account-cell ${balanceClass}" data-date="${dateStr}" data-account="${account.id}">
          <div class="movements">${movementChips}</div>
          <div class="balance ${balanceClass}">${fmtEUR(accountData.balanceEnd)}</div>
        </td>
      `;
    }).join('');
    
    return `
      <tr class="calendar-row" data-date="${dateStr}">
        <td class="date-cell">${dayLabel}</td>
        ${accountCells}
      </tr>
    `;
  }).join('');
  
  return `
    <table class="calendar-table">
      <thead>${headerRow}</thead>
      <tbody>${dataRows}</tbody>
    </table>
  `;
}

/**
 * Generate movement chips based on view filter
 */
function generateMovementChips(movements, viewFilter) {
  let chips = [];
  
  if (viewFilter === 'Mixto' || viewFilter === 'Real') {
    chips = chips.concat(movements.real.map(m => 
      `<span class="chip real" title="${m.concept}">● ${fmtEUR(m.amount)}</span>`
    ));
    
    chips = chips.concat(movements.reconciled.map(r => 
      `<span class="chip reconciled" title="${r.real.concept}">✔ ${fmtEUR(r.real.amount)}</span>`
    ));
  }
  
  if (viewFilter === 'Mixto' || viewFilter === 'Previsión') {
    chips = chips.concat(movements.forecast.map(m => 
      `<span class="chip forecast" title="${m.concept || 'Previsión'}">○ ${fmtEUR(m.amount || 0)}</span>`
    ));
    
    chips = chips.concat(movements.deviated.map(d => 
      `<span class="chip deviated" title="Desviación">≈ ${fmtEUR(d.real.amount)}</span>`
    ));
    
    chips = chips.concat(movements.overdue.map(o => 
      `<span class="chip overdue" title="Vencida">⏰ ${fmtEUR(o.amount || 0)}</span>`
    ));
  }
  
  chips = chips.concat(movements.transfers.map(t => 
    `<span class="chip transfer" title="Traspaso">⇄ ${fmtEUR(t.amount)}</span>`
  ));
  
  return chips.join('');
}

/**
 * Add event listeners for interactivity
 */
function addEventListeners(root, accounts, config, state) {
  // Month selector
  const monthSelector = root.querySelector('#monthSelector');
  monthSelector?.addEventListener('change', (e) => {
    state.currentMonth = e.target.value;
    saveTrack360State(state);
    view.mount(root);
  });
  
  // View filter
  const viewFilter = root.querySelector('#viewFilter');
  viewFilter?.addEventListener('change', (e) => {
    state.viewFilter = e.target.value;
    saveTrack360State(state);
    view.mount(root);
  });
  
  // Day cell clicks for drawer
  root.querySelectorAll('.account-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      const date = cell.dataset.date;
      const accountId = cell.dataset.account;
      showDayDrawer(root, date, accountId, accounts, config);
    });
  });
  
  // Transfer suggestions
  const suggestBtn = root.querySelector('#suggestTransfers');
  suggestBtn?.addEventListener('click', () => {
    // Calculate and display transfer suggestions
    const suggestions = calculateTransferSuggestions(accounts, config);
    displayTransferSuggestions(root, suggestions);
  });
  
  // Apply transfers
  const applyBtn = root.querySelector('#applyTransfers');
  applyBtn?.addEventListener('click', () => {
    applySelectedTransfers(root);
  });
  
  // Close drawer
  const closeDrawer = root.querySelector('#closeDrawer');
  closeDrawer?.addEventListener('click', () => {
    root.querySelector('#dayDrawer').style.display = 'none';
  });
}

/**
 * Show day detail drawer
 */
function showDayDrawer(root, date, accountId, accounts, config) {
  const drawer = root.querySelector('#dayDrawer');
  const title = root.querySelector('#drawerTitle');
  const body = root.querySelector('#drawerBody');
  
  const account = accounts.find(a => a.id === accountId);
  const dateFormatted = new Date(date).toLocaleDateString('es-ES', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  title.textContent = `${account?.name} - ${dateFormatted}`;
  
  // Generate drawer content
  body.innerHTML = `
    <div class="drawer-section">
      <h4>Movimientos reales</h4>
      <div id="realMovements">No hay movimientos</div>
    </div>
    
    <div class="drawer-section">
      <h4>Previsiones</h4>
      <div id="forecastMovements">No hay previsiones</div>
    </div>
    
    <div class="drawer-section">
      <h4>Traspasos</h4>
      <div id="transferMovements">No hay traspasos</div>
    </div>
    
    <div class="drawer-actions">
      <button class="small">+ Añadir movimiento</button>
      <button class="small">+ Crear traspaso</button>
    </div>
  `;
  
  drawer.style.display = 'block';
}

/**
 * Calculate transfer suggestions
 */
function calculateTransferSuggestions(accounts, config) {
  // Placeholder for transfer suggestion logic
  return [];
}

/**
 * Display transfer suggestions
 */
function displayTransferSuggestions(root, suggestions) {
  const container = root.querySelector('#transferSuggestions');
  
  if (suggestions.length === 0) {
    container.innerHTML = '<div class="small muted">✅ No se necesitan traspasos</div>';
    return;
  }
  
  // Render suggestions
  container.innerHTML = suggestions.map((s, i) => `
    <div class="transfer-suggestion" data-index="${i}">
      <input type="checkbox" class="apply-transfer" data-index="${i}">
      <strong>${fmtEUR(s.amount)}</strong> de <strong>${s.fromName}</strong> a <strong>${s.toName}</strong>
      <div class="small">📅 ${s.suggestedDate} - ${s.reason}</div>
    </div>
  `).join('');
}

/**
 * Apply selected transfers
 */
function applySelectedTransfers(root) {
  const checkboxes = root.querySelectorAll('.apply-transfer:checked');
  
  if (checkboxes.length === 0) {
    alert('No hay traspasos seleccionados');
    return;
  }
  
  // Apply transfers logic here
  alert(`${checkboxes.length} traspasos aplicados`);
  view.mount(root);
}

export default view;