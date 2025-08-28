import { getAccounts, getReal, getForecast, saveReal } from '../storage.js';
import { fmtEUR, groupBy, fmtDateISO } from '../utils.js';

const view = {
  route: '#/calendar',
  title: 'Calendario',
  
  async mount(root) {
    const accounts = getAccounts();
    const real = getReal();
    const forecast = getForecast();
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    // Calculate daily balances for each account
    const accountBalances = calculateDailyBalances(accounts, real, forecast, currentYear, currentMonth);
    
    const accountCards = accounts.map(account => {
      const balances = accountBalances[account.id] || [];
      const alerts = balances.filter(b => b.balance < account.threshold);
      const hasAlerts = alerts.length > 0;
      
      const balanceRows = balances.slice(0, 30).map(b => `
        <tr class="${b.balance < account.threshold ? 'alert-row' : ''}">
          <td>${b.date}</td>
          <td>${b.movements.map(m => `<div class="small">${m.concept}: ${fmtEUR(m.amount)}</div>`).join('')}</td>
          <td style="text-align:right; ${b.balance < account.threshold ? 'color:red; font-weight:bold' : ''}">${fmtEUR(b.balance)}</td>
        </tr>
      `).join('');
      
      return `
        <div class="col">
          <div class="card">
            <h2>🏦 ${account.name} ${hasAlerts ? '⚠️' : '✅'}</h2>
            <div class="small muted">Umbral: ${fmtEUR(account.threshold)} · Próximos 30 días</div>
            
            ${hasAlerts ? `
              <div style="background:#fee; border:1px solid #fcc; border-radius:8px; padding:8px; margin:8px 0">
                <strong style="color:#c33">⚠️ ${alerts.length} alertas detectadas</strong>
                <div class="small">Primera alerta: ${alerts[0]?.date} (${fmtEUR(alerts[0]?.balance)})</div>
              </div>
            ` : ''}
            
            <div class="grid" style="margin-top:8px">
              <table>
                <thead>
                  <tr><th>Fecha</th><th>Movimientos</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  ${balanceRows || '<tr><td colspan="3" style="text-align:center; color:var(--muted)">No hay datos</td></tr>'}
                </tbody>
              </table>
            </div>
            
            <div style="margin-top:10px">
              <button class="suggest-transfers" data-account="${account.id}" ${hasAlerts ? '' : 'disabled'}>
                💡 Sugerir traspasos
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>📅 Calendario por banco</h1>
            <div class="small muted">Saldos diarios previstos con alertas y sugerencias de traspaso</div>
            
            <div style="margin:10px 0">
              <button id="suggestAllTransfers" class="primary">💡 Sugerir traspasos globales</button>
              <button id="applyTransfers" style="margin-left:10px">✅ Aplicar traspasos sugeridos</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        ${accountCards}
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📝 Traspasos sugeridos</h2>
            <div id="suggestedTransfers" class="small muted">
              Haz clic en "Sugerir traspasos globales" para ver sugerencias
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add CSS for alert rows
    if (!document.querySelector('#calendar-styles')) {
      const style = document.createElement('style');
      style.id = 'calendar-styles';
      style.textContent = `
        .alert-row { background-color: rgba(255, 0, 0, 0.1) !important; }
        .transfer-suggestion { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 8px; margin: 4px 0; }
      `;
      document.head.appendChild(style);
    }
    
    // Event handlers
    root.querySelector('#suggestAllTransfers').onclick = () => {
      const suggestions = calculateTransferSuggestions(accountBalances, accounts);
      displayTransferSuggestions(root, suggestions);
    };
    
    root.querySelector('#applyTransfers').onclick = () => {
      applyTransferSuggestions(root);
    };
    
    root.querySelectorAll('.suggest-transfers').forEach(btn => {
      btn.onclick = () => {
        const accountId = btn.getAttribute('data-account');
        const suggestions = calculateTransferSuggestions(accountBalances, accounts, accountId);
        displayTransferSuggestions(root, suggestions);
      };
    });
  }
};

function calculateDailyBalances(accounts, real, forecast, year, month) {
  const balances = {};
  const today = new Date();
  
  accounts.forEach(account => {
    balances[account.id] = [];
    
    // Get initial balance (sum of real transactions before this month)
    const previousReal = real.filter(r => {
      const rDate = new Date(r.date);
      return r.bank === account.id && 
             (rDate.getFullYear() < year || 
              (rDate.getFullYear() === year && rDate.getMonth() + 1 < month));
    });
    
    let runningBalance = previousReal.reduce((sum, r) => sum + r.amount, 0);
    
    // Generate 30 days starting from current month
    for (let day = 1; day <= 30; day++) {
      const currentDate = new Date(year, month - 1, day);
      if (currentDate > new Date(year, month - 1 + 1, 0)) break; // Don't exceed month
      
      const dateStr = fmtDateISO(currentDate);
      
      // Get movements for this day (real + forecast)
      const dayMovements = [
        ...real.filter(r => r.date === dateStr && r.bank === account.id),
        ...forecast.filter(f => f.date === dateStr && f.accountId === account.id)
      ];
      
      // Update balance
      const dayAmount = dayMovements.reduce((sum, m) => sum + (m.amount || 0), 0);
      runningBalance += dayAmount;
      
      balances[account.id].push({
        date: dateStr,
        movements: dayMovements,
        balance: runningBalance
      });
    }
  });
  
  return balances;
}

function calculateTransferSuggestions(accountBalances, accounts, targetAccountId = null) {
  const suggestions = [];
  const today = new Date();
  
  // Find accounts with deficits and surpluses
  const accountStatus = accounts.map(account => {
    const balances = accountBalances[account.id] || [];
    const firstAlert = balances.find(b => b.balance < account.threshold);
    const finalBalance = balances[balances.length - 1]?.balance || 0;
    
    return {
      id: account.id,
      name: account.name,
      threshold: account.threshold,
      finalBalance,
      firstAlertDate: firstAlert?.date,
      deficit: firstAlert ? account.threshold - firstAlert.balance : 0,
      surplus: finalBalance > account.threshold ? finalBalance - account.threshold : 0
    };
  });
  
  // Sort by final balance (ascending for deficits, descending for surpluses)
  const deficits = accountStatus.filter(a => a.deficit > 0 && (!targetAccountId || a.id === targetAccountId));
  const surpluses = accountStatus.filter(a => a.surplus > 0 && (!targetAccountId || a.id !== targetAccountId)).sort((a, b) => b.surplus - a.surplus);
  
  // Suggest transfers using greedy algorithm
  deficits.forEach(deficit => {
    let remainingDeficit = deficit.deficit;
    
    surpluses.forEach(surplus => {
      if (remainingDeficit <= 0 || surplus.surplus <= 0) return;
      
      const transferAmount = Math.min(remainingDeficit, surplus.surplus);
      
      suggestions.push({
        from: surplus.id,
        fromName: surplus.name,
        to: deficit.id,
        toName: deficit.name,
        amount: transferAmount,
        suggestedDate: deficit.firstAlertDate ? 
          fmtDateISO(new Date(new Date(deficit.firstAlertDate).getTime() - 24 * 60 * 60 * 1000)) : 
          fmtDateISO(today),
        reason: `Evitar descubierto en ${deficit.name} (${fmtEUR(deficit.threshold)})`
      });
      
      surplus.surplus -= transferAmount;
      remainingDeficit -= transferAmount;
    });
    
    if (remainingDeficit > 0) {
      suggestions.push({
        from: 'INSUFICIENTE',
        fromName: 'Fondos insuficientes',
        to: deficit.id,
        toName: deficit.name,
        amount: remainingDeficit,
        suggestedDate: deficit.firstAlertDate,
        reason: `No hay fondos suficientes para cubrir ${fmtEUR(remainingDeficit)}`
      });
    }
  });
  
  return suggestions;
}

function displayTransferSuggestions(root, suggestions) {
  const container = root.querySelector('#suggestedTransfers');
  
  if (suggestions.length === 0) {
    container.innerHTML = '<div class="small muted">✅ No se necesitan traspasos</div>';
    return;
  }
  
  const suggestionHtml = suggestions.map((s, i) => `
    <div class="transfer-suggestion" data-index="${i}">
      <strong>${s.from === 'INSUFICIENTE' ? '❌' : '💸'} ${fmtEUR(s.amount)}</strong> 
      de <strong>${s.fromName}</strong> a <strong>${s.toName}</strong>
      <div class="small">📅 Fecha sugerida: ${s.suggestedDate}</div>
      <div class="small">💡 ${s.reason}</div>
      ${s.from !== 'INSUFICIENTE' ? `<input type="checkbox" class="apply-transfer" data-index="${i}"> Aplicar` : ''}
    </div>
  `).join('');
  
  container.innerHTML = suggestionHtml;
}

function applyTransferSuggestions(root) {
  const checkedTransfers = root.querySelectorAll('.apply-transfer:checked');
  const real = getReal();
  let appliedCount = 0;
  
  checkedTransfers.forEach(checkbox => {
    const index = parseInt(checkbox.getAttribute('data-index'));
    const suggestion = root.querySelector(`[data-index="${index}"]`);
    
    if (suggestion) {
      const lines = suggestion.textContent.split('\n');
      const amount = parseFloat(lines[0].match(/[\d,]+/)[0].replace(',', '.'));
      const dateMatch = lines[1].match(/\d{4}-\d{2}-\d{2}/);
      const date = dateMatch ? dateMatch[0] : fmtDateISO(new Date());
      
      // Add transfer movements
      real.push({
        date,
        bank: suggestion.textContent.includes('de') ? suggestion.textContent.split('de ')[1].split(' a')[0] : 'UNKNOWN',
        concept: `Traspaso automático`,
        amount: -amount
      });
      
      real.push({
        date,
        bank: suggestion.textContent.includes('a') ? suggestion.textContent.split('a ')[1].split(' ')[0] : 'UNKNOWN',
        concept: `Traspaso automático`,
        amount: amount
      });
      
      appliedCount++;
    }
  });
  
  if (appliedCount > 0) {
    saveReal(real);
    alert(`${appliedCount} traspasos aplicados correctamente`);
    view.mount(root.parentElement); // Refresh view
  } else {
    alert('No hay traspasos seleccionados para aplicar');
  }
}

export default view;