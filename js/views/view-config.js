import { getSettings, setSettings, getAccounts, saveAccounts, setYear, getYear, applyTheme } from '../storage.js';

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
      </div></div>
    </div>`;
    const tbody = root.querySelector('#acct tbody');
    function draw(){
      const a = getAccounts();
      tbody.innerHTML = a.map((r,i)=>`<tr><td>${r.id}</td><td>${r.name}</td><td>${r.threshold}</td>
      <td><button data-i="${i}" class="del">Borrar</button></td></tr>`).join('');
      tbody.querySelectorAll('.del').forEach(b=> b.onclick = ()=>{
        const idx = +b.getAttribute('data-i');
        const arr = getAccounts(); arr.splice(idx,1); saveAccounts(arr); draw();
      });
    }
    draw();

    root.querySelector('#add').onclick = ()=>{
      const id = root.querySelector('#id').value.trim();
      const name = root.querySelector('#name').value.trim();
      const thr = parseFloat(root.querySelector('#thr').value||0);
      if(!id || !name) return;
      const arr = getAccounts(); arr.push({id, name, threshold:thr}); saveAccounts(arr); draw();
      root.querySelector('#id').value=''; root.querySelector('#name').value=''; root.querySelector('#thr').value='';
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
