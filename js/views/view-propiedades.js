import { getProperties, saveProperties, getOperatingCosts, saveOperatingCosts } from '../storage.js';
import { fmtEUR, parseEuro } from '../utils.js';
import { exportPropertiesToCSV, exportOperatingCostsToCSV, exportAllDataToCSV, exportPropertiesToPDF } from '../export.js';
import { 
  withErrorHandling, 
  validatePropertyData, 
  validateOperatingCostData, 
  confirmAction, 
  showNotification,
  createSearchFilter,
  debounce,
  createBackup
} from '../validation.js';

const view = {
  route: '#/propiedades',
  title: 'Propiedades',
  
  async mount(root) {
    const properties = getProperties();
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>Gestión de Propiedades</h1>
            <div class="small muted">Administra tus propiedades de alquiler con gestión por habitaciones</div>
            <div style="margin-top: 15px;">
              <button id="backup-data" class="secondary">💾 Crear Backup</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Buscar y Filtrar</h2>
            <div class="search-filter">
              <input type="text" id="search-properties" class="search-input" placeholder="Buscar propiedades por dirección...">
              <div class="filter-chips" id="filter-chips"></div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Añadir Nueva Propiedad</h2>
            <div class="form-group">
              <label>Dirección: <span style="color: red;">*</span></label>
              <input type="text" id="property-address" placeholder="Calle, número, ciudad" style="width: 100%; margin-bottom: 10px;">
              <div id="address-error" class="error" style="display: none;"></div>
              
              <label>Tipo de alquiler:</label>
              <select id="rental-type" style="width: 100%; margin-bottom: 10px;">
                <option value="complete">Piso completo</option>
                <option value="rooms">Por habitaciones</option>
              </select>
              
              <div id="complete-rental" style="margin-bottom: 10px;">
                <label>Renta mensual (piso completo): <span style="color: red;">*</span></label>
                <input type="number" id="complete-rent" placeholder="800" style="width: 150px;" min="0" max="10000">
                <span class="small muted">€/mes</span>
                <div id="rent-error" class="error" style="display: none;"></div>
              </div>
              
              <div id="rooms-rental" style="display: none; margin-bottom: 10px;">
                <label>Número de habitaciones:</label>
                <input type="number" id="rooms-count" placeholder="3" min="1" max="10" style="width: 80px;">
                <button id="setup-rooms" class="secondary">Configurar habitaciones</button>
                <div id="rooms-error" class="error" style="display: none;"></div>
              </div>
              
              <div id="rooms-config" style="display: none; margin-top: 10px;">
                <h3>Configuración de Habitaciones</h3>
                <div id="rooms-list"></div>
              </div>
              
              <div style="margin-top: 15px;">
                <button id="add-property" class="primary loading-target">Añadir Propiedad</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Propiedades Existentes</h2>
            <div style="margin-bottom: 15px;">
              <button id="export-properties-csv" class="secondary">📊 Exportar Propiedades (XLS)</button>
              <button id="export-costs-csv" class="secondary" style="margin-left: 10px;">📋 Exportar Costes (XLS)</button>
              <button id="export-all-csv" class="secondary" style="margin-left: 10px;">📁 Exportar Todo (XLS)</button>
              <button id="export-pdf" class="secondary" style="margin-left: 10px;">📄 Exportar PDF</button>
            </div>
            <div id="properties-list">
              ${this.renderPropertiesList(properties)}
            </div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Costes de Explotación</h2>
            <div class="small muted">Configura los gastos operativos y en qué meses se aplican</div>
            <div id="operating-costs">
              ${this.renderOperatingCosts()}
            </div>
            <div style="margin-top: 15px;">
              <button id="add-cost" class="primary">Añadir Coste Operativo</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.setupEventListeners(root);
    this.setupSearch(root);
  },
  
  renderPropertiesList(properties) {
    if (properties.length === 0) {
      return '<div class="small muted">No hay propiedades registradas</div>';
    }
    
    return properties.map(property => `
      <div class="property-item" style="border: 1px solid #e0e0e0; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
        <div style="display: flex; justify-content: between; align-items: center;">
          <div>
            <h3 style="margin: 0 0 5px 0;">${property.address}</h3>
            <div class="small">
              <span class="badge">${property.type === 'complete' ? 'Piso completo' : 'Por habitaciones'}</span>
              ${property.type === 'complete' ? 
                `<span style="margin-left: 10px;">${fmtEUR(property.rent)}/mes</span>` :
                `<span style="margin-left: 10px;">${property.rooms.length} habitaciones</span>`
              }
            </div>
            ${property.type === 'rooms' ? `
              <div style="margin-top: 8px;">
                ${property.rooms.map(room => `
                  <div class="small" style="margin-left: 15px;">
                    🏠 ${room.name}: ${fmtEUR(room.rent)}/mes 
                    <span class="badge ${room.occupied ? 'occupied' : 'available'}">${room.occupied ? 'Ocupada' : 'Disponible'}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
          <div>
            <button class="secondary small" onclick="window.editProperty('${property.id}')">Editar</button>
            <button class="danger small" onclick="window.deleteProperty('${property.id}')">Eliminar</button>
          </div>
        </div>
      </div>
    `).join('');
  },
  
  renderOperatingCosts() {
    const costs = getOperatingCosts();
    return `
      <div id="costs-list">
        ${costs.map(cost => `
          <div class="cost-item" style="border: 1px solid #e0e0e0; padding: 10px; margin-bottom: 8px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${cost.name}</strong>
                <span style="margin-left: 10px;">${fmtEUR(cost.amount)}</span>
                <div class="small muted">Meses: ${cost.months.join(', ')}</div>
              </div>
              <button class="danger small" onclick="window.deleteCost('${cost.id}')">Eliminar</button>
            </div>
          </div>
        `).join('')}
      </div>
      
      <div id="add-cost-form" style="display: none; margin-top: 15px; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h3>Nuevo Coste Operativo</h3>
        <div style="margin-bottom: 10px;">
          <label>Nombre del coste:</label>
          <input type="text" id="cost-name" placeholder="Agua, Gas, Mantenimiento..." style="width: 200px;">
        </div>
        <div style="margin-bottom: 10px;">
          <label>Importe:</label>
          <input type="number" id="cost-amount" placeholder="150" style="width: 100px;">
          <span class="small muted">€</span>
        </div>
        <div style="margin-bottom: 15px;">
          <label>Meses en los que se aplica:</label>
          <div id="months-selection" style="margin-top: 5px;">
            ${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
               .map((month, index) => `
                 <label style="display: inline-block; margin-right: 15px; margin-bottom: 5px;">
                   <input type="checkbox" value="${index + 1}" class="month-checkbox"> ${month}
                 </label>
               `).join('')}
          </div>
        </div>
        <button id="save-cost" class="primary">Guardar Coste</button>
        <button id="cancel-cost" class="secondary">Cancelar</button>
      </div>
    `;
  },
  
  setupEventListeners(root) {
    // Rental type change
    root.querySelector('#rental-type').addEventListener('change', (e) => {
      const completeDiv = root.querySelector('#complete-rental');
      const roomsDiv = root.querySelector('#rooms-rental');
      const roomsConfig = root.querySelector('#rooms-config');
      
      if (e.target.value === 'complete') {
        completeDiv.style.display = 'block';
        roomsDiv.style.display = 'none';
        roomsConfig.style.display = 'none';
      } else {
        completeDiv.style.display = 'none';
        roomsDiv.style.display = 'block';
      }
    });
    
    // Setup rooms configuration
    root.querySelector('#setup-rooms').addEventListener('click', () => {
      const roomsCount = parseInt(root.querySelector('#rooms-count').value);
      if (!roomsCount || roomsCount < 1) {
        alert('Por favor, especifica un número válido de habitaciones');
        return;
      }
      
      const roomsConfig = root.querySelector('#rooms-config');
      const roomsList = root.querySelector('#rooms-list');
      
      let html = '';
      for (let i = 1; i <= roomsCount; i++) {
        html += `
          <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #f0f0f0; border-radius: 6px;">
            <label>Habitación ${i}:</label>
            <input type="text" class="room-name" placeholder="Habitación ${i}" value="Habitación ${i}" style="width: 150px; margin-right: 10px;">
            <label>Renta:</label>
            <input type="number" class="room-rent" placeholder="300" style="width: 80px; margin-right: 5px;">
            <span class="small muted">€/mes</span>
            <label style="margin-left: 15px;">
              <input type="checkbox" class="room-occupied"> Ocupada
            </label>
          </div>
        `;
      }
      
      roomsList.innerHTML = html;
      roomsConfig.style.display = 'block';
    });
    
    // Add property with enhanced validation
    const addPropertyHandler = withErrorHandling(async () => {
      const address = root.querySelector('#property-address').value.trim();
      const type = root.querySelector('#rental-type').value;
      
      // Clear previous errors
      root.querySelectorAll('.error').forEach(el => el.style.display = 'none');
      
      const property = {
        id: Date.now().toString(),
        address,
        type,
        createdAt: new Date().toISOString()
      };
      
      if (type === 'complete') {
        const rent = parseFloat(root.querySelector('#complete-rent').value);
        property.rent = rent;
      } else {
        const roomNames = Array.from(root.querySelectorAll('.room-name')).map(input => input.value.trim());
        const roomRents = Array.from(root.querySelectorAll('.room-rent')).map(input => parseFloat(input.value));
        const roomOccupied = Array.from(root.querySelectorAll('.room-occupied')).map(input => input.checked);
        
        property.rooms = roomNames.map((name, index) => ({
          id: `${property.id}-room-${index + 1}`,
          name,
          rent: roomRents[index],
          occupied: roomOccupied[index]
        }));
      }
      
      // Validate the property data
      validatePropertyData(property);
      
      const properties = getProperties();
      properties.push(property);
      saveProperties(properties);
      
      showNotification('Propiedad añadida correctamente', 'success');
      
      // Clear form
      root.querySelector('#property-address').value = '';
      root.querySelector('#complete-rent').value = '';
      root.querySelector('#rooms-config').style.display = 'none';
      
      this.mount(root); // Reload the view
      
    }, 'Error al añadir la propiedad');
    
    root.querySelector('#add-property').addEventListener('click', addPropertyHandler);
    
    // Operating costs
    root.querySelector('#add-cost').addEventListener('click', () => {
      const form = root.querySelector('#add-cost-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });
    
    const cancelCostBtn = root.querySelector('#cancel-cost');
    if (cancelCostBtn) {
      cancelCostBtn.addEventListener('click', () => {
        root.querySelector('#add-cost-form').style.display = 'none';
      });
    }
    
    const saveCostBtn = root.querySelector('#save-cost');
    if (saveCostBtn) {
      const saveCostHandler = withErrorHandling(async () => {
        const name = root.querySelector('#cost-name').value.trim();
        const amount = parseFloat(root.querySelector('#cost-amount').value);
        const selectedMonths = Array.from(root.querySelectorAll('.month-checkbox:checked')).map(cb => parseInt(cb.value));
        
        const cost = {
          id: Date.now().toString(),
          name,
          amount,
          months: selectedMonths,
          createdAt: new Date().toISOString()
        };
        
        // Validate the cost data
        validateOperatingCostData(cost);
        
        const costs = getOperatingCosts();
        costs.push(cost);
        saveOperatingCosts(costs);
        
        showNotification('Coste operativo añadido correctamente', 'success');
        this.mount(root); // Reload the view
        
      }, 'Error al añadir el coste operativo');
      
      saveCostBtn.addEventListener('click', saveCostHandler);
    }
    
    // Global functions for property management
    window.editProperty = (id) => {
      // TODO: Implement property editing
      alert('Funcionalidad de edición próximamente');
    };
    
    window.deleteProperty = (id) => {
      if (confirmAction('Se eliminará esta propiedad permanentemente', true)) {
        try {
          const properties = getProperties();
          const filtered = properties.filter(p => p.id !== id);
          saveProperties(filtered);
          showNotification('Propiedad eliminada correctamente', 'success');
          this.mount(root); // Reload the view
        } catch (error) {
          console.error('Error deleting property:', error);
          showNotification('Error al eliminar la propiedad', 'error');
        }
      }
    };
    
    window.deleteCost = (id) => {
      if (confirmAction('Se eliminará este coste operativo permanentemente', true)) {
        try {
          const costs = getOperatingCosts();
          const filtered = costs.filter(c => c.id !== id);
          saveOperatingCosts(filtered);
          showNotification('Coste operativo eliminado correctamente', 'success');
          this.mount(root); // Reload the view
        } catch (error) {
          console.error('Error deleting operating cost:', error);
          showNotification('Error al eliminar el coste operativo', 'error');
        }
      }
    };
    
    // Backup functionality
    const backupBtn = root.querySelector('#backup-data');
    if (backupBtn) {
      backupBtn.addEventListener('click', createBackup);
    }
    
    // Export functionality with enhanced error handling
    const exportPropertiesBtn = root.querySelector('#export-properties-csv');
    if (exportPropertiesBtn) {
      exportPropertiesBtn.addEventListener('click', withErrorHandling(async () => {
        exportPropertiesToCSV();
        showNotification('Propiedades exportadas correctamente', 'success');
      }, 'Error al exportar las propiedades'));
    }
    
    const exportCostsBtn = root.querySelector('#export-costs-csv');
    if (exportCostsBtn) {
      exportCostsBtn.addEventListener('click', withErrorHandling(async () => {
        exportOperatingCostsToCSV();
        showNotification('Costes operativos exportados correctamente', 'success');
      }, 'Error al exportar los costes operativos'));
    }
    
    const exportAllBtn = root.querySelector('#export-all-csv');
    if (exportAllBtn) {
      exportAllBtn.addEventListener('click', withErrorHandling(async () => {
        exportAllDataToCSV();
        showNotification('Todos los datos exportados correctamente', 'success');
      }, 'Error al exportar todos los datos'));
    }
    
    const exportPdfBtn = root.querySelector('#export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', withErrorHandling(async () => {
        exportPropertiesToPDF();
        showNotification('PDF generado correctamente', 'success');
      }, 'Error al generar el PDF'));
    }
  },
  
  setupSearch(root) {
    const searchInput = root.querySelector('#search-properties');
    const propertiesList = root.querySelector('#properties-list');
    
    if (!searchInput || !propertiesList) return;
    
    const debouncedSearch = debounce((searchTerm) => {
      const allProperties = getProperties();
      const filteredProperties = createSearchFilter(allProperties, searchTerm, ['address', 'type']);
      propertiesList.innerHTML = this.renderPropertiesList(filteredProperties);
    }, 300);
    
    searchInput.addEventListener('input', (e) => {
      debouncedSearch(e.target.value);
    });
  }
};

export default view;