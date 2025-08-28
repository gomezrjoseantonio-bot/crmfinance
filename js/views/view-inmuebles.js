import { getProperties, saveProperties } from '../storage.js';
import { fmtEUR, parseEuro } from '../utils.js';

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
                <input type="number" id="purchaseValue" placeholder="250000" style="width:100%; margin-bottom:10px">
                
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
                    <td>${p.city || '-'}, ${p.region || '-'}</td>
                    <td>${p.purchaseDate || '-'}</td>
                    <td>${p.purchaseValue ? fmtEUR(p.purchaseValue) : '-'}</td>
                    <td>
                      <button onclick="editProperty('${p.id}')" class="small">Editar</button>
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
  }
};

export default view;