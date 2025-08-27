import { saveReal, getReal, getYear } from '../storage.js';
import { fmtEUR, parseEuro, showError, showSuccess, showWarning, validateRequired } from '../utils.js';
import { parseXLSX, parseXLS } from '../../vendor/xlsx-lite.js';

function parseCSV(text){
  try {
    // autodetect delimiter ; , or tab
    const firstLine = text.split(/\r?\n/).find(Boolean) || '';
    let delim = ';'; if(firstLine.includes(',')) delim=','; if(firstLine.includes('\t')) delim='\t';
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) {
      throw new Error('El archivo CSV está vacío');
    }
    const head = lines.shift().split(new RegExp(delim));
    return lines.map(l=>{
      const cols = l.split(new RegExp(delim));
      const obj = {}; head.forEach((h,i)=> obj[h.trim().toLowerCase()] = cols[i]||''); return obj;
    });
  } catch (error) {
    throw new Error(`Error al procesar CSV: ${error.message}`);
  }
}

async function readFile(file){
  try {
    if (!file) {
      throw new Error('No se ha seleccionado ningún archivo');
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('El archivo es demasiado grande (máximo 10MB)');
    }
    
    const name = file.name.toLowerCase();
    let rows = [];
    
    if(name.endsWith('.csv')){
      const text = await file.text();
      if (!text.trim()) {
        throw new Error('El archivo CSV está vacío');
      }
      const parsedRows = parseCSV(text);
      rows = parsedRows.map(r=>({ raw:r }));
    } else if(name.endsWith('.xlsx')){
      const parsedRows = await parseXLSX(file); // returns array of arrays
      if (!parsedRows || parsedRows.length === 0) {
        throw new Error('El archivo XLSX está vacío o es inválido');
      }
      const head = parsedRows.shift()||[];
      rows = parsedRows.map(r=>{ const o={}; head.forEach((h,i)=>o[h?.toString().trim().toLowerCase()]=r[i]); return {raw:o}; });
    } else if(name.endsWith('.xls')){
      const parsedRows = await parseXLS(file);
      if (!parsedRows || parsedRows.length === 0) {
        throw new Error('El archivo XLS está vacío o es inválido');
      }
      const head = parsedRows.shift()||[];
      rows = parsedRows.map(r=>{ const o={}; head.forEach((h,i)=>o[h?.toString().trim().toLowerCase()]=r[i]); return {raw:o}; });
    } else {
      throw new Error('Formato no soportado. Use archivos .CSV, .XLS o .XLSX');
    }
    
    if (rows.length === 0) {
      throw new Error('No se encontraron datos válidos en el archivo');
    }
    
    return rows;
  } catch (error) {
    throw new Error(`Error al leer archivo: ${error.message}`);
  }
}

function showLoading(show = true) {
  const existingLoader = document.querySelector('#loading-overlay');
  if (existingLoader) {
    existingLoader.remove();
  }
  
  if (show) {
    const loader = document.createElement('div');
    loader.id = 'loading-overlay';
    loader.innerHTML = `
      <div style="
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
        background: rgba(0,0,0,0.5); z-index: 10000; 
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          background: var(--card); padding: 20px; border-radius: 12px; 
          border: 1px solid var(--border); text-align: center;
        ">
          <div style="
            width: 40px; height: 40px; margin: 0 auto 16px; 
            border: 3px solid var(--border); border-top: 3px solid var(--accent);
            border-radius: 50%; animation: spin 1s linear infinite;
          "></div>
          <div>Procesando archivo...</div>
        </div>
      </div>
      <style>
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    `;
    document.body.appendChild(loader);
  }
}

