import { getProperties, saveProperties } from '../storage.js';
import { fmtEUR, parseEuro } from '../utils.js';

console.log('Loading inmuebles view module');

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
                  <th>Valor Compra</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${properties.map(p => `
                  <tr>
                    <td>${p.address || '-'}</td>
                    <td>${p.city || '-'}</td>
                    <td>${p.purchaseValue ? fmtEUR(p.purchaseValue) : '-'}</td>
                    <td>
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