import { getReal } from '../storage.js'; import { fmtEUR } from '../utils.js';
const view = {
  route:'#/hoy', title:'Hoy',
  async mount(root){
    const rows = getReal();
    const monthIncome = rows.filter(r=>r.amount>0).reduce((a,b)=>a+b.amount,0);
    const monthNet = rows.reduce((a,b)=>a+b.amount,0);
    root.innerHTML = `
      <div class="row">
        <div class="col"><div class="card">
          <h1>Hoy</h1>
          <div class="muted">Panel rápido.</div>
        </div></div>
      </div>
      <div class="row">
        <div class="col"><div class="card"><h2>Ingresos del mes</h2><div class="kpi">${fmtEUR(monthIncome)}</div></div></div>
        <div class="col"><div class="card"><h2>Neto del mes</h2><div class="kpi">${fmtEUR(monthNet)}</div></div></div>
      </div>`;
  }
};
export default view;
