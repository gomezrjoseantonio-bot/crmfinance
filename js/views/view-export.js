import { saveReal, getReal, getYear, getRecurrences, saveRecurrences, getPMA, savePMA } from '../storage.js';
import { fmtEUR, parseEuro } from '../utils.js';
import { parseXLSX, parseXLS } from '../../vendor/xlsx-lite.js';

function parseCSV(text){
  // autodetect delimiter ; , or tab
  const firstLine = text.split(/\r?\n/).find(Boolean) || '';
  let delim = ';'; if(firstLine.includes(',')) delim=','; if(firstLine.includes('\t')) delim='\t';
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines.shift().split(new RegExp(delim));
  return lines.map(l=>{
    const cols = l.split(new RegExp(delim));
    const obj = {}; head.forEach((h,i)=> obj[h.trim().toLowerCase()] = cols[i]||''); return obj;
  });
}

async function readFile(file){
  const name = file.name.toLowerCase();
  if(name.endsWith('.csv')){
    const text = await file.text();
    const rows = parseCSV(text);
    return rows.map(r=>({ raw:r }));
  }
  if(name.endsWith('.xlsx')){
    const rows = await parseXLSX(file); // returns array of arrays
    const head = rows.shift()||[];
    return rows.map(r=>{ const o={}; head.forEach((h,i)=>o[h?.toString().trim().toLowerCase()]=r[i]); return {raw:o}; });
  }
  if(name.endsWith('.xls')){
    const rows = await parseXLS(file);
    const head = rows.shift()||[];
    return rows.map(r=>{ const o={}; head.forEach((h,i)=>o[h?.toString().trim().toLowerCase()]=r[i]); return {raw:o}; });
  }
  alert('Formato no soportado. Usa .CSV, .XLS o .XLSX'); return [];
}

const view = {
  route:'#/export', title:'Export/Import',
  async mount(root){
    root.innerHTML = `<div class="row"><div class="col"><div class="card">
      <h1>💾 Import/Export Avanzado</h1>
      <div class="small muted">Gestión completa de datos con validación y mapeo</div>
      
      <div class="row" style="margin-top:20px">
        <div class="col">
          <h2>📥 Importar datos</h2>
          
          <div style="margin:10px 0">
            <label class="small muted">Tipo de datos</label><br/>
            <select id="importType" style="width:200px">
              <option value="movements">Movimientos</option>
              <option value="recurrences">Recurrencias</option>
              <option value="salary">Plan de nómina</option>
            </select>
          </div>
          
          <div style="margin:10px 0; display:flex; gap:10px; align-items:center;">
            <input type="file" id="file" accept=".csv,.xls,.xlsx"/>
            <button class="primary" id="load">📂 Cargar</button>
          </div>
          
          <div id="importPreview" style="display:none; margin-top:15px">
            <h3>🔍 Vista previa y mapeo</h3>
            <div id="mappingControls"></div>
            <div id="previewData"></div>
            <button id="confirmImport" class="primary" style="margin-top:10px">✅ Confirmar importación</button>
          </div>
        </div>
        
        <div class="col">
          <h2>📤 Exportar datos</h2>
          
          <div style="margin:10px 0">
            <button id="exportCSV" class="primary">📊 Exportar movimientos CSV</button>
          </div>
          
          <div style="margin:10px 0">
            <button id="exportJSON">💾 Backup completo JSON</button>
          </div>
          
          <div style="margin:10px 0">
            <button id="exportPDF">📄 Imprimir/PDF</button>
          </div>
          
          <div id="exportResult" style="margin-top:15px"></div>
        </div>
      </div>
      
      <div id="validationResults" style="margin-top:20px"></div>
    </div></div></div>`;

    let currentData = [];
    let currentHeaders = [];
    
    root.querySelector('#load').onclick = async () => {
      const file = root.querySelector('#file').files[0];
      if (!file) { alert('Selecciona un archivo'); return; }
      
      try {
        currentData = await readFile(file);
        
        if (!currentData || currentData.length === 0) {
          alert('No se pudieron leer datos del archivo');
          return;
        }
        
        currentHeaders = Object.keys(currentData[0].raw);
        showImportPreview(root, currentData, currentHeaders);
        
      } catch (error) {
        alert('Error al leer el archivo: ' + error.message);
      }
    };
    
    root.querySelector('#confirmImport').onclick = () => {
      confirmImport(root, currentData, currentHeaders);
    };
    
    // Export handlers
    root.querySelector('#exportCSV').onclick = () => exportCSV(root);
    root.querySelector('#exportJSON').onclick = () => exportJSON(root);
    root.querySelector('#exportPDF').onclick = () => {
      window.print();
      root.querySelector('#exportResult').innerHTML = '<div style="color:green">✅ Función de impresión activada</div>';
    };
  }
};

