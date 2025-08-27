import { getReal } from '../storage.js'; import { fmtEUR, groupBy } from '../utils.js';
const view = {
  route:'#/mes', title:'Mes',
  async mount(root){
    const rows = getReal();
    const byBank = groupBy(rows, r=>r.bank||'SIN_BANCO');
    const cards = Object.entries(byBank).map(([bank,items])=>{
      const inc = items.filter(x=>x.amount>0).reduce((a,b)=>a+b.amount,0);
      const out = items.filter(x=>x.amount<0).reduce((a,b)=>a+b.amount,0);
      const net = inc+out;
      const days = groupBy(items, r=>r.date);
      const details = Object.entries(days).sort(([a],[b])=>a.localeCompare(b)).map(([d,list])=>{
        const s = list.map(l=>`<tr><td>${l.date}</td><td>${l.concept}</td><td style="text-align:right">${fmtEUR(l.amount)}</td></tr>`).join('');
        return s;
      }).join('');
      return `<div class="col"><div class="card">
        <h2> ${bank} <span class="badge">${items.length} movs</span></h2>
        <div class="small">Ingresos: <b>${fmtEUR(inc)}</b> · Gastos: <b>${fmtEUR(out)}</b> · Neto: <b>${fmtEUR(net)}</b></div>
        <div class="grid" style="margin-top:8px"><table>
          <thead><tr><th>Fecha</th><th>Concepto</th><th style="text-align:right">Importe</th></tr></thead>
          <tbody>${details}</tbody>
        </table></div>
        <div class="small muted" style="margin-top:6px">Traspasos (beta pronto)</div>
      </div></div>`;
    }).join('') || `<div class="card">No hay movimientos este mes. Importa primero.</div>`;
    root.innerHTML = `<div class="row"><div class="col"><h1>Mes</h1></div></div><div class="row">${cards}</div>`;
  }
};
export default view;
