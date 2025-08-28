import { saveReal, getReal, getYear, getRecurrences, saveRecurrences, getPMA, savePMA, getProperties, saveProperties, getBudgets, saveBudgets, getCategories } from '../storage.js';
import { fmtEUR, parseEuro, groupBy } from '../utils.js';
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
  
  try {
    if(name.endsWith('.csv')){
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows || rows.length === 0) {
        throw new Error('El archivo CSV no contiene datos válidos');
      }
      return rows.map(r=>({ raw:r }));
    }
    
    if(name.endsWith('.xlsx')){
      const rows = await parseXLSX(file); // returns array of arrays
      if (!rows || rows.length === 0) {
        throw new Error('El archivo XLSX no contiene datos válidos');
      }
      const head = rows.shift()||[];
      return rows.map(r=>{ const o={}; head.forEach((h,i)=>o[h?.toString().trim().toLowerCase()]=r[i]); return {raw:o}; });
    }
    
    if(name.endsWith('.xls')){
      // Try HTML table format first (common with some bank exports)
      let rows;
      try {
        rows = await parseXLS(file);
      } catch (htmlError) {
        // If HTML parsing fails, show helpful error message
        throw new Error('Este archivo .xls no es compatible. Por favor, conviértelo a .xlsx o .csv desde Excel:\n' +
                       '1. Abre el archivo en Excel\n' + 
                       '2. Guarda como → Libro de Excel (.xlsx) o CSV\n' +
                       '3. Vuelve a importar el archivo convertido');
      }
      
      if (!rows || rows.length === 0) {
        throw new Error('El archivo XLS no contiene datos válidos');
      }
      const head = rows.shift()||[];
      return rows.map(r=>{ const o={}; head.forEach((h,i)=>o[h?.toString().trim().toLowerCase()]=r[i]); return {raw:o}; });
    }
    
    throw new Error('Formato no soportado. Usa archivos .CSV, .XLS (exportados como HTML) o .XLSX');
    
  } catch (error) {
    alert('❌ Error al leer el archivo:\n' + error.message);
    throw error;
  }
}