function showImportPreview(root, data, headers) {
  const importType = root.querySelector('#importType').value;
  const mappingFields = getFieldsForType(importType);
  
  // Create mapping controls
  const mappingHTML = mappingFields.map(field => `
    <div style="display:inline-block; margin:5px">
      <label class="small muted">${field.label} ${field.required ? '*' : ''}</label><br/>
      <select id="map-${field.key}" style="width:120px">
        <option value="">-- Seleccionar --</option>
        ${headers.map(h => `<option value="${h}" ${field.autoDetect && h.toLowerCase().includes(field.autoDetect) ? 'selected' : ''}>${h}</option>`).join('')}
      </select>
    </div>
  `).join('');
  
  root.querySelector('#mappingControls').innerHTML = mappingHTML;
  
  // Preview first 5 rows
  const previewRows = data.slice(0, 5).map(row => `
    <tr>${headers.map(h => `<td>${row.raw[h] || ''}</td>`).join('')}</tr>
  `).join('');
  
  root.querySelector('#previewData').innerHTML = `
    <div class="grid" style="margin-top:10px">
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${previewRows}</tbody>
      </table>
    </div>
    <div class="small muted">Mostrando ${Math.min(5, data.length)} de ${data.length} filas</div>
  `;
  
  root.querySelector('#importPreview').style.display = 'block';
}

function getFieldsForType(type) {
  const fieldMaps = {
    movements: [
      { key: 'date', label: 'Fecha', required: true, autoDetect: 'fecha' },
      { key: 'concept', label: 'Concepto', required: true, autoDetect: 'concepto' },
      { key: 'amount', label: 'Importe', required: true, autoDetect: 'importe' },
      { key: 'bank', label: 'Banco', required: false, autoDetect: 'banco' },
      { key: 'category', label: 'Categoría', required: false, autoDetect: 'categoria' }
    ],
    recurrences: [
      { key: 'type', label: 'Tipo', required: true, autoDetect: 'tipo' },
      { key: 'concept', label: 'Concepto', required: true, autoDetect: 'concepto' },
      { key: 'amount', label: 'Importe', required: true, autoDetect: 'importe' },
      { key: 'frequency', label: 'Frecuencia', required: true, autoDetect: 'frecuencia' },
      { key: 'account', label: 'Cuenta', required: true, autoDetect: 'cuenta' },
      { key: 'day', label: 'Día', required: false, autoDetect: 'dia' }
    ],
    salary: [
      { key: 'month', label: 'Mes', required: true, autoDetect: 'mes' },
      { key: 'gross', label: 'Bruto', required: true, autoDetect: 'bruto' },
      { key: 'variable', label: 'Variable', required: false, autoDetect: 'variable' }
    ]
  };
  
  return fieldMaps[type] || fieldMaps.movements;
}

function confirmImport(root, data, headers) {
  const importType = root.querySelector('#importType').value;
  const fieldMap = {};
  
  // Get field mappings
  getFieldsForType(importType).forEach(field => {
    const mappedColumn = root.querySelector(`#map-${field.key}`).value;
    if (mappedColumn) fieldMap[field.key] = mappedColumn;
  });
  
  // Validate and process data
  const { validData, errors } = validateAndProcessData(data, fieldMap, importType);
  
  if (errors.length > 0) {
    showValidationErrors(root, errors);
    return;
  }
  
  // Import data
  try {
    switch (importType) {
      case 'movements':
        importMovements(validData);
        break;
      case 'recurrences':
        importRecurrences(validData);
        break;
      case 'salary':
        importSalaryPlan(validData);
        break;
      default:
        throw new Error('Tipo de importación no soportado');
    }
    
    alert(`✅ Importación completada: ${validData.length} registros procesados`);
    root.querySelector('#importPreview').style.display = 'none';
    
  } catch (error) {
    alert('❌ Error en la importación: ' + error.message);
  }
}

