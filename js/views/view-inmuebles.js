import { getProperties, saveProperties } from '../storage.js';
import { fmtEUR, parseEuro } from '../utils.js';

function showPropertyDetails(property, root) {
  const detailsContainer = root.querySelector('#propertyDetails');
  detailsContainer.style.display = 'block';
  
  detailsContainer.innerHTML = `
    <div class="row">
      <div class="col"><div class="card">
        <h2>📊 P&L: ${property.address}</h2>
        <div class="muted small">${property.city}${property.region ? ', ' + property.region : ''} | Compra: ${property.purchaseDate || 'No definida'}</div>
        <button onclick="hidePropertyDetails()" class="small" style="margin-top:10px;">← Volver al listado</button>
      </div></div>
    </div>
    
    <div class="row">
      <div class="col"><div class="card">
        <h2>💰 Costes de Adquisición</h2>
        <div class="row">
          <div class="col">
            <label class="small muted">Valor de Compra (€)</label><br/>
            <input type="number" id="acquisition-purchase" value="${property.purchaseValue || 0}" style="width:100%; margin-bottom:10px">
            
            <label class="small muted">ITP Pagado (€)</label><br/>
            <input type="number" id="acquisition-itp" value="${property.acquisitionCosts?.itp || 0}" placeholder="Impuesto de Transmisiones" style="width:100%; margin-bottom:10px">
            
            <label class="small muted">Costes de Bróker (€)</label><br/>
            <input type="number" id="acquisition-broker" value="${property.acquisitionCosts?.broker || 0}" style="width:100%; margin-bottom:10px">
          </div>
          <div class="col">
            <h3 style="margin-top:0">Costes de Reforma</h3>
            
            <label class="small muted">Mejoras (desgrava 3% anual) (€)</label><br/>
            <input type="number" id="acquisition-improvements" value="${property.acquisitionCosts?.improvements || 0}" style="width:100%; margin-bottom:10px">
            
            <label class="small muted">Mantenimiento (se imputa en renta) (€)</label><br/>
            <input type="number" id="acquisition-maintenance" value="${property.acquisitionCosts?.maintenance || 0}" style="width:100%; margin-bottom:10px">
            
            <label class="small muted">Mobiliario (desgrava 10% anual) (€)</label><br/>
            <input type="number" id="acquisition-furniture" value="${property.acquisitionCosts?.furniture || 0}" style="width:100%; margin-bottom:10px">
          </div>
        </div>
        <button onclick="saveAcquisitionCosts('${property.id}')" class="primary">Guardar Costes de Adquisición</button>
      </div></div>
      
      <div class="col"><div class="card">
        <h2>🏠 Explotación del Activo</h2>
        
        <label class="small muted">Tipo de Alquiler</label><br/>
        <select id="rental-type" style="width:100%; margin-bottom:10px">
          <option value="full" ${(property.rentalType || 'full') === 'full' ? 'selected' : ''}>Alquiler Completo</option>
          <option value="rooms" ${property.rentalType === 'rooms' ? 'selected' : ''}>Alquiler por Habitaciones</option>
        </select>
        
        <div id="rooms-config" style="display:${property.rentalType === 'rooms' ? 'block' : 'none'}">
          <label class="small muted">Número de Habitaciones Disponibles</label><br/>
          <input type="number" id="available-rooms" value="${property.availableRooms || 1}" min="1" style="width:100%; margin-bottom:10px">
        </div>
        
        <label class="small muted">Renta Mensual Total (€)</label><br/>
        <input type="number" id="monthly-rent" value="${property.monthlyRent || 0}" style="width:100%; margin-bottom:10px">
        
        <button onclick="saveRentalConfig('${property.id}')" class="primary">Guardar Configuración</button>
      </div></div>
    </div>
    
    <div class="row">
      <div class="col"><div class="card">
        <h2>💸 Costes de Explotación</h2>
        <div class="muted small">Configura los gastos mensuales asociados al inmueble</div>
        <div style="margin-top:15px;">
          ${renderOperatingCosts(property)}
        </div>
      </div></div>
    </div>
  `;
  
  // Add event listener for rental type change
  const rentalTypeSelect = detailsContainer.querySelector('#rental-type');
  const roomsConfig = detailsContainer.querySelector('#rooms-config');
  
  rentalTypeSelect.onchange = () => {
    roomsConfig.style.display = rentalTypeSelect.value === 'rooms' ? 'block' : 'none';
  };
}

