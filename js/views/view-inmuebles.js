import { getProperties, saveProperties, getReal } from '../storage.js';
import { fmtEUR } from '../utils.js';

const view = {
  route:'#/inmuebles', title:'Inmuebles',
  async mount(root){
    function renderView() {
      const properties = getProperties();
      
      root.innerHTML = `<div class="row">
        <div class="col"><div class="card">
          <h1>Gestión de Inmuebles</h1>
          <div class="small muted">Administra tu cartera de inmuebles en alquiler y su P&L.</div>
          
          <div class="row" style="margin-top: 20px;">
            <div class="col">
              <h2>Registrar Nuevo Inmueble</h2>
              <div style="margin-bottom:10px;">
                <label class="small muted">Dirección completa</label><br/>
                <input placeholder="Calle, número, piso..." id="address" style="width:100%; max-width:400px;">
              </div>
              <div class="row" style="gap:10px;">
                <div class="col">
                  <label class="small muted">Localidad</label><br/>
                  <input placeholder="Ciudad" id="locality" style="width:100%; max-width:180px;">
                </div>
                <div class="col">
                  <label class="small muted">Código Postal</label><br/>
                  <input placeholder="28001" id="postal-code" style="width:100%; max-width:100px;">
                </div>
              </div>
              <div style="margin:10px 0;">
                <label class="small muted">Comunidad Autónoma</label><br/>
                <input placeholder="Madrid, Cataluña..." id="community" style="width:100%; max-width:200px;">
              </div>
              <div style="margin-bottom:15px;">
                <label class="small muted">Referencia Catastral</label><br/>
                <input placeholder="1234567AB1234S0001TL" id="cadastral-ref" style="width:100%; max-width:300px;">
              </div>
              <button id="add-property" class="primary">Añadir Inmueble</button>
            </div>
          </div>
        </div></div>
      </div>
      
      <div class="row">
        <div class="col"><div class="card">
          <h2 id="properties-title">Mis Inmuebles <span class="badge">${properties.length}</span></h2>
          <div class="grid" style="margin-top:10px;">
            <table id="properties-table">
              <thead>
                <tr>
                  <th>Dirección</th>
                  <th>Localidad</th>
                  <th>CP</th>
                  <th>Referencia Catastral</th>
                  <th>P&L Mensual</th>
                  <th></th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div></div>
      </div>`;
    }

    const tbody = root.querySelector('#properties-table tbody');
    
    function calculatePropertyPL(propertyId) {
      const transactions = getReal();
      const propertyTransactions = transactions.filter(t => 
        t.concept && t.concept.toLowerCase().includes(propertyId.toLowerCase())
      );
      
      const income = propertyTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const expenses = propertyTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);
      const net = income + expenses;
      
      return { income, expenses, net };
    }
    
    function drawProperties(){
      const props = getProperties();
      // Update counter
      const titleElement = root.querySelector('#properties-title');
      if (titleElement) {
        titleElement.innerHTML = `Mis Inmuebles <span class="badge">${props.length}</span>`;
      }
      
      tbody.innerHTML = props.map((prop, i) => {
        const pl = calculatePropertyPL(prop.id);
        return `<tr>
          <td>${prop.address}</td>
          <td>${prop.locality}</td>
          <td>${prop.postal_code}</td>
          <td>${prop.cadastral_reference}</td>
          <td>${fmtEUR(pl.net)}</td>
          <td><button data-i="${i}" class="del">Borrar</button></td>
        </tr>`;
      }).join('');
      
      tbody.querySelectorAll('.del').forEach(b => b.onclick = () => {
        const idx = +b.getAttribute('data-i');
        const arr = getProperties(); 
        arr.splice(idx, 1); 
        saveProperties(arr); 
        drawProperties();
      });
    }
    
    // Initial render and setup
    renderView();
    const tbody = root.querySelector('#properties-table tbody');
    
    drawProperties();
    
    root.querySelector('#add-property').onclick = () => {
      const address = root.querySelector('#address').value.trim();
      const locality = root.querySelector('#locality').value.trim();
      const postalCode = root.querySelector('#postal-code').value.trim();
      const community = root.querySelector('#community').value.trim();
      const cadastralRef = root.querySelector('#cadastral-ref').value.trim();
      
      if(!address || !locality || !postalCode) {
        alert('Por favor, completa al menos la dirección, localidad y código postal.');
        return;
      }
      
      const newProperty = {
        id: `PROP_${Date.now()}`,
        address,
        locality,
        postal_code: postalCode,
        community,
        cadastral_reference: cadastralRef,
        created_date: new Date().toISOString().split('T')[0]
      };
      
      const props = getProperties();
      props.push(newProperty);
      saveProperties(props);
      drawProperties();
      
      // Clear form
      root.querySelector('#address').value = '';
      root.querySelector('#locality').value = '';
      root.querySelector('#postal-code').value = '';
      root.querySelector('#community').value = '';
      root.querySelector('#cadastral-ref').value = '';
      
      alert('Inmueble añadido correctamente');
    };
  }
};

export default view;