function validateAndProcessData(data, fieldMap, type) {
  const validData = [];
  const errors = [];
  
  data.forEach((row, index) => {
    const processedRow = {};
    let hasErrors = false;
    
    // Map fields
    Object.entries(fieldMap).forEach(([key, column]) => {
      processedRow[key] = row.raw[column];
    });
    
    // Validate based on type
    if (type === 'movements') {
      if (!processedRow.date || !processedRow.concept) {
        errors.push(`Fila ${index + 1}: Fecha y concepto son obligatorios`);
        hasErrors = true;
      }
      
      const amount = parseEuro(processedRow.amount);
      if (isNaN(amount)) {
        errors.push(`Fila ${index + 1}: Importe inválido`);
        hasErrors = true;
      }
      processedRow.amount = amount;
      
      // Validate date format
      if (processedRow.date && !/\d{4}-\d{2}-\d{2}/.test(processedRow.date)) {
        if (/\d{2}\/\d{2}\/\d{4}/.test(processedRow.date)) {
          const [dd, mm, yyyy] = processedRow.date.split('/');
          processedRow.date = `${yyyy}-${mm}-${dd}`;
        } else {
          errors.push(`Fila ${index + 1}: Formato de fecha inválido`);
          hasErrors = true;
        }
      }
    }
    
    if (!hasErrors) validData.push(processedRow);
  });
  
  return { validData, errors };
}

function importMovements(data) {
  const existing = getReal();
  const newMovements = data.map(row => ({
    date: row.date,
    bank: row.bank || 'SIN_BANCO',
    concept: row.concept,
    amount: row.amount,
    category: row.category || 'SIN_CATEGORIA'
  }));
  
  saveReal([...existing, ...newMovements]);
}

function importRecurrences(data) {
  const existing = getRecurrences();
  const newRecurrences = data.map(row => ({
    type: row.type.toUpperCase(),
    concept: row.concept,
    accountId: row.account,
    amount: parseEuro(row.amount),
    frequency: row.frequency.toUpperCase(),
    day: parseInt(row.day) || 1,
    id: Date.now().toString() + Math.random()
  }));
  
  saveRecurrences([...existing, ...newRecurrences]);
}

function importSalaryPlan(data) {
  const pma = getPMA();
  if (!pma.salary) pma.salary = {};
  
  data.forEach(row => {
    const month = parseInt(row.month);
    if (month >= 1 && month <= 12) {
      pma.salary.variableByMonth = pma.salary.variableByMonth || {};
      pma.salary.variableByMonth[month] = parseEuro(row.variable) || 0;
    }
  });
  
  savePMA(pma);
}

function showValidationErrors(root, errors) {
  const errorHTML = `
    <div style="background:#fee; border:1px solid #fcc; border-radius:8px; padding:15px">
      <strong style="color:#c33">❌ Errores de validación:</strong>
      <ul style="margin:10px 0; color:#c33">
        ${errors.map(error => `<li>${error}</li>`).join('')}
      </ul>
      <div class="small">Corrige los errores y vuelve a intentar la importación</div>
    </div>
  `;
  root.querySelector('#validationResults').innerHTML = errorHTML;
}

function exportCSV(root) {
  const real = getReal();
  const headers = ['Fecha', 'Banco', 'Concepto', 'Importe', 'Categoria'];
  const csvContent = [
    headers.join(';'),
    ...real.map(row => [
      row.date,
      row.bank,
      row.concept,
      row.amount.toString().replace('.', ','),
      row.category || ''
    ].join(';'))
  ].join('\n');
  
  downloadFile(csvContent, 'movimientos.csv', 'text/csv');
  root.querySelector('#exportResult').innerHTML = '<div style="color:green">✅ CSV exportado correctamente</div>';
}

function exportJSON(root) {
  const backup = {
    real: getReal(),
    recurrences: getRecurrences(),
    pma: getPMA(),
    timestamp: new Date().toISOString(),
    version: 'Finari v0.3'
  };
  
  const jsonContent = JSON.stringify(backup, null, 2);
  downloadFile(jsonContent, `finari-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  root.querySelector('#exportResult').innerHTML = '<div style="color:green">✅ Backup JSON creado correctamente</div>';
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export default view;