const LS = window.localStorage;
const year = new Date().getFullYear();
const SETTINGS_KEY = 'fp-settings';
const REAL_KEY = y => `fp-real-${y}`;
const ACCOUNTS_KEY = 'fp-accounts';
const CATEGORIES_KEY = 'fp-categories';
const BUDGETS_KEY = 'fp-budgets';
const PMA_KEY = y => `fp-pma-${y}`;
const RECURRENCES_KEY = 'fp-recurrences';
const FORECAST_KEY = y => `fp-forecast-${y}`;
const TAXES_KEY = 'fp-taxes';
const PROPERTIES_KEY = y => `fp-properties-${y}`;
const LOANS_KEY = y => `fp-loans-${y}`;

export function ensureSeed(){
  if(!LS.getItem(SETTINGS_KEY)){
    LS.setItem(SETTINGS_KEY, JSON.stringify({ theme:'light', accent:'#7c3aed', year }));
  }
  if(!LS.getItem(ACCOUNTS_KEY)){
    LS.setItem(ACCOUNTS_KEY, JSON.stringify([
      {
        id:'SANTANDER', 
        name:'Santander', 
        threshold:200,
        color:'#EC0000',
        logo:'https://www.santander.com/content/dam/santander-com/logos/banco-santander-logo-horizontal.svg'
      },
      {
        id:'BBVA', 
        name:'BBVA', 
        threshold:200,
        color:'#004481',
        logo:'https://www.bbva.com/wp-content/uploads/2016/05/bbva-logo-2019.svg'
      },
      {
        id:'CAIXABANK', 
        name:'CaixaBank', 
        threshold:200,
        color:'#0075C9',
        logo:'https://www.caixabank.com/deployedfiles/caixabank_com/Estaticos/Imagenes/logo-caixabank.svg'
      },
      {
        id:'SABADELL', 
        name:'Banco Sabadell', 
        threshold:200,
        color:'#0078D0',
        logo:'https://www.bancsabadell.com/cs/Satellite?blobcol=urldata&blobheader=image%2Fsvg%2Bxml&blobkey=id&blobtable=MungoBlobs&blobwhere=1234567890123&ssbinary=true'
      }
    ]));
  }
  if(!LS.getItem(CATEGORIES_KEY)){
    LS.setItem(CATEGORIES_KEY, JSON.stringify([
      {id:'income', name:'Ingresos', color:'#10b981', type:'income'},
      {id:'housing', name:'Vivienda', color:'#f59e0b', type:'expense'},
      {id:'utilities', name:'Servicios', color:'#ef4444', type:'expense'},
      {id:'food', name:'Alimentación', color:'#8b5cf6', type:'expense'},
      {id:'transport', name:'Transporte', color:'#06b6d4', type:'expense'},
      {id:'entertainment', name:'Ocio', color:'#ec4899', type:'expense'}
    ]));
  }
  if(!LS.getItem(BUDGETS_KEY)){
    LS.setItem(BUDGETS_KEY, JSON.stringify([
      {categoryId:'housing', monthlyLimit:1000, alertThreshold:0.8},
      {categoryId:'utilities', monthlyLimit:200, alertThreshold:0.8},
      {categoryId:'food', monthlyLimit:600, alertThreshold:0.8},
      {categoryId:'transport', monthlyLimit:300, alertThreshold:0.8},
      {categoryId:'entertainment', monthlyLimit:200, alertThreshold:0.8}
    ]));
  }
  if(!LS.getItem(REAL_KEY(year))){
    const today = new Date(); const y=today.getFullYear(), m=today.getMonth()+1;
    const pad=n=>('0'+n).slice(-2);
    const rows = [
      {date:`${y}-${pad(m)}-02`, bank:'SANTANDER', concept:'Nómina', amount: 4200.00, category:'income'},
      {date:`${y}-${pad(m)}-05`, bank:'SANTANDER', concept:'Alquiler piso A', amount: 1400.00, category:'income'},
      {date:`${y}-${pad(m)}-06`, bank:'BBVA',       concept:'Hipoteca A', amount: -780.50, category:'housing'},
      {date:`${y}-${pad(m)}-10`, bank:'BBVA',       concept:'Luz', amount: -65.20, category:'utilities'},
      {date:`${y}-${pad(m)}-12`, bank:'SANTANDER', concept:'Gas', amount: -48.10, category:'utilities'},
      {date:`${y}-${pad(m)}-20`, bank:'SANTANDER', concept:'Internet', amount: -35.00, category:'utilities'}
    ];
    LS.setItem(REAL_KEY(y), JSON.stringify(rows));
  }
  applyTheme();
}
export function getSettings(){ return JSON.parse(LS.getItem(SETTINGS_KEY)||'{}'); }
export function setSettings(s){ LS.setItem(SETTINGS_KEY, JSON.stringify(s)); applyTheme(); }
export function getYear(){ return getSettings().year || new Date().getFullYear(); }
export function setYear(y){ const s=getSettings(); s.year=y; setSettings(s); }
export function getAccounts(){ return JSON.parse(LS.getItem(ACCOUNTS_KEY)||'[]'); }
export function saveAccounts(arr){ LS.setItem(ACCOUNTS_KEY, JSON.stringify(arr)); }