const view = {
  route:'#/importar', title:'Importar',
  async mount(root){
    root.innerHTML = `<div class="row"><div class="col"><div class="card">
      <h1>Importar movimientos</h1>
      <div class="small muted">Mapea columnas. No se tocan los ficheros originales.</div>
      <div style="margin:10px 0; display:flex; gap:10px; align-items:center;">
        <input type="file" id="file" accept=".csv,.xls,.xlsx"/>
        <button class="primary" id="load" disabled>Cargar</button>
      </div>
      <div id="file-info" style="display:none; margin:10px 0; padding:8px; background:var(--card); border:1px solid var(--border); border-radius:8px;">
        <div class="small muted" id="file-details"></div>
      </div>
      <div class="row" id="mapper" style="display:none; gap:10px;">
        <label>Fecha <select id="map-date"><option value="">Seleccionar...</option></select></label>
        <label>Concepto <select id="map-concept"><option value="">Seleccionar...</option></select></label>
        <label>Importe <select id="map-amount"><option value="">Seleccionar...</option></select></label>
        <label>Banco/IBAN (opcional) <select id="map-bank"><option value="">Seleccionar...</option></select></label>
        <button id="apply" class="primary" disabled>Aplicar mapeo + Guardar</button>
      </div>
      <div id="preview-info" style="display:none; margin:10px 0;">
        <div class="small muted">Vista previa (primeras 10 filas):</div>
      </div>
      <div class="grid" style="margin-top:12px; display:none;" id="preview-container">
        <table id="preview"></table>
      </div>
    </div></div></div>`;

    const fileEl = root.querySelector('#file');
    const loadBtn = root.querySelector('#load');
    const mapper = root.querySelector('#mapper');
    const table = root.querySelector('#preview');
    const fileInfo = root.querySelector('#file-info');
    const fileDetails = root.querySelector('#file-details');
    const previewInfo = root.querySelector('#preview-info');
    const previewContainer = root.querySelector('#preview-container');
    const applyBtn = root.querySelector('#apply');
    let parsed = [];

    // Habilitar botón cuando se seleccione archivo
    fileEl.onchange = () => {
      const file = fileEl.files?.[0];
      if (file) {
        loadBtn.disabled = false;
        fileDetails.textContent = `Archivo: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
        fileInfo.style.display = 'block';
      } else {
        loadBtn.disabled = true;
        fileInfo.style.display = 'none';
        mapper.style.display = 'none';
        previewContainer.style.display = 'none';
        previewInfo.style.display = 'none';
      }
    };

    loadBtn.onclick = async ()=>{
      try {
        const f = fileEl.files?.[0];
        validateRequired(f, 'Archivo');
        
        showLoading(true);
        loadBtn.disabled = true;
        
        parsed = await readFile(f);
        
        if(!parsed.length){ 
          throw new Error('No se han podido leer filas del archivo');
        }
        
        const cols = Object.keys(parsed[0].raw);
        ['map-date','map-concept','map-amount','map-bank'].forEach(id=>{
          const sel = root.querySelector('#'+id); 
          sel.innerHTML = '<option value="">Seleccionar...</option>' + 
            cols.map(c=>`<option value="${c}">${c}</option>`).join('');
        });
        
        // preview
        const first10 = parsed.slice(0,10);
        table.innerHTML = '<thead><tr>'+Object.keys(parsed[0].raw).map(h=>`<th>${h}</th>`).join('')+'</tr></thead><tbody>'+
          first10.map(r=>'<tr>'+Object.values(r.raw).map(v=>`<td>${v??''}</td>`).join('')+'</tr>').join('')+'</tbody>';
        
        mapper.style.display='flex';
        previewInfo.style.display='block';
        previewContainer.style.display='block';
        
        showSuccess(`Archivo cargado correctamente: ${parsed.length} filas encontradas`);
        
        // Validar selecciones de mapeo
        const validateMapping = () => {
          const dateCol = root.querySelector('#map-date').value;
          const conceptCol = root.querySelector('#map-concept').value;
          const amountCol = root.querySelector('#map-amount').value;
          applyBtn.disabled = !dateCol || !conceptCol || !amountCol;
        };
        
        ['map-date','map-concept','map-amount','map-bank'].forEach(id=>{
          root.querySelector('#'+id).addEventListener('change', validateMapping);
        });
        
      } catch (error) {
        showError(error.message);
      } finally {
        showLoading(false);
        loadBtn.disabled = false;
      }
    };

    root.querySelector('#apply').onclick = async ()=>{
      try {
        const cDate = root.querySelector('#map-date').value;
        const cConcept = root.querySelector('#map-concept').value;
        const cAmount = root.querySelector('#map-amount').value;
        const cBank = root.querySelector('#map-bank').value;
        
        validateRequired(cDate, 'Columna de fecha');
        validateRequired(cConcept, 'Columna de concepto');
        validateRequired(cAmount, 'Columna de importe');
        
        showLoading(true);
        applyBtn.disabled = true;
        
        const y = getYear();
        const existing = getReal(y);
        let importedCount = 0;
        let errorCount = 0;
        const errors = [];
        
        const mapped = parsed.map((r, index) => {
          try {
            const o = r.raw;
            // fecha dd/mm/aaaa o yyyy-mm-dd
            let d = (o[cDate] || '').toString().trim();
            if (/\d{2}\/\d{2}\/\d{4}/.test(d)) { 
              const [dd, mm, yy] = d.split('/'); 
              d = `${yy}-${mm}-${dd}`; 
            }
            
            if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
              throw new Error(`Fecha inválida en fila ${index + 1}: ${d}`);
            }
            
            const concept = (o[cConcept] || '').toString().trim();
            if (!concept) {
              throw new Error(`Concepto vacío en fila ${index + 1}`);
            }
            
            const amount = parseEuro(o[cAmount]);
            if (isNaN(amount)) {
              throw new Error(`Importe inválido en fila ${index + 1}: ${o[cAmount]}`);
            }
            
            const bank = (o[cBank] || 'SIN_BANCO').toString().trim() || 'SIN_BANCO';
            
            importedCount++;
            return { date: d, bank, concept, amount };
          } catch (error) {
            errorCount++;
            errors.push(error.message);
            return null;
          }
        }).filter(x => x !== null);
        
        if (mapped.length === 0) {
          throw new Error('No se pudo procesar ninguna fila válida');
        }
        
        // Verificar duplicados simples (misma fecha, concepto y monto)
        const duplicates = [];
        const existingKeys = new Set(existing.map(t => `${t.date}-${t.concept}-${t.amount}`));
        const newTransactions = mapped.filter(t => {
          const key = `${t.date}-${t.concept}-${t.amount}`;
          if (existingKeys.has(key)) {
            duplicates.push(t);
            return false;
          }
          existingKeys.add(key);
          return true;
        });
        
        if (duplicates.length > 0) {
          showWarning(`Se encontraron ${duplicates.length} posibles duplicados que fueron omitidos`);
        }
        
        await saveReal(existing.concat(newTransactions), y);
        
        let message = `✅ Importación completada: ${newTransactions.length} transacciones importadas`;
        if (errorCount > 0) {
          message += `\n⚠️ ${errorCount} filas con errores fueron omitidas`;
        }
        if (duplicates.length > 0) {
          message += `\n📋 ${duplicates.length} duplicados omitidos`;
        }
        
        showSuccess(message);
        
        // Limpiar formulario
        fileEl.value = '';
        mapper.style.display = 'none';
        previewContainer.style.display = 'none';
        previewInfo.style.display = 'none';
        fileInfo.style.display = 'none';
        loadBtn.disabled = true;
        parsed = [];
        
      } catch (error) {
        showError(`Error en importación: ${error.message}`);
      } finally {
        showLoading(false);
        applyBtn.disabled = false;
      }
    };
  }
};
export default view;
