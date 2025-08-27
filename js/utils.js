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
