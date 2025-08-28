export const EUR = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2});
export function fmtEUR(n){ return EUR.format(+n||0).replace('\u00a0',' '); }
export function fmtDateISO(d){ const y=d.getFullYear(),m=('0'+(d.getMonth()+1)).slice(-2),da=('0'+d.getDate()).slice(-2); return `${y}-${m}-${da}`; }
export function parseEuro(str){
  if(typeof str==='number') return str;
  if(!str) return 0;
  // acepta "1.234,56" o "1234.56"
  let s=(''+str).trim().replace(/\s|EUR|€/gi,'');
  if(/,\d{2}$/.test(s)){ s=s.replace(/\./g,'').replace(',','.'); }
  return parseFloat(s)||0;
}
export function groupBy(arr, key){
  return arr.reduce((m,it)=>{ const k=typeof key==='function'? key(it): it[key]; (m[k]||(m[k]=[])).push(it); return m; },{});
}

// Financial calculations
export function calculateNetSalary(grossAnnual, taxTables) {
  const gross = grossAnnual / 12;
  const ssContrib = Math.min(gross * taxTables.ss.rate, taxTables.ss.max);
  const taxableIncome = Math.max(0, gross - ssContrib);
  
  let irpf = 0;
  for (const bracket of taxTables.irpf) {
    if (taxableIncome > bracket.min) {
      const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
      irpf += taxableInBracket * bracket.rate;
    }
  }
  
  return gross - ssContrib - irpf;
}

export function calculateFrenchAmortization(principal, annualRate, years) {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const schedule = [];
  let balance = principal;
  
  for (let i = 1; i <= numPayments; i++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    balance -= principalPayment;
    
    schedule.push({
      month: i,
      payment: monthlyPayment,
      principal: principalPayment,
      interest: interestPayment,
      balance: Math.max(0, balance)
    });
    
    if (balance <= 0) break;
  }
  
  return schedule;
}

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
