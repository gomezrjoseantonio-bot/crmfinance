import { getReal } from '../storage.js'; 
import { fmtEUR, groupBy, showError } from '../utils.js';

const view = {
  route:'#/mes', title:'Mes',
  async mount(root){
    try {
      const allRows = getReal();
      let filteredRows = [...allRows];
      
      function renderView(rows = filteredRows) {
        const byBank = groupBy(rows, r=>r.bank||'SIN_BANCO');
        const totalIncome = rows.filter(x=>x.amount>0).reduce((a,b)=>a+b.amount,0);
        const totalExpenses = rows.filter(x=>x.amount<0).reduce((a,b)=>a+b.amount,0);
        const totalNet = totalIncome + totalExpenses;
        
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
        }).join('') || `<div class="col"><div class="card">No hay movimientos${rows.length !== allRows.length ? ' que coincidan con los filtros' : ' este mes. Importa primero'}.</div></div>`;
        
        const summary = `
          <div class="col"><div class="card">
            <h2>Resumen Total</h2>
            <div class="row" style="gap:20px">
              <div style="text-align:center">
                <div class="small muted">Ingresos</div>
                <div class="kpi" style="color:#059669">${fmtEUR(totalIncome)}</div>
              </div>
              <div style="text-align:center">
                <div class="small muted">Gastos</div>
                <div class="kpi" style="color:#dc2626">${fmtEUR(totalExpenses)}</div>
              </div>
              <div style="text-align:center">
                <div class="small muted">Neto</div>
                <div class="kpi" style="color:${totalNet >= 0 ? '#059669' : '#dc2626'}">${fmtEUR(totalNet)}</div>
              </div>
            </div>
            <div class="small muted" style="margin-top:8px">
              Mostrando ${rows.length} de ${allRows.length} transacciones
            </div>
          </div></div>
        `;
        
        const container = root.querySelector('#content');
        container.innerHTML = `<div class="row">${summary}</div><div class="row">${cards}</div>`;
      }
      
      function applyFilters() {
        const searchTerm = root.querySelector('#search').value.toLowerCase();
        const bankFilter = root.querySelector('#bankFilter').value;
        const typeFilter = root.querySelector('#typeFilter').value;
        const minAmount = parseFloat(root.querySelector('#minAmount').value) || null;
        const maxAmount = parseFloat(root.querySelector('#maxAmount').value) || null;
        const startDate = root.querySelector('#startDate').value;
        const endDate = root.querySelector('#endDate').value;
        
        filteredRows = allRows.filter(row => {
          // Filtro por texto de búsqueda
          if (searchTerm && !row.concept.toLowerCase().includes(searchTerm)) {
            return false;
          }
          
          // Filtro por banco
          if (bankFilter && row.bank !== bankFilter) {
            return false;
          }
          
          // Filtro por tipo (ingresos/gastos)
          if (typeFilter === 'income' && row.amount <= 0) {
            return false;
          }
          if (typeFilter === 'expense' && row.amount >= 0) {
            return false;
          }
          
          // Filtro por rango de importes
          if (minAmount !== null && Math.abs(row.amount) < minAmount) {
            return false;
          }
          if (maxAmount !== null && Math.abs(row.amount) > maxAmount) {
            return false;
          }
          
          // Filtro por rango de fechas
          if (startDate && row.date < startDate) {
            return false;
          }
          if (endDate && row.date > endDate) {
            return false;
          }
          
          return true;
        });
        
        renderView(filteredRows);
      }
      
      // UI principal
      const uniqueBanks = [...new Set(allRows.map(r => r.bank))].sort();
      const filtersHtml = `
        <div class="card" style="margin-bottom:16px">
          <h2>Filtros y Búsqueda</h2>
          <div class="row" style="gap:10px; align-items:end">
            <div style="flex:2">
              <label class="small muted">Buscar en concepto</label><br/>
              <input type="text" id="search" placeholder="Escribe para buscar..." style="width:100%">
            </div>
            <div style="flex:1">
              <label class="small muted">Banco</label><br/>
              <select id="bankFilter" style="width:100%">
                <option value="">Todos los bancos</option>
                ${uniqueBanks.map(bank => `<option value="${bank}">${bank}</option>`).join('')}
              </select>
            </div>
            <div style="flex:1">
              <label class="small muted">Tipo</label><br/>
              <select id="typeFilter" style="width:100%">
                <option value="">Todos</option>
                <option value="income">Ingresos</option>
                <option value="expense">Gastos</option>
              </select>
            </div>
            <div style="flex:1">
              <label class="small muted">Importe mín.</label><br/>
              <input type="number" id="minAmount" placeholder="0" style="width:100%" step="0.01">
            </div>
            <div style="flex:1">
              <label class="small muted">Importe máx.</label><br/>
              <input type="number" id="maxAmount" placeholder="∞" style="width:100%" step="0.01">
            </div>
            <div style="flex:1">
              <label class="small muted">Desde</label><br/>
              <input type="date" id="startDate" style="width:100%">
            </div>
            <div style="flex:1">
              <label class="small muted">Hasta</label><br/>
              <input type="date" id="endDate" style="width:100%">
            </div>
            <div>
              <button id="clearFilters" class="primary" style="background:#6b7280;border-color:#6b7280">Limpiar</button>
            </div>
          </div>
        </div>
      `;
      
      root.innerHTML = `
        <div class="row"><div class="col"><h1>Mes</h1></div></div>
        <div class="row"><div class="col">${filtersHtml}</div></div>
        <div id="content"></div>
      `;
      
      // Event listeners para filtros
      const filterElements = ['#search', '#bankFilter', '#typeFilter', '#minAmount', '#maxAmount', '#startDate', '#endDate'];
      filterElements.forEach(selector => {
        const element = root.querySelector(selector);
        if (element) {
          element.addEventListener('input', applyFilters);
          element.addEventListener('change', applyFilters);
        }
      });
      
      // Botón limpiar filtros
      root.querySelector('#clearFilters').onclick = () => {
        filterElements.forEach(selector => {
          const element = root.querySelector(selector);
          if (element) {
            element.value = '';
          }
        });
        filteredRows = [...allRows];
        renderView(filteredRows);
      };
      
      // Render inicial
      renderView(allRows);
      
    } catch (error) {
      showError(`Error al cargar vista mensual: ${error.message}`);
      root.innerHTML = `<div class="row"><div class="col"><div class="card">
        <h1>Error</h1>
        <p>No se pudo cargar la vista mensual. ${error.message}</p>
      </div></div></div>`;
    }
  }
};
export default view;
