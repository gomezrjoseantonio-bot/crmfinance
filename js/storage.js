const LS = window.localStorage;
const year = new Date().getFullYear();
const SETTINGS_KEY = 'fp-settings';
const REAL_KEY = y => `fp-real-${y}`;
const ACCOUNTS_KEY = 'fp-accounts';
const PMA_KEY = y => `fp-pma-${y}`;
const RECURRENCES_KEY = 'fp-recurrences';
const FORECAST_KEY = y => `fp-forecast-${y}`;
const TAXES_KEY = 'fp-taxes';

export function ensureSeed(){
  if(!LS.getItem(SETTINGS_KEY)){
    LS.setItem(SETTINGS_KEY, JSON.stringify({ theme:'light', accent:'#7c3aed', year }));
  }
  if(!LS.getItem(ACCOUNTS_KEY)){
    LS.setItem(ACCOUNTS_KEY, JSON.stringify([
      {id:'SANTANDER', name:'Santander', threshold:200},
      {id:'BBVA', name:'BBVA', threshold:200}
    ]));
  }
  if(!LS.getItem(REAL_KEY(year))){
    const today = new Date(); const y=today.getFullYear(), m=today.getMonth()+1;
    const pad=n=>('0'+n).slice(-2);
    const rows = [
      {date:`${y}-${pad(m)}-02`, bank:'SANTANDER', concept:'Nómina', amount: 4200.00},
      {date:`${y}-${pad(m)}-05`, bank:'SANTANDER', concept:'Alquiler piso A', amount: 1400.00},
      {date:`${y}-${pad(m)}-06`, bank:'BBVA',       concept:'Hipoteca A', amount: -780.50},
      {date:`${y}-${pad(m)}-10`, bank:'BBVA',       concept:'Luz', amount: -65.20},
      {date:`${y}-${pad(m)}-12`, bank:'SANTANDER', concept:'Gas', amount: -48.10},
      {date:`${y}-${pad(m)}-20`, bank:'SANTANDER', concept:'Internet', amount: -35.00}
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

export function applyTheme(){
  const s=getSettings();
  const root=document.documentElement;
  const body=document.body;
  body.classList.toggle('theme-dark', s.theme==='dark');
  body.classList.toggle('theme-light', s.theme!=='dark');
  root.style.setProperty('--accent', s.accent||'#7c3aed');
}
