import { getSettings, setSettings, getAccounts, saveAccounts, setYear, getYear, applyTheme, getCategories, saveCategories, getBudgets, saveBudgets } from '../storage.js';

const view = {
  route:'#/config', title:'Configuración',
  async mount(root){
    const s = getSettings();
    const acc = getAccounts();
    root.innerHTML = `<div class="row">
      <div class="col"><div class="card">
        <h1>Configuración</h1>
        <div class="row">
          <div class="col">
            <h2>Preferencias</h2>
            <label class="small muted">Año activo</label><br/>
            <input type="number" id="year" value="${getYear()}" style="width:140px"> 
            <button class="primary" id="saveYear">Guardar</button>
            <div style="height:10px"></div>
            <label class="small muted">Tema</label><br/>
            <select id="theme" style="width:140px">
              <option value="light" ${s.theme==='light'?'selected':''}>Claro</option>
              <option value="dark" ${s.theme==='dark'?'selected':''}>Oscuro</option>
            </select>
            <div style="height:10px"></div>
            <label class="small muted">Color de acento (#HEX)</label><br/>
            <input id="accent" value="${s.accent||'#7c3aed'}" style="width:140px"> 
            <button id="apply" class="primary">Aplicar</button>
          </div>
          <div class="col">
            <h2>Cuentas bancarias</h2>
            <div class="grid"><table id="acct"><thead><tr><th>ID</th><th>Nombre</th><th>Umbral</th><th></th></tr></thead><tbody></tbody></table></div>
            <div style="margin-top:6px">
              <input placeholder="ID" id="id" style="width:110px">
              <input placeholder="Nombre" id="name" style="width:180px">
              <input placeholder="Umbral" id="thr" type="number" style="width:110px">
              <button id="add" class="primary">Añadir</button>
            </div>
          </div>
        </div>
        <div class="row" style="margin-top:16px">
          <div class="col">
            <h2>Categorías</h2>
            <div class="grid"><table id="cat"><thead><tr><th>ID</th><th>Nombre</th><th>Color</th><th>Tipo</th><th></th></tr></thead><tbody></tbody></table></div>
            <div style="margin-top:6px">
              <input placeholder="ID" id="catId" style="width:90px">
              <input placeholder="Nombre" id="catName" style="width:120px">
              <input placeholder="#COLOR" id="catColor" style="width:80px">
              <select id="catType" style="width:90px">
                <option value="income">Ingreso</option>
                <option value="expense">Gasto</option>
              </select>
              <button id="addCat" class="primary">Añadir</button>
            </div>
          </div>
        </div>
        <div class="row" style="margin-top:16px">
          <div class="col">
            <h2>Presupuestos Mensuales</h2>
            <div class="grid"><table id="budget"><thead><tr><th>Categoría</th><th>Límite Mensual</th><th>Alerta (%)</th><th></th></tr></thead><tbody></tbody></table></div>
            <div style="margin-top:6px">
              <select id="budgetCat" style="width:120px">
                <option value="">Seleccionar...</option>
              </select>
              <input placeholder="Límite €" id="budgetLimit" type="number" style="width:100px">
              <input placeholder="80" id="budgetAlert" type="number" min="50" max="100" value="80" style="width:60px">
              <button id="addBudget" class="primary">Añadir</button>
            </div>
          </div>
        </div>
      </div></div>
    </div>`;
    const tbody = root.querySelector('#acct tbody');
    const catTbody = root.querySelector('#cat tbody');
    const budgetTbody = root.querySelector('#budget tbody');
    const budgetCatSelect = root.querySelector('#budgetCat');
    
    function draw(){
      const a = getAccounts();
      tbody.innerHTML = a.map((r,i)=>`<tr><td>${r.id}</td><td>${r.name}</td><td>${r.threshold}</td>
      <td><button data-i="${i}" class="del">Borrar</button></td></tr>`).join('');
      tbody.querySelectorAll('.del').forEach(b=> b.onclick = ()=>{
        const idx = +b.getAttribute('data-i');
        const arr = getAccounts(); arr.splice(idx,1); saveAccounts(arr); draw();
      });
    }
    
    function drawCategories(){
      const cats = getCategories();
      catTbody.innerHTML = cats.map((r,i)=>`<tr><td>${r.id}</td><td>${r.name}</td>
      <td><span style="color:${r.color}">${r.color}</span></td><td>${r.type==='income'?'Ingreso':'Gasto'}</td>
      <td><button data-i="${i}" class="delCat">Borrar</button></td></tr>`).join('');
      catTbody.querySelectorAll('.delCat').forEach(b=> b.onclick = ()=>{
        const idx = +b.getAttribute('data-i');
        const arr = getCategories(); arr.splice(idx,1); saveCategories(arr); drawCategories(); updateBudgetSelect();
      });
      updateBudgetSelect();
    }
    
    function updateBudgetSelect(){
      const cats = getCategories().filter(c => c.type === 'expense');
      budgetCatSelect.innerHTML = '<option value="">Seleccionar...</option>' + 
        cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    
    function drawBudgets(){
      const budgets = getBudgets();
      const cats = getCategories();
      const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
      
      budgetTbody.innerHTML = budgets.map((r,i)=>{
        const cat = catMap[r.categoryId];
        return `<tr><td>${cat ? cat.name : r.categoryId}</td><td>${r.monthlyLimit}€</td><td>${(r.alertThreshold*100).toFixed(0)}%</td>
        <td><button data-i="${i}" class="delBudget">Borrar</button></td></tr>`;
      }).join('');
      budgetTbody.querySelectorAll('.delBudget').forEach(b=> b.onclick = ()=>{
        const idx = +b.getAttribute('data-i');
        const arr = getBudgets(); arr.splice(idx,1); saveBudgets(arr); drawBudgets();
      });
    }
    
    draw();
    drawCategories();
    drawBudgets();

    root.querySelector('#add').onclick = ()=>{
      const id = root.querySelector('#id').value.trim();
      const name = root.querySelector('#name').value.trim();
      const thr = parseFloat(root.querySelector('#thr').value||0);
      if(!id || !name) return;
      const arr = getAccounts(); arr.push({id, name, threshold:thr}); saveAccounts(arr); draw();
      root.querySelector('#id').value=''; root.querySelector('#name').value=''; root.querySelector('#thr').value='';
    };
    
    root.querySelector('#addCat').onclick = ()=>{
      const id = root.querySelector('#catId').value.trim();
      const name = root.querySelector('#catName').value.trim();
      const color = root.querySelector('#catColor').value.trim();
      const type = root.querySelector('#catType').value;
      if(!id || !name || !color) return;
      const arr = getCategories(); arr.push({id, name, color, type}); saveCategories(arr); drawCategories();
      root.querySelector('#catId').value=''; root.querySelector('#catName').value=''; root.querySelector('#catColor').value='';
    };
    
    root.querySelector('#addBudget').onclick = ()=>{
      const categoryId = root.querySelector('#budgetCat').value;
      const monthlyLimit = parseFloat(root.querySelector('#budgetLimit').value || 0);
      const alertThreshold = parseInt(root.querySelector('#budgetAlert').value || 80) / 100;
      if(!categoryId || monthlyLimit <= 0) return;
      
      const budgets = getBudgets();
      const existingIndex = budgets.findIndex(b => b.categoryId === categoryId);
      if(existingIndex >= 0) {
        budgets[existingIndex] = {categoryId, monthlyLimit, alertThreshold};
      } else {
        budgets.push({categoryId, monthlyLimit, alertThreshold});
      }
      saveBudgets(budgets); drawBudgets();
      root.querySelector('#budgetCat').value=''; root.querySelector('#budgetLimit').value=''; root.querySelector('#budgetAlert').value='80';
    };
    root.querySelector('#apply').onclick = ()=>{
      const theme = root.querySelector('#theme').value;
      const accent = root.querySelector('#accent').value;
      const s = getSettings(); s.theme=theme; s.accent=accent; setSettings(s); applyTheme();
    };
    root.querySelector('#saveYear').onclick = ()=>{
      const y = parseInt(root.querySelector('#year').value||new Date().getFullYear(),10);
      setYear(y); alert('Año guardado');
    };
  }
};
export default view;
