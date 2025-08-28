const LS = window.localStorage;
const year = new Date().getFullYear();
const SETTINGS_KEY = 'fp-settings';
const REAL_KEY = y => `fp-real-${y}`;
const ACCOUNTS_KEY = 'fp-accounts';
const CATEGORIES_KEY = 'fp-categories';

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

export function applyTheme(){
  const s=getSettings();
  const root=document.documentElement;
  const body=document.body;
  body.classList.toggle('theme-dark', s.theme==='dark');
  body.classList.toggle('theme-light', s.theme!=='dark');
  root.style.setProperty('--accent', s.accent||'#7c3aed');
}
