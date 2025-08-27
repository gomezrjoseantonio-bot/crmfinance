import { getSettings, setSettings, getAccounts, saveAccounts, setYear, getYear, applyTheme, getReal } from '../storage.js';
import { showError, showSuccess, showWarning, confirmAction, validateRequired, validateNumber } from '../utils.js';

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
            <input type="number" id="year" value="${getYear()}" style="width:140px" min="1900" max="2100"> 
            <button class="primary" id="saveYear">Guardar</button>
            <div style="height:10px"></div>
            <label class="small muted">Tema</label><br/>
            <select id="theme" style="width:140px">
              <option value="light" ${s.theme==='light'?'selected':''}>Claro</option>
              <option value="dark" ${s.theme==='dark'?'selected':''}>Oscuro</option>
            </select>
            <div style="height:10px"></div>
            <label class="small muted">Color de acento (#HEX)</label><br/>
            <input id="accent" value="${s.accent||'#7c3aed'}" style="width:140px" pattern="^#[0-9A-Fa-f]{6}$" title="Formato: #RRGGBB"> 
            <button id="apply" class="primary">Aplicar</button>
            <div style="height:20px"></div>
            <h2>Gestión de Datos</h2>
            <button id="exportData" class="primary">Exportar Datos</button>
            <button id="clearData" style="background:#dc2626;border-color:#dc2626;margin-left:10px">Limpiar Datos</button>
          </div>
          <div class="col">
            <h2>Cuentas bancarias</h2>
            <div class="grid"><table id="acct"><thead><tr><th>ID</th><th>Nombre</th><th>Umbral</th><th></th></tr></thead><tbody></tbody></table></div>
            <div style="margin-top:6px">
              <input placeholder="ID" id="id" style="width:110px" required>
              <input placeholder="Nombre" id="name" style="width:180px" required>
              <input placeholder="Umbral" id="thr" type="number" style="width:110px" min="0" step="0.01">
              <button id="add" class="primary">Añadir</button>
            </div>
          </div>
        </div>
      </div></div>
    </div>`;
    const tbody = root.querySelector('#acct tbody');
    function draw(){
      try {
        const a = getAccounts();
        tbody.innerHTML = a.map((r,i)=>`<tr><td>${r.id}</td><td>${r.name}</td><td>${r.threshold || 0}</td>
        <td><button data-i="${i}" class="del">Borrar</button></td></tr>`).join('');
        tbody.querySelectorAll('.del').forEach(b=> b.onclick = ()=>{
          const idx = +b.getAttribute('data-i');
          const accountName = getAccounts()[idx]?.name || 'esta cuenta';
          confirmAction(
            `¿Está seguro de eliminar la cuenta "${accountName}"?`,
            () => {
              const arr = getAccounts(); 
              arr.splice(idx,1); 
              saveAccounts(arr); 
              draw();
              showSuccess('Cuenta eliminada correctamente');
            }
          );
        });
      } catch (error) {
        showError(`Error al cargar cuentas: ${error.message}`);
      }
    }
    draw();

    root.querySelector('#add').onclick = ()=>{
      try {
        const id = root.querySelector('#id').value.trim();
        const name = root.querySelector('#name').value.trim();
        const thrInput = root.querySelector('#thr').value;
        
        validateRequired(id, 'ID de cuenta');
        validateRequired(name, 'Nombre de cuenta');
        
        const thr = thrInput ? validateNumber(thrInput, 'Umbral', 0) : 0;
        
        // Verificar que no exista ya una cuenta con ese ID
        const arr = getAccounts();
        if (arr.some(account => account.id === id)) {
          throw new Error('Ya existe una cuenta con ese ID');
        }
        
        arr.push({id, name, threshold:thr}); 
        saveAccounts(arr); 
        draw();
        
        // Limpiar formulario
        root.querySelector('#id').value=''; 
        root.querySelector('#name').value=''; 
        root.querySelector('#thr').value='';
        
        showSuccess('Cuenta añadida correctamente');
      } catch (error) {
        showError(error.message);
      }
    };
    
    root.querySelector('#apply').onclick = ()=>{
      try {
        const theme = root.querySelector('#theme').value;
        const accent = root.querySelector('#accent').value;
        
        // Validar formato de color hexadecimal
        if (!/^#[0-9A-Fa-f]{6}$/.test(accent)) {
          throw new Error('Color de acento debe tener formato #RRGGBB');
        }
        
        const s = getSettings(); 
        s.theme=theme; 
        s.accent=accent; 
        setSettings(s); 
        applyTheme();
        showSuccess('Configuración aplicada correctamente');
      } catch (error) {
        showError(`Error al aplicar configuración: ${error.message}`);
      }
    };
    
    root.querySelector('#saveYear').onclick = ()=>{
      try {
        const yearInput = root.querySelector('#year').value;
        validateRequired(yearInput, 'Año');
        const y = validateNumber(yearInput, 'Año', 1900, 2100);
        
        setYear(y); 
        showSuccess('Año guardado correctamente');
      } catch (error) {
        showError(`Error al guardar año: ${error.message}`);
      }
    };

    // Nueva funcionalidad: Exportar datos
    root.querySelector('#exportData').onclick = ()=>{
      try {
        const data = {
          settings: getSettings(),
          accounts: getAccounts(),
          transactions: getReal(),
          exportDate: new Date().toISOString(),
          version: '0.2'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `finari-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showSuccess('Datos exportados correctamente');
      } catch (error) {
        showError(`Error al exportar datos: ${error.message}`);
      }
    };

    // Nueva funcionalidad: Limpiar datos
    root.querySelector('#clearData').onclick = ()=>{
      confirmAction(
        '⚠️ ADVERTENCIA: Esta acción eliminará TODOS los datos de la aplicación (configuración, cuentas y transacciones). ¿Está completamente seguro?',
        () => {
          try {
            localStorage.clear();
            showWarning('Todos los datos han sido eliminados. La página se recargará.');
            setTimeout(() => location.reload(), 2000);
          } catch (error) {
            showError(`Error al limpiar datos: ${error.message}`);
          }
        }
      );
    };
  }
};
export default view;