export function getReal(y=getYear()){ return JSON.parse(LS.getItem(REAL_KEY(y))||'[]'); }
export function saveReal(rows,y=getYear()){ LS.setItem(REAL_KEY(y), JSON.stringify(rows)); }

export function getCategories(){ return JSON.parse(LS.getItem(CATEGORIES_KEY)||'[]'); }
export function saveCategories(arr){ LS.setItem(CATEGORIES_KEY, JSON.stringify(arr)); }

export function getBudgets(){ return JSON.parse(LS.getItem(BUDGETS_KEY)||'[]'); }
export function saveBudgets(arr){ LS.setItem(BUDGETS_KEY, JSON.stringify(arr)); }

// Plan Maestro Anual (PMA)
export function getPMA(y=getYear()){ return JSON.parse(LS.getItem(PMA_KEY(y))||'{}'); }
export function savePMA(pma,y=getYear()){ LS.setItem(PMA_KEY(y), JSON.stringify(pma)); }

// Recurrencias maestro
export function getRecurrences(){ return JSON.parse(LS.getItem(RECURRENCES_KEY)||'[]'); }
export function saveRecurrences(recurrences){ LS.setItem(RECURRENCES_KEY, JSON.stringify(recurrences)); }

// Forecast
export function getForecast(y=getYear()){ return JSON.parse(LS.getItem(FORECAST_KEY(y))||'[]'); }
export function saveForecast(forecast,y=getYear()){ LS.setItem(FORECAST_KEY(y), JSON.stringify(forecast)); }

// Tablas de IRPF y SS
export function getTaxTables(){ 
  return JSON.parse(LS.getItem(TAXES_KEY)||JSON.stringify({
    irpf: [
      {min: 0, max: 12450, rate: 0.19},
      {min: 12450, max: 20200, rate: 0.24},
      {min: 20200, max: 35200, rate: 0.30},
      {min: 35200, max: 60000, rate: 0.37},
      {min: 60000, max: 300000, rate: 0.47},
      {min: 300000, max: Infinity, rate: 0.47}
    ],
    ss: {rate: 0.0635, max: 4495.50}
  }));
}
export function saveTaxTables(tables){ LS.setItem(TAXES_KEY, JSON.stringify(tables)); }

