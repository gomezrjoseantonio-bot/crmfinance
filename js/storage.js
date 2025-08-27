const LS = window.localStorage;
const year = new Date().getFullYear();
const SETTINGS_KEY = 'fp-settings';
const REAL_KEY = y => `fp-real-${y}`;
const ACCOUNTS_KEY = 'fp-accounts';

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
export function getSettings(){ 
  try {
    return JSON.parse(LS.getItem(SETTINGS_KEY)||'{}'); 
  } catch (error) {
    console.error('Error al cargar configuración:', error);
    return {};
  }
}

export function setSettings(s){ 
  try {
    if (!s || typeof s !== 'object') {
      throw new Error('Configuración inválida');
    }
    LS.setItem(SETTINGS_KEY, JSON.stringify(s)); 
    applyTheme(); 
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    throw error;
  }
}

export function getYear(){ return getSettings().year || new Date().getFullYear(); }

export function setYear(y){ 
  try {
    const year = parseInt(y, 10);
    if (isNaN(year) || year < 1900 || year > 2100) {
      throw new Error('Año inválido');
    }
    const s=getSettings(); 
    s.year=year; 
    setSettings(s); 
  } catch (error) {
    console.error('Error al establecer año:', error);
    throw error;
  }
}

export function getAccounts(){ 
  try {
    return JSON.parse(LS.getItem(ACCOUNTS_KEY)||'[]'); 
  } catch (error) {
    console.error('Error al cargar cuentas:', error);
    return [];
  }
}

export function saveAccounts(arr){ 
  try {
    if (!Array.isArray(arr)) {
      throw new Error('Las cuentas deben ser un array');
    }
    // Validar estructura de cuentas
    for (const account of arr) {
      if (!account.id || !account.name) {
        throw new Error('Cuenta inválida: falta ID o nombre');
      }
    }
    LS.setItem(ACCOUNTS_KEY, JSON.stringify(arr)); 
  } catch (error) {
    console.error('Error al guardar cuentas:', error);
    throw error;
  }
}

export function getReal(y=getYear()){ 
  try {
    return JSON.parse(LS.getItem(REAL_KEY(y))||'[]'); 
  } catch (error) {
    console.error('Error al cargar transacciones:', error);
    return [];
  }
}

export function saveReal(rows,y=getYear()){ 
  try {
    if (!Array.isArray(rows)) {
      throw new Error('Las transacciones deben ser un array');
    }
    // Validar estructura de transacciones
    for (const row of rows) {
      if (!row.date || !row.concept || typeof row.amount !== 'number') {
        throw new Error('Transacción inválida: faltan campos requeridos');
      }
      // Validar formato de fecha
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
        throw new Error(`Fecha inválida: ${row.date}`);
      }
    }
    LS.setItem(REAL_KEY(y), JSON.stringify(rows)); 
  } catch (error) {
    console.error('Error al guardar transacciones:', error);
    throw error;
  }
}

export function applyTheme(){
  const s=getSettings();
  const root=document.documentElement;
  const body=document.body;
  body.classList.toggle('theme-dark', s.theme==='dark');
  body.classList.toggle('theme-light', s.theme!=='dark');
  root.style.setProperty('--accent', s.accent||'#7c3aed');
}