const view = {
  route:'#/datos', title:'Gestión de Datos',
  async mount(root){
    // Get data for reports
    const rows = getReal();
    const categories = getCategories();
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    
    // Calculate category totals
    const byCategory = groupBy(rows, r => r.category || 'sin_categoria');
    const categoryData = Object.entries(byCategory).map(([catId, items]) => {
      const total = items.reduce((sum, item) => sum + Math.abs(item.amount), 0);
      const cat = catMap[catId] || {name: 'Sin categoría', color: '#gray'};
      return { id: catId, name: cat.name, color: cat.color, total, type: cat.type };
    });
    
    // Calculate monthly data
    const byMonth = groupBy(rows, r => r.date.substring(0, 7)); // YYYY-MM
    const monthlyData = Object.entries(byMonth).sort().map(([month, items]) => {
      const income = items.filter(x => x.amount > 0).reduce((sum, x) => sum + x.amount, 0);
      const expenses = items.filter(x => x.amount < 0).reduce((sum, x) => sum + Math.abs(x.amount), 0);
      return { month, income, expenses, net: income - expenses };
    });

    root.innerHTML = `<div class="row"><div class="col"><div class="card">
      <h1>📊 Gestión de Datos</h1>
      <div class="small muted">Importación, exportación y análisis completo de datos financieros</div>
      
      <div class="row" style="margin-top:20px">
        <div class="col">
          <h2>📥 Importar datos</h2>
          
          <div style="margin:10px 0">
            <label class="small muted">Tipo de datos</label><br/>
            <select id="importType" style="width:200px">
              <option value="movements">Movimientos bancarios</option>
              <option value="recurrences">Recurrencias</option>
              <option value="salary">Plan de nómina</option>
              <option value="budgets">Presupuestos</option>
              <option value="rentals">Rentas</option>
            </select>
          </div>
          
          <div style="margin:10px 0; display:flex; gap:10px; align-items:center; flex-direction:column">
            <div style="display:flex; gap:10px; align-items:center; width:100%">
              <input type="file" id="file" accept=".csv,.xlsx,.xls" title="Formatos soportados: CSV, XLSX, XLS (exportado como HTML)"/>
              <button class="primary" id="load">📂 Cargar</button>
            </div>
            <div class="small muted" style="text-align:center; max-width:500px">
              📋 <strong>Formatos soportados:</strong> CSV, XLSX, XLS<br/>
              💡 <strong>Tip:</strong> Si tu archivo .xls no funciona, ábrelo en Excel y guárdalo como .xlsx o .csv
            </div>
          </div>
          
          <div id="importPreview" style="display:none; margin-top:15px">
            <h3>🔍 Vista previa y mapeo</h3>
            <div id="mappingControls"></div>
            <div id="previewData"></div>
            <button id="confirmImport" class="primary" style="margin-top:10px">✅ Confirmar importación</button>
          </div>
        </div>
        
        <div class="col">
          <h2>📤 Exportar reportes</h2>
          
          <h3>📋 Reportes Básicos</h3>
          <div style="margin:10px 0">
            <button id="exportCSV" class="primary">📊 Exportar movimientos CSV</button>
          </div>
          
          <div style="margin:10px 0">
            <button id="exportJSON">💾 Backup completo JSON</button>
          </div>
          
          <h3 style="margin-top:20px; margin-bottom:10px;">🏠 Reportes de Inmuebles</h3>
          
          <div style="margin:10px 0">
            <button id="exportPropertiesXLS" class="primary">📊 Exportar Propiedades (XLS)</button>
          </div>
          
          <div style="margin:10px 0">
            <button id="exportOperatingCostsXLS">📋 Exportar Costes Operativos (XLS)</button>
          </div>
          
          <div style="margin:10px 0">
            <button id="exportYearlyRentalsXLS" class="primary">📅 Exportar Configuración Anual de Rentas (XLS)</button>
          </div>
          
          <div style="margin:10px 0">
            <button id="exportCompleteDataXLS">📁 Exportar Datos Completos (XLS)</button>
          </div>
          
          <div style="margin:10px 0">
            <button id="exportPDF">📄 Exportar PDF</button>
          </div>
          
          <div id="exportResult" style="margin-top:15px"></div>
        </div>
      </div>
      
      <div class="row" style="margin-top:30px">
        <div class="col">
          <div class="card">
            <h2>📈 Análisis Visual</h2>
            <div class="small muted">Gráficos y tendencias de tus finanzas</div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h3>Gastos por Categoría</h3>
            <canvas id="categoryChart" width="400" height="200"></canvas>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <h3>Tendencia Mensual</h3>
            <canvas id="monthlyChart" width="400" height="200"></canvas>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h3>Resumen por Categorías</h3>
            <div class="grid">
              <table>
                <thead>
                  <tr><th>Categoría</th><th>Total</th><th>Porcentaje</th></tr>
                </thead>
                <tbody>
                  ${categoryData.map(cat => {
                    const total = categoryData.reduce((sum, c) => sum + c.total, 0);
                    const percentage = total > 0 ? ((cat.total / total) * 100).toFixed(1) : 0;
                    return `<tr>
                      <td><span style="color:${cat.color}">●</span> ${cat.name}</td>
                      <td>${fmtEUR(cat.total)}</td>
                      <td>${percentage}%</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <div id="validationResults" style="margin-top:20px"></div>
    </div></div></div>`;

    let currentData = [];
    let currentHeaders = [];
    
    root.querySelector('#load').onclick = async () => {
      const file = root.querySelector('#file').files[0];
      if (!file) { 
        alert('📁 Por favor, selecciona un archivo para importar'); 
        return; 
      }
      
      // Show loading feedback
      const loadBtn = root.querySelector('#load');
      const originalText = loadBtn.textContent;
      loadBtn.textContent = '⏳ Cargando...';
      loadBtn.disabled = true;
      
      try {
        currentData = await readFile(file);
        
        if (!currentData || currentData.length === 0) {
          throw new Error('No se pudieron leer datos del archivo. Verifica que el archivo contenga datos válidos.');
        }
        
        currentHeaders = Object.keys(currentData[0].raw);
        
        if (currentHeaders.length === 0) {
          throw new Error('El archivo no contiene columnas válidas. Verifica el formato del archivo.');
        }
        
        showImportPreview(root, currentData, currentHeaders);
        
      } catch (error) {
        console.error('Error loading file:', error);
        
        // Clear any existing preview
        root.querySelector('#importPreview').style.display = 'none';
        
        // Show specific error message or fallback
        let errorMessage = error.message || 'Error desconocido al procesar el archivo';
        
        // Don't show alert again if readFile already showed one
        if (!errorMessage.includes('Error al leer el archivo')) {
          alert('❌ ' + errorMessage);
        }
      } finally {
        // Reset button state
        loadBtn.textContent = originalText;
        loadBtn.disabled = false;
      }
    };
    
    root.querySelector('#confirmImport').onclick = () => {
      confirmImport(root, currentData, currentHeaders);
    };
    
    // Export handlers
    root.querySelector('#exportCSV').onclick = () => exportCSV(root);
    root.querySelector('#exportJSON').onclick = () => exportJSON(root);
    root.querySelector('#exportPropertiesXLS').onclick = () => exportPropertiesXLS(root);
    root.querySelector('#exportOperatingCostsXLS').onclick = () => exportOperatingCostsXLS(root);
    root.querySelector('#exportYearlyRentalsXLS').onclick = () => exportYearlyRentalsXLS(root);
    root.querySelector('#exportCompleteDataXLS').onclick = () => exportCompleteDataXLS(root);
    root.querySelector('#exportPDF').onclick = () => {
      exportPDF(root);
    };
    
    // Initialize charts
    requestAnimationFrame(() => {
      initCharts(categoryData, monthlyData);
    });
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
    ],
    budgets: [
      { key: 'category', label: 'Categoría', required: true, autoDetect: 'categoria' },
      { key: 'amount', label: 'Presupuesto', required: true, autoDetect: 'presupuesto' },
      { key: 'month', label: 'Mes', required: false, autoDetect: 'mes' },
      { key: 'description', label: 'Descripción', required: false, autoDetect: 'descripcion' }
    ],
    rentals: [
      { key: 'property', label: 'Propiedad', required: true, autoDetect: 'propiedad' },
      { key: 'tenant', label: 'Inquilino', required: true, autoDetect: 'inquilino' },
      { key: 'amount', label: 'Renta', required: true, autoDetect: 'renta' },
      { key: 'date', label: 'Fecha', required: true, autoDetect: 'fecha' },
      { key: 'contract', label: 'Contrato', required: false, autoDetect: 'contrato' }
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
      case 'budgets':
        importBudgets(validData);
        break;
      case 'rentals':
        importRentals(validData);
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

function importBudgets(data) {
  const existing = getBudgets();
  const newBudgets = data.map(row => ({
    category: row.category,
    amount: parseEuro(row.amount),
    month: row.month || 'all',
    description: row.description || '',
    id: Date.now().toString() + Math.random()
  }));
  
  saveBudgets([...existing, ...newBudgets]);
}

function importRentals(data) {
  const existing = getProperties();
  
  // Group rental data by property for updating existing properties
  const rentalsByProperty = {};
  data.forEach(row => {
    const propertyName = row.property;
    if (!rentalsByProperty[propertyName]) {
      rentalsByProperty[propertyName] = [];
    }
    rentalsByProperty[propertyName].push({
      tenant: row.tenant,
      amount: parseEuro(row.amount),
      date: row.date,
      contract: row.contract || ''
    });
  });
  
  // Update existing properties or create new ones
  Object.entries(rentalsByProperty).forEach(([propertyName, rentals]) => {
    let property = existing.find(p => p.address === propertyName || p.id === propertyName);
    
    if (!property) {
      // Create new property
      property = {
        id: Date.now().toString() + Math.random(),
        address: propertyName,
        city: '',
        postalCode: '',
        region: '',
        monthlyRent: rentals[0]?.amount || 0,
        rentals: rentals
      };
      existing.push(property);
    } else {
      // Update existing property
      property.rentals = property.rentals || [];
      property.rentals.push(...rentals);
      if (rentals.length > 0) {
        property.monthlyRent = rentals[rentals.length - 1].amount;
      }
    }
  });
  
  saveProperties(existing);
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

function exportPropertiesXLS(root) {
  const properties = getProperties();
  
  if (properties.length === 0) {
    root.querySelector('#exportResult').innerHTML = '<div style="color:orange">⚠️ No hay propiedades para exportar</div>';
    return;
  }
  
  const headers = [
    'ID', 'Dirección', 'Ciudad', 'Código Postal', 'Región', 'Referencia Catastral',
    'Fecha Compra', 'Valor Compra', 'Tipo Alquiler', 'Habitaciones Disponibles', 
    'Renta Mensual Total', 'Configuración Anual', 'Bancos de Recepción', 'Detalles Habitaciones', 
    'Inversión Total', 'Rentabilidad Bruta (%)', 'Rentabilidad Neta (%)'
  ];
  
  const csvRows = [headers.join(';')];
  
  properties.forEach(property => {
    // Calculate investment and yields
    const totalInvestment = (property.purchaseValue || 0) + 
                           (property.acquisitionCosts?.itp || 0) + 
                           (property.acquisitionCosts?.broker || 0) + 
                           (property.acquisitionCosts?.improvements || 0) + 
                           (property.acquisitionCosts?.maintenance || 0) + 
                           (property.acquisitionCosts?.furniture || 0);
    
    const annualRent = (property.monthlyRent || 0) * 12;
    const grossYield = totalInvestment > 0 ? (annualRent / totalInvestment * 100) : 0;
    
    // Calculate annual operating costs
    let totalAnnualOperatingCosts = 0;
    const operatingCosts = property.operatingCosts || {};
    Object.values(operatingCosts).forEach(cost => {
      if (cost.enabled && cost.amount > 0) {
        const monthsCount = (cost.months || [1,2,3,4,5,6,7,8,9,10,11,12]).length;
        totalAnnualOperatingCosts += cost.amount * monthsCount;
      }
    });
    
    const monthlyFinancingCosts = (property.financing?.mortgage?.payment || 0) + (property.financing?.loans?.payment || 0);
    const annualFinancingCosts = monthlyFinancingCosts * 12;
    const annualNet = annualRent - totalAnnualOperatingCosts - annualFinancingCosts;
    const netYield = totalInvestment > 0 ? (annualNet / totalInvestment * 100) : 0;
    
    // Format yearly rental configuration
    let yearlyConfig = '';
    let banksList = '';
    if (property.yearlyRentals) {
      const yearlyEntries = Object.entries(property.yearlyRentals).map(([year, data]) => {
        const totalYearlyRent = calculateYearlyRent(data);
        return `${year}: ${fmtEUR(totalYearlyRent)} (${data.bank || 'Sin banco'})`;
      });
      yearlyConfig = yearlyEntries.join(' | ');
      
      const banks = [...new Set(Object.values(property.yearlyRentals).map(data => data.bank).filter(Boolean))];
      banksList = banks.join(', ');
    }
    
    // Format room details
    let roomDetails = '';
    if (property.rentalType === 'rooms' && property.rooms) {
      roomDetails = property.rooms.map(room => 
        `${room.name}: ${fmtEUR(room.rent)} (${room.occupied ? 'Ocupada' : 'Libre'})`
      ).join(' | ');
    }
    
    const row = [
      property.id || '',
      property.address || '',
      property.city || '',
      property.zipCode || '',
      property.region || '',
      property.cadastralRef || '',
      property.purchaseDate || '',
      (property.purchaseValue || 0).toString().replace('.', ','),
      property.rentalType === 'rooms' ? 'Por Habitaciones' : 'Alquiler Completo',
      property.availableRooms || 1,
      (property.monthlyRent || 0).toString().replace('.', ','),
      yearlyConfig || 'Sin configuración anual',
      banksList || 'No especificado',
      roomDetails,
      totalInvestment.toString().replace('.', ','),
      grossYield.toFixed(2).replace('.', ','),
      netYield.toFixed(2).replace('.', ',')
    ];
    
    csvRows.push(row.join(';'));
  });
  
  const csvContent = csvRows.join('\n');
  downloadFile(csvContent, 'propiedades.csv', 'text/csv');
  root.querySelector('#exportResult').innerHTML = '<div style="color:green">✅ Propiedades exportadas a XLS (CSV) con configuración anual</div>';
}

function calculateYearlyRent(yearData) {
  const monthlyRent = yearData.monthlyRent || 0;
  const startMonth = yearData.startMonth || 1;
  const endMonth = yearData.endMonth || 12;
  const adjustments = yearData.adjustments || {};
  
  let totalAnnual = 0;
  
  for (let month = startMonth; month <= endMonth; month++) {
    const monthlyAmount = adjustments[month] ? parseFloat(adjustments[month]) : monthlyRent;
    totalAnnual += monthlyAmount;
  }
  
  return totalAnnual;
}

function exportYearlyRentalsXLS(root) {
  const properties = getProperties();
  
  if (properties.length === 0) {
    root.querySelector('#exportResult').innerHTML = '<div style="color:orange">⚠️ No hay propiedades para exportar</div>';
    return;
  }
  
  const headers = [
    'Propiedad ID', 'Dirección', 'Año', 'Renta Mensual Base', 'Banco de Recepción', 
    'Mes Inicio', 'Mes Fin', 'Meses Activos', 'Renta Total Anual', 'Ajustes Mensuales'
  ];
  
  const csvRows = [headers.join(';')];
  
  properties.forEach(property => {
    if (property.yearlyRentals) {
      Object.entries(property.yearlyRentals).forEach(([year, yearData]) => {
        const totalYearlyRent = calculateYearlyRent(yearData);
        const activeMonths = (yearData.endMonth || 12) - (yearData.startMonth || 1) + 1;
        
        // Format monthly adjustments
        let adjustmentsText = '';
        if (yearData.adjustments && Object.keys(yearData.adjustments).length > 0) {
          const adjustmentEntries = Object.entries(yearData.adjustments).map(([month, amount]) => 
            `Mes ${month}: ${fmtEUR(amount)}`
          );
          adjustmentsText = adjustmentEntries.join(' | ');
        }
        
        const row = [
          property.id || '',
          property.address || '',
          year,
          (yearData.monthlyRent || 0).toString().replace('.', ','),
          yearData.bank || 'No especificado',
          yearData.startMonth || 1,
          yearData.endMonth || 12,
          activeMonths,
          totalYearlyRent.toString().replace('.', ','),
          adjustmentsText || 'Sin ajustes'
        ];
        
        csvRows.push(row.join(';'));
      });
    } else {
      // Add a row for properties without yearly configuration
      const row = [
        property.id || '',
        property.address || '',
        'Sin configuración',
        (property.monthlyRent || 0).toString().replace('.', ','),
        'No especificado',
        1,
        12,
        12,
        ((property.monthlyRent || 0) * 12).toString().replace('.', ','),
        'Configuración base'
      ];
      
      csvRows.push(row.join(';'));
    }
  });
  
  const csvContent = csvRows.join('\n');
  downloadFile(csvContent, 'configuracion-rentas-anuales.csv', 'text/csv');
  root.querySelector('#exportResult').innerHTML = '<div style="color:green">✅ Configuración anual de rentas exportada a XLS (CSV)</div>';
}

function exportOperatingCostsXLS(root) {
  const properties = getProperties();
  
  if (properties.length === 0) {
    root.querySelector('#exportResult').innerHTML = '<div style="color:orange">⚠️ No hay propiedades para exportar</div>';
    return;
  }
  
  const headers = [
    'Propiedad ID', 'Dirección', 'Concepto', 'Aplica', 'Importe Mensual', 
    'Meses Aplicables', 'Total Anual', 'Banco', 'Día de Pago', 'Frecuencia Anual'
  ];
  
  const csvRows = [headers.join(';')];
  
  properties.forEach(property => {
    const operatingCosts = property.operatingCosts || {};
    const costLabels = {
      management: 'Gestión', ibi: 'IBI', community: 'Comunidad', 
      homeInsurance: 'Seguro Hogar', lifeInsurance: 'Seguro Vida', 
      cleaning: 'Limpieza', electricity: 'Luz', water: 'Agua', 
      gas: 'Gas', internet: 'Internet', netflix: 'Netflix', 
      others: 'Otros', maintenance: 'Mantenimiento', furniture: 'Mobiliario'
    };
    
    Object.entries(operatingCosts).forEach(([costId, costData]) => {
      const months = costData.months || [1,2,3,4,5,6,7,8,9,10,11,12];
      const monthsText = months.join(', ');
      const annualCost = costData.amount * months.length;
      
      const row = [
        property.id || '',
        property.address || '',
        costLabels[costId] || costId,
        costData.enabled ? 'Sí' : 'No',
        (costData.amount || 0).toString().replace('.', ','),
        monthsText,
        annualCost.toString().replace('.', ','),
        costData.bank || '',
        costData.day || 1,
        months.length
      ];
      
      csvRows.push(row.join(';'));
    });
  });
  
  const csvContent = csvRows.join('\n');
  downloadFile(csvContent, 'costes-operativos.csv', 'text/csv');
  root.querySelector('#exportResult').innerHTML = '<div style="color:green">✅ Costes operativos exportados a XLS (CSV)</div>';
}

function exportCompleteDataXLS(root) {
  const properties = getProperties();
  const real = getReal();
  const recurrences = getRecurrences();
  const pma = getPMA();
  
  // Create a comprehensive data export with multiple sheets simulation
  const headers = [
    'Tipo de Dato', 'Propiedad ID', 'Dirección', 'Concepto/Descripción', 'Importe', 
    'Fecha', 'Meses Aplicables', 'Banco', 'Categoría', 'Estado', 'Detalles Adicionales'
  ];
  
  const csvRows = [headers.join(';')];
  
  // Export properties data
  properties.forEach(property => {
    const totalInvestment = (property.purchaseValue || 0) + 
                           (property.acquisitionCosts?.itp || 0) + 
                           (property.acquisitionCosts?.broker || 0) + 
                           (property.acquisitionCosts?.improvements || 0) + 
                           (property.acquisitionCosts?.maintenance || 0) + 
                           (property.acquisitionCosts?.furniture || 0);
    
    // Property basic info
    csvRows.push([
      'Propiedad',
      property.id || '',
      property.address || '',
      'Inversión Total',
      totalInvestment.toString().replace('.', ','),
      property.purchaseDate || '',
      '',
      '',
      'Inmuebles',
      property.rentalType || 'full',
      `Habitaciones: ${property.availableRooms || 1} | Renta: ${fmtEUR(property.monthlyRent || 0)}`
    ].join(';'));
    
    // Operating costs
    const operatingCosts = property.operatingCosts || {};
    Object.entries(operatingCosts).forEach(([costId, costData]) => {
      if (costData.enabled) {
        const months = costData.months || [1,2,3,4,5,6,7,8,9,10,11,12];
        csvRows.push([
          'Coste Operativo',
          property.id || '',
          property.address || '',
          costId,
          (costData.amount || 0).toString().replace('.', ','),
          '',
          months.join(', '),
          costData.bank || '',
          'Gastos',
          costData.enabled ? 'Activo' : 'Inactivo',
          `Día pago: ${costData.day || 1} | Anual: ${fmtEUR(costData.amount * months.length)}`
        ].join(';'));
      }
    });
    
    // Room details if applicable
    if (property.rentalType === 'rooms' && property.rooms) {
      property.rooms.forEach(room => {
        csvRows.push([
          'Habitación',
          property.id || '',
          property.address || '',
          room.name || '',
          (room.rent || 0).toString().replace('.', ','),
          '',
          '',
          '',
          'Ingresos',
          room.occupied ? 'Ocupada' : 'Libre',
          `Alquiler mensual por habitación`
        ].join(';'));
      });
    }
  });
  
  // Add some movement data for context
  real.slice(0, 100).forEach(movement => {
    csvRows.push([
      'Movimiento',
      '',
      '',
      movement.concept || '',
      (movement.amount || 0).toString().replace('.', ','),
      movement.date || '',
      '',
      movement.bank || '',
      movement.category || '',
      '',
      'Movimiento financiero'
    ].join(';'));
  });
  
  const csvContent = csvRows.join('\n');
  downloadFile(csvContent, 'datos-completos.csv', 'text/csv');
  root.querySelector('#exportResult').innerHTML = '<div style="color:green">✅ Datos completos exportados a XLS (CSV)</div>';
}

function exportPDF(root) {
  const properties = getProperties();
  
  // Helper function to calculate yearly rent
  function calculateYearlyRentLocal(yearData) {
    const monthlyRent = yearData.monthlyRent || 0;
    const startMonth = yearData.startMonth || 1;
    const endMonth = yearData.endMonth || 12;
    const adjustments = yearData.adjustments || {};
    
    let totalAnnual = 0;
    
    for (let month = startMonth; month <= endMonth; month++) {
      const monthlyAmount = adjustments[month] ? parseFloat(adjustments[month]) : monthlyRent;
      totalAnnual += monthlyAmount;
    }
    
    return totalAnnual;
  }
  
  // Create a printable report
  const reportWindow = window.open('', '_blank');
  reportWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Informe de Propiedades - Finarí</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .property { margin-bottom: 30px; page-break-inside: avoid; }
            .property h2 { color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .kpi { font-size: 1.2em; font-weight: bold; color: #7c3aed; }
            @media print {
                .no-print { display: none; }
                body { margin: 0; }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>📊 Informe de Propiedades</h1>
            <p>Generado el ${new Date().toLocaleDateString('es-ES')}</p>
        </div>
        
        ${properties.map(property => {
          // Calculate metrics
          const totalInvestment = (property.purchaseValue || 0) + 
                                 (property.acquisitionCosts?.itp || 0) + 
                                 (property.acquisitionCosts?.broker || 0) + 
                                 (property.acquisitionCosts?.improvements || 0) + 
                                 (property.acquisitionCosts?.maintenance || 0) + 
                                 (property.acquisitionCosts?.furniture || 0);
          
          let totalAnnualOperatingCosts = 0;
          const operatingCosts = property.operatingCosts || {};
          Object.values(operatingCosts).forEach(cost => {
            if (cost.enabled && cost.amount > 0) {
              const monthsCount = (cost.months || [1,2,3,4,5,6,7,8,9,10,11,12]).length;
              totalAnnualOperatingCosts += cost.amount * monthsCount;
            }
          });
          
          const annualRent = (property.monthlyRent || 0) * 12;
          const monthlyFinancingCosts = (property.financing?.mortgage?.payment || 0) + (property.financing?.loans?.payment || 0);
          const annualFinancingCosts = monthlyFinancingCosts * 12;
          const annualNet = annualRent - totalAnnualOperatingCosts - annualFinancingCosts;
          const grossYield = totalInvestment > 0 ? (annualRent / totalInvestment * 100) : 0;
          const netYield = totalInvestment > 0 ? (annualNet / totalInvestment * 100) : 0;
          
          return `
            <div class="property">
                <h2>🏠 ${property.address || 'Propiedad sin dirección'}</h2>
                <p><strong>Localidad:</strong> ${property.city || ''}, ${property.region || ''} | 
                   <strong>Compra:</strong> ${property.purchaseDate || 'No especificada'}</p>
                
                <div class="summary">
                    <h3>💰 Resumen Financiero</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px;">
                        <div>
                            <div class="kpi">${fmtEUR(property.monthlyRent || 0)}</div>
                            <div>Renta Mensual</div>
                        </div>
                        <div>
                            <div class="kpi">${fmtEUR(totalInvestment)}</div>
                            <div>Inversión Total</div>
                        </div>
                        <div>
                            <div class="kpi">${netYield.toFixed(2)}%</div>
                            <div>Rentabilidad Neta</div>
                        </div>
                    </div>
                    ${property.yearlyRentals ? `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                        <h4>📅 Configuración de Rentas por Año</h4>
                        ${Object.entries(property.yearlyRentals).map(([year, yearData]) => {
                          const totalYearlyRent = calculateYearlyRentLocal(yearData);
                          return `
                            <div style="margin: 5px 0;">
                                <strong>${year}:</strong> ${fmtEUR(totalYearlyRent)} anual 
                                (${fmtEUR(yearData.monthlyRent)} mensual) - 
                                Banco: ${yearData.bank || 'No especificado'}
                            </div>
                          `;
                        }).join('')}
                    </div>
                    ` : ''}
                </div>
                
                ${property.rentalType === 'rooms' && property.rooms ? `
                <h3>🏠 Configuración de Habitaciones</h3>
                <table>
                    <thead>
                        <tr><th>Habitación</th><th>Alquiler Mensual</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                        ${property.rooms.map(room => `
                            <tr>
                                <td>${room.name || 'Sin nombre'}</td>
                                <td>${fmtEUR(room.rent || 0)}</td>
                                <td>${room.occupied ? 'Ocupada' : 'Libre'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : ''}
                
                <h3>💸 Costes Operativos</h3>
                <table>
                    <thead>
                        <tr><th>Concepto</th><th>Importe Mensual</th><th>Meses</th><th>Total Anual</th></tr>
                    </thead>
                    <tbody>
                        ${Object.entries(operatingCosts).filter(([_, cost]) => cost.enabled).map(([costId, cost]) => {
                          const months = cost.months || [1,2,3,4,5,6,7,8,9,10,11,12];
                          const labels = {
                            management: 'Gestión', ibi: 'IBI', community: 'Comunidad', 
                            homeInsurance: 'Seguro Hogar', lifeInsurance: 'Seguro Vida', 
                            cleaning: 'Limpieza', electricity: 'Luz', water: 'Agua', 
                            gas: 'Gas', internet: 'Internet', netflix: 'Netflix', 
                            others: 'Otros', maintenance: 'Mantenimiento', furniture: 'Mobiliario'
                          };
                          return `
                            <tr>
                                <td>${labels[costId] || costId}</td>
                                <td>${fmtEUR(cost.amount || 0)}</td>
                                <td>${months.join(', ')}</td>
                                <td>${fmtEUR((cost.amount || 0) * months.length)}</td>
                            </tr>
                          `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
          `;
        }).join('')}
        
        <div class="no-print" style="margin-top: 30px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px;">🖨️ Imprimir/Guardar como PDF</button>
            <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; margin-left: 10px;">❌ Cerrar</button>
        </div>
    </body>
    </html>
  `);
  
  reportWindow.document.close();
  root.querySelector('#exportResult').innerHTML = '<div style="color:green">✅ Informe PDF generado en nueva ventana</div>';
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

function initCharts(categoryData, monthlyData) {
  // Simple Canvas-based chart implementation
  drawPieChart('categoryChart', categoryData);
  drawLineChart('monthlyChart', monthlyData);
}

function drawPieChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || data.length === 0) return;
  
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = Math.min(centerX, centerY) - 60; // More space for legend
  
  const total = data.reduce((sum, item) => sum + item.total, 0);
  if (total === 0) return;
  
  let currentAngle = -Math.PI / 2; // Start at top
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  data.forEach((item, index) => {
    const sliceAngle = (item.total / total) * 2 * Math.PI;
    
    // Draw slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    currentAngle += sliceAngle;
  });
  
  // Draw legend
  data.forEach((item, index) => {
    const y = 10 + index * 20;
    ctx.fillStyle = item.color;
    ctx.fillRect(10, y, 15, 15);
    ctx.fillStyle = getComputedStyle(document.body).color || '#333';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${item.name} (${((item.total / total) * 100).toFixed(1)}%)`, 30, y + 12);
  });
}

function drawLineChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || data.length === 0) return;
  
  const ctx = canvas.getContext('2d');
  const padding = 50;
  const chartWidth = canvas.width - padding * 2;
  const chartHeight = canvas.height - padding * 2;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const maxValue = Math.max(...data.map(d => Math.max(d.income, d.expenses, Math.abs(d.net))));
  if (maxValue === 0) return;
  
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;
  
  // Draw grid and axes
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  
  // Horizontal grid lines
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight * i / 4);
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(padding + chartWidth, y);
    ctx.stroke();
    
    // Y-axis labels
    const value = maxValue - (maxValue * i / 4);
    ctx.fillStyle = getComputedStyle(document.body).color || '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(value), padding - 5, y + 3);
  }
  
  // Draw lines
  const datasets = [
    { key: 'income', color: '#10b981', label: 'Ingresos' },
    { key: 'expenses', color: '#ef4444', label: 'Gastos' },
    { key: 'net', color: '#7c3aed', label: 'Neto' }
  ];
  
  datasets.forEach(dataset => {
    ctx.strokeStyle = dataset.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    data.forEach((point, index) => {
      const x = padding + index * stepX;
      const value = dataset.key === 'net' ? Math.abs(point.net) : point[dataset.key];
      const y = padding + chartHeight - ((value / maxValue) * chartHeight);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      
      // Draw point
      ctx.save();
      ctx.fillStyle = dataset.color;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    });
    
    ctx.stroke();
  });
  
  // Draw legend
  datasets.forEach((dataset, index) => {
    const x = 10;
    const y = 15 + index * 20;
    ctx.fillStyle = dataset.color;
    ctx.fillRect(x, y, 15, 15);
    ctx.fillStyle = getComputedStyle(document.body).color || '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dataset.label, x + 20, y + 12);
  });
}

export default view;