// Company logo lookup
export function getCompanyLogo(companyName) {
  const companyLogos = {
    'microsoft': 'https://www.microsoft.com/favicon.ico',
    'google': 'https://www.google.com/favicon.ico',
    'amazon': 'https://www.amazon.com/favicon.ico',
    'apple': 'https://www.apple.com/favicon.ico',
    'ibm': 'https://www.ibm.com/favicon.ico',
    'telefonica': 'https://www.telefonica.com/favicon.ico',
    'bbva': 'https://www.bbva.com/favicon.ico',
    'santander': 'https://www.santander.com/favicon.ico',
    'repsol': 'https://www.repsol.com/favicon.ico',
    'inditex': 'https://www.inditex.com/favicon.ico'
  };
  
  const company = companyName.toLowerCase().trim();
  return companyLogos[company] || null;
}

// Properties (Inmuebles)
export function getProperties(y=getYear()){ return JSON.parse(LS.getItem(PROPERTIES_KEY(y))||'[]'); }
export function saveProperties(properties,y=getYear()){ LS.setItem(PROPERTIES_KEY(y), JSON.stringify(properties)); }

// Loans (Préstamos)
export function getLoans(y=getYear()){ return JSON.parse(LS.getItem(LOANS_KEY(y))||'[]'); }
export function saveLoans(loans,y=getYear()){ LS.setItem(LOANS_KEY(y), JSON.stringify(loans)); }

export function getBudgetAlerts(y = getYear()) {
  const rows = getReal(y);
  const budgets = getBudgets();
  const categories = getCategories();
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
  
  // Calculate current month spending by category
  const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
  const monthlyRows = rows.filter(r => r.date.startsWith(currentMonth));
  const categorySpending = {};
  
  monthlyRows.forEach(row => {
    if (row.amount < 0 && row.category) { // Only expenses
      categorySpending[row.category] = (categorySpending[row.category] || 0) + Math.abs(row.amount);
    }
  });
  
  // Check budget violations
  const alerts = [];
  budgets.forEach(budget => {
    const spent = categorySpending[budget.categoryId] || 0;
    const category = catMap[budget.categoryId];
    if (!category) return;
    
    const percentage = budget.monthlyLimit > 0 ? spent / budget.monthlyLimit : 0;
    
    if (percentage >= 1) {
      alerts.push({
        type: 'budget_exceeded',
        level: 'danger',
        categoryId: budget.categoryId,
        categoryName: category.name,
        spent,
        limit: budget.monthlyLimit,
        percentage,
        message: `Presupuesto superado en ${category.name}: ${fmtEUR(spent)} de ${fmtEUR(budget.monthlyLimit)}`
      });
    } else if (percentage >= budget.alertThreshold) {
      alerts.push({
        type: 'budget_warning',
        level: 'warning',
        categoryId: budget.categoryId,
        categoryName: category.name,
        spent,
        limit: budget.monthlyLimit,
        percentage,
        message: `Alerta en ${category.name}: ${(percentage * 100).toFixed(1)}% del presupuesto usado`
      });
    }
  });
  
  // Check account thresholds
  const accounts = getAccounts();
  const byBank = {};
  rows.forEach(row => {
    if (row.bank) {
      byBank[row.bank] = (byBank[row.bank] || 0) + row.amount;
    }
  });
  
  accounts.forEach(account => {
    const balance = byBank[account.id] || 0;
    if (balance < account.threshold) {
      alerts.push({
        type: 'account_threshold',
        level: 'warning',
        accountId: account.id,
        accountName: account.name,
        balance,
        threshold: account.threshold,
        message: `Saldo bajo en ${account.name}: ${fmtEUR(balance)} (umbral: ${fmtEUR(account.threshold)})`
      });
    }
  });
  
  return alerts;
}

// Import fmtEUR for alerts - note this creates a circular dependency, but it's acceptable for this use case
function fmtEUR(n) {
  return new Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR', minimumFractionDigits:2})
    .format(+n||0).replace('\u00a0',' ');
}

export function applyTheme(){
  const s=getSettings();
  const root=document.documentElement;
  const body=document.body;
  body.classList.toggle('theme-dark', s.theme==='dark');
  body.classList.toggle('theme-light', s.theme!=='dark');
  root.style.setProperty('--accent', s.accent||'#7c3aed');
}