function renderOperatingCosts(property) {
  const costs = property.operatingCosts || {};
  const costTypes = [
    { id: 'management', label: 'Gestión', defaultValue: 0 },
    { id: 'ibi', label: 'IBI', defaultValue: 0 },
    { id: 'community', label: 'Comunidad', defaultValue: 0 },
    { id: 'homeInsurance', label: 'Seguro Hogar', defaultValue: 0 },
    { id: 'lifeInsurance', label: 'Seguro Vida', defaultValue: 0 },
    { id: 'cleaning', label: 'Limpieza', defaultValue: 0 },
    { id: 'electricity', label: 'Luz', defaultValue: 0 },
    { id: 'water', label: 'Agua', defaultValue: 0 },
    { id: 'gas', label: 'Gas', defaultValue: 0 },
    { id: 'internet', label: 'Internet', defaultValue: 0 },
    { id: 'netflix', label: 'Netflix', defaultValue: 0 },
    { id: 'others', label: 'Otros', defaultValue: 0 },
    { id: 'maintenance', label: 'Mantenimiento', defaultValue: 0 },
    { id: 'furniture', label: 'Mobiliario', defaultValue: 0 }
  ];
  
  return `
    <div class="grid" style="margin-bottom:15px;">
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Aplica</th>
            <th>Importe (€)</th>
            <th>Banco</th>
            <th>Día de Pago</th>
          </tr>
        </thead>
        <tbody>
          ${costTypes.map(cost => `
            <tr>
              <td>${cost.label}</td>
              <td><input type="checkbox" id="cost-${cost.id}-enabled" ${costs[cost.id]?.enabled ? 'checked' : ''}></td>
              <td><input type="number" id="cost-${cost.id}-amount" value="${costs[cost.id]?.amount || cost.defaultValue}" style="width:80px"></td>
              <td>
                <select id="cost-${cost.id}-bank" style="width:100px">
                  <option value="">Seleccionar</option>
                  <option value="SANTANDER" ${costs[cost.id]?.bank === 'SANTANDER' ? 'selected' : ''}>Santander</option>
                  <option value="BBVA" ${costs[cost.id]?.bank === 'BBVA' ? 'selected' : ''}>BBVA</option>
                </select>
              </td>
              <td><input type="number" id="cost-${cost.id}-day" value="${costs[cost.id]?.day || 1}" min="1" max="31" style="width:60px"></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <button onclick="saveOperatingCosts('${property.id}')" class="primary">Guardar Costes de Explotación</button>
  `;
}

const view = {
  route:'#/inmuebles', title:'Inmuebles',
  async mount(root){
    const properties = getProperties();
    
    root.innerHTML = `
      <div class="row">
        <div class="col"><div class="card">
          <h1>Gestión de Inmuebles</h1>
          <div class="muted">Administra tus propiedades de alquiler y su P&L</div>
        </div></div>
      </div>
      
      <div class="row">
        <div class="col"><div class="card">
          <h2>Añadir Nuevo Inmueble</h2>
          <form id="propertyForm">
            <div class="row">
              <div class="col">
                <label class="small muted">Dirección completa</label><br/>
                <input type="text" id="address" placeholder="Calle, número, piso..." style="width:100%; margin-bottom:10px">
                
                <label class="small muted">Localidad</label><br/>
                <input type="text" id="city" placeholder="Ciudad" style="width:100%; margin-bottom:10px">
                
                <div style="display:flex; gap:10px; margin-bottom:10px">
                  <div style="flex:1">
                    <label class="small muted">Código Postal</label><br/>
                    <input type="text" id="zipCode" placeholder="28001" style="width:100%">
                  </div>
                  <div style="flex:1">
                    <label class="small muted">Comunidad</label><br/>
                    <input type="text" id="region" placeholder="Madrid" style="width:100%">
                  </div>
                </div>
              </div>
              
              <div class="col">
                <label class="small muted">Referencia Catastral</label><br/>
                <input type="text" id="cadastralRef" placeholder="1234567AB1234C" style="width:100%; margin-bottom:10px">
                
                <label class="small muted">Fecha de Compra</label><br/>
                <input type="date" id="purchaseDate" style="width:100%; margin-bottom:10px">
                
                <label class="small muted">Valor de Compra (€)</label><br/>
                <input type="number" id="purchaseValue" placeholder="250000" style="width:100%; margin-bottom:20px">
                
                <button type="submit" class="primary">Añadir Inmueble</button>
              </div>
            </div>
          </form>
        </div></div>
      </div>
      
      <div class="row">
        <div class="col"><div class="card">
          <h2>Mis Inmuebles <span class="badge">${properties.length}</span></h2>
          <div class="grid" id="propertiesTable">
            <table>
              <thead>
                <tr>
                  <th>Dirección</th>
                  <th>Localidad</th>
                  <th>Fecha Compra</th>
                  <th>Valor Compra</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${properties.map(p => `
                  <tr>
                    <td>${p.address || '-'}</td>
                    <td>${p.city || '-'}${p.region ? ', ' + p.region : ''}</td>
                    <td>${p.purchaseDate || '-'}</td>
                    <td>${p.purchaseValue ? fmtEUR(p.purchaseValue) : '-'}</td>
                    <td>
                      <button onclick="viewPropertyDetails('${p.id}')" class="small">Ver P&L</button>
                      <button onclick="deleteProperty('${p.id}')" class="small">Eliminar</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${properties.length === 0 ? '<div class="muted small" style="margin-top:10px">No hay inmuebles registrados. Añade el primero usando el formulario.</div>' : ''}
        </div></div>
      </div>
      
      <div id="propertyDetails" style="display:none;">
        <!-- Property details section will be injected here -->
      </div>
    `;

    // Form submission handler
    const form = root.querySelector('#propertyForm');
    form.onsubmit = (e) => {
      e.preventDefault();
      
      const newProperty = {
        id: Date.now().toString(),
        address: root.querySelector('#address').value.trim(),
        city: root.querySelector('#city').value.trim(),
        zipCode: root.querySelector('#zipCode').value.trim(),
        region: root.querySelector('#region').value.trim(),
        cadastralRef: root.querySelector('#cadastralRef').value.trim(),
        purchaseDate: root.querySelector('#purchaseDate').value,
        purchaseValue: parseFloat(root.querySelector('#purchaseValue').value) || 0,
        createdAt: new Date().toISOString()
      };

      if (!newProperty.address || !newProperty.city) {
        alert('La dirección y localidad son obligatorios');
        return;
      }

      const currentProperties = getProperties();
      currentProperties.push(newProperty);
      saveProperties(currentProperties);
      
      alert('Inmueble añadido correctamente');
      view.mount(root); // Refresh the view
    };

    // Make functions available globally for button onclick handlers
    window.viewPropertyDetails = (id) => {
      const property = getProperties().find(p => p.id === id);
      if (!property) return;
      
      showPropertyDetails(property, root);
    };

    window.editProperty = (id) => {
      alert(`Función de edición para inmueble ${id} - Próximamente disponible`);
    };

    window.deleteProperty = (id) => {
      if (confirm('¿Estás seguro de que quieres eliminar este inmueble?')) {
        const currentProperties = getProperties();
        const filtered = currentProperties.filter(p => p.id !== id);
        saveProperties(filtered);
        view.mount(root); // Refresh the view
      }
    };
    
    window.hidePropertyDetails = () => {
      const detailsContainer = root.querySelector('#propertyDetails');
      detailsContainer.style.display = 'none';
    };
    
    window.saveAcquisitionCosts = (propertyId) => {
      const properties = getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      
      property.acquisitionCosts = {
        itp: parseFloat(root.querySelector('#acquisition-itp').value) || 0,
        broker: parseFloat(root.querySelector('#acquisition-broker').value) || 0,
        improvements: parseFloat(root.querySelector('#acquisition-improvements').value) || 0,
        maintenance: parseFloat(root.querySelector('#acquisition-maintenance').value) || 0,
        furniture: parseFloat(root.querySelector('#acquisition-furniture').value) || 0
      };
      
      // Update purchase value if changed
      property.purchaseValue = parseFloat(root.querySelector('#acquisition-purchase').value) || 0;
      
      saveProperties(properties);
      alert('Costes de adquisición guardados correctamente');
    };
    
    window.saveRentalConfig = (propertyId) => {
      const properties = getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      
      property.rentalType = root.querySelector('#rental-type').value;
      property.availableRooms = parseInt(root.querySelector('#available-rooms').value) || 1;
      property.monthlyRent = parseFloat(root.querySelector('#monthly-rent').value) || 0;
      
      saveProperties(properties);
      alert('Configuración de alquiler guardada correctamente');
    };
    
    window.saveOperatingCosts = (propertyId) => {
      const properties = getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      
      const costTypes = ['management', 'ibi', 'community', 'homeInsurance', 'lifeInsurance', 
                        'cleaning', 'electricity', 'water', 'gas', 'internet', 'netflix', 
                        'others', 'maintenance', 'furniture'];
      
      property.operatingCosts = {};
      
      costTypes.forEach(costId => {
        const enabled = root.querySelector(`#cost-${costId}-enabled`).checked;
        const amount = parseFloat(root.querySelector(`#cost-${costId}-amount`).value) || 0;
        const bank = root.querySelector(`#cost-${costId}-bank`).value;
        const day = parseInt(root.querySelector(`#cost-${costId}-day`).value) || 1;
        
        property.operatingCosts[costId] = {
          enabled,
          amount,
          bank,
          day
        };
      });
      
      saveProperties(properties);
      alert('Costes de explotación guardados correctamente');
    };
  }
};

export default view;