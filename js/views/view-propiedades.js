import { getProperties, saveProperties, getBudget, getReal } from '../storage.js';
import { fmtEUR, parseEuro, groupBy } from '../utils.js';

const view = {
  route: '#/propiedades',
  title: 'Propiedades',
  
  async mount(root) {
    const properties = getProperties();
    const budget = getBudget();
    const real = getReal();
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <h1>Gestión de Propiedades</h1>
          <div class="muted">Controla la rentabilidad de cada piso</div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Añadir nueva propiedad</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
              <div>
                <label class="small muted">Nombre</label>
                <input type="text" id="propName" placeholder="Piso A" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Dirección</label>
                <input type="text" id="propAddress" placeholder="Calle Principal 123" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Tipo de alquiler</label>
                <select id="propType" style="width: 100%">
                  <option value="global">Piso completo</option>
                  <option value="rooms">Por habitaciones</option>
                </select>
              </div>
              <div>
                <label class="small muted">Precio base (€/mes)</label>
                <input type="number" id="propPrice" step="0.01" placeholder="1200.00" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Número de habitaciones</label>
                <input type="number" id="propRooms" min="1" value="1" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Gastos fijos (€/mes)</label>
                <input type="number" id="propExpenses" step="0.01" placeholder="200.00" style="width: 100%">
              </div>
            </div>
            <button id="addProperty" class="primary">Añadir propiedad</button>
          </div>
        </div>
      </div>
      
      <div class="row" id="propertiesList">
      </div>
    `;
    
    // Add property
    root.querySelector('#addProperty').onclick = () => {
      const name = root.querySelector('#propName').value.trim();
      const address = root.querySelector('#propAddress').value.trim();
      const type = root.querySelector('#propType').value;
      const price = parseFloat(root.querySelector('#propPrice').value) || 0;
      const rooms = parseInt(root.querySelector('#propRooms').value) || 1;
      const expenses = parseFloat(root.querySelector('#propExpenses').value) || 0;
      
      if (!name) {
        alert('Por favor, introduce un nombre para la propiedad');
        return;
      }
      
      const property = {
        id: Date.now(),
        name,
        address,
        type,
        basePrice: price,
        rooms,
        fixedExpenses: expenses,
        roomsRented: type === 'rooms' ? [] : null, // Array of {roomNumber, tenant, price, startDate}
        created: new Date().toISOString()
      };
      
      const currentProperties = getProperties();
      currentProperties.push(property);
      saveProperties(currentProperties);
      
      // Reset form
      root.querySelector('#propName').value = '';
      root.querySelector('#propAddress').value = '';
      root.querySelector('#propPrice').value = '';
      root.querySelector('#propExpenses').value = '';
      
      // Refresh view
      view.mount(root);
    };
    
    // Render properties
    renderProperties(root, properties, budget, real);
  }
};

function renderProperties(root, properties, budget, real) {
  const propertiesEl = root.querySelector('#propertiesList');
  
  if (properties.length === 0) {
    propertiesEl.innerHTML = `
      <div class="col">
        <div class="card">
          <div class="text-center muted">No hay propiedades registradas</div>
        </div>
      </div>
    `;
    return;
  }
  
  const propertyCards = properties.map(property => {
    // Calculate property profitability
    const profitability = calculateProfitability(property, budget, real);
    
    return `
      <div class="col-lg-6" style="margin-bottom: 20px;">
        <div class="card">
          <div style="display: flex; justify-content: between; align-items: start;">
            <div style="flex: 1;">
              <h3>${property.name}</h3>
              <div class="small muted">${property.address}</div>
              <div class="small">
                ${property.type === 'global' ? 'Piso completo' : `Por habitaciones (${property.rooms} hab.)`}
              </div>
            </div>
            <button class="small delete-property" data-id="${property.id}" style="color: red;">×</button>
          </div>
          
          <div style="margin-top: 15px;">
            <h4>Rentabilidad</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
              <div>
                <div class="small muted">Ingresos previstos/mes</div>
                <div style="color: green;"><b>${fmtEUR(profitability.budgetIncome)}</b></div>
              </div>
              <div>
                <div class="small muted">Gastos previstos/mes</div>
                <div style="color: red;"><b>${fmtEUR(profitability.budgetExpenses)}</b></div>
              </div>
              <div>
                <div class="small muted">Neto previsto/mes</div>
                <div style="color: ${profitability.budgetNet >= 0 ? 'green' : 'red'};"><b>${fmtEUR(profitability.budgetNet)}</b></div>
              </div>
              <div>
                <div class="small muted">Rentabilidad anual</div>
                <div style="color: ${profitability.annualReturn >= 0 ? 'green' : 'red'};"><b>${fmtEUR(profitability.annualReturn)}</b></div>
              </div>
            </div>
            
            <div style="margin-top: 10px;">
              <div class="small muted">Ingresos reales vs presupuesto</div>
              <div style="display: flex; justify-content: space-between;">
                <span>Real: <b style="color: green;">${fmtEUR(profitability.realIncome)}</b></span>
                <span>Diferencia: <b style="color: ${profitability.incomeDiff >= 0 ? 'green' : 'red'};">${fmtEUR(profitability.incomeDiff)}</b></span>
              </div>
            </div>
          </div>
          
          ${property.type === 'rooms' ? renderRoomManagement(property) : ''}
          
          <div style="margin-top: 15px;">
            <h4>Configuración</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div>
                <label class="small muted">Precio base (€/mes)</label>
                <input type="number" class="prop-price" data-id="${property.id}" value="${property.basePrice}" step="0.01" style="width: 100%">
              </div>
              <div>
                <label class="small muted">Gastos fijos (€/mes)</label>
                <input type="number" class="prop-expenses" data-id="${property.id}" value="${property.fixedExpenses}" step="0.01" style="width: 100%">
              </div>
            </div>
            <button class="update-property primary small" data-id="${property.id}" style="margin-top: 10px;">Actualizar</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  propertiesEl.innerHTML = propertyCards;
  
  // Add delete functionality
  propertiesEl.querySelectorAll('.delete-property').forEach(btn => {
    btn.onclick = () => {
      if (confirm('¿Estás seguro de que quieres eliminar esta propiedad?')) {
        const id = parseInt(btn.getAttribute('data-id'));
        const currentProperties = getProperties();
        const filteredProperties = currentProperties.filter(p => p.id !== id);
        saveProperties(filteredProperties);
        view.mount(root);
      }
    };
  });
  
  // Add update functionality
  propertiesEl.querySelectorAll('.update-property').forEach(btn => {
    btn.onclick = () => {
      const id = parseInt(btn.getAttribute('data-id'));
      const priceEl = propertiesEl.querySelector(`input.prop-price[data-id="${id}"]`);
      const expensesEl = propertiesEl.querySelector(`input.prop-expenses[data-id="${id}"]`);
      
      const newPrice = parseFloat(priceEl.value) || 0;
      const newExpenses = parseFloat(expensesEl.value) || 0;
      
      const currentProperties = getProperties();
      const propertyIndex = currentProperties.findIndex(p => p.id === id);
      
      if (propertyIndex !== -1) {
        currentProperties[propertyIndex].basePrice = newPrice;
        currentProperties[propertyIndex].fixedExpenses = newExpenses;
        saveProperties(currentProperties);
        
        alert('Propiedad actualizada correctamente');
        view.mount(root);
      }
    };
  });
}

function renderRoomManagement(property) {
  const rooms = property.roomsRented || [];
  const roomsHtml = Array.from({length: property.rooms}, (_, i) => {
    const roomNumber = i + 1;
    const roomData = rooms.find(r => r.roomNumber === roomNumber);
    
    return `
      <div style="border: 1px solid #ddd; padding: 10px; margin: 5px 0; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>Habitación ${roomNumber}</strong>
          <span class="badge">${roomData ? 'Ocupada' : 'Libre'}</span>
        </div>
        ${roomData ? `
          <div class="small">
            <div>Inquilino: ${roomData.tenant}</div>
            <div>Precio: ${fmtEUR(roomData.price)}/mes</div>
            <div>Desde: ${roomData.startDate}</div>
          </div>
        ` : `
          <div class="small muted">Habitación disponible</div>
        `}
      </div>
    `;
  }).join('');
  
  return `
    <div style="margin-top: 15px;">
      <h4>Gestión de habitaciones</h4>
      ${roomsHtml}
    </div>
  `;
}

function calculateProfitability(property, budget, real) {
  const propertyName = property.name;
  
  // Calculate from budget
  const budgetIncome = budget
    .filter(b => b.property === propertyName && b.amount > 0)
    .reduce((sum, b) => sum + b.amount, 0) / 12; // Monthly average
    
  const budgetExpenses = Math.abs(budget
    .filter(b => b.property === propertyName && b.amount < 0)
    .reduce((sum, b) => sum + b.amount, 0)) / 12; // Monthly average
  
  // Calculate from real data
  const realIncome = real
    .filter(r => r.concept.includes(propertyName) && r.amount > 0)
    .reduce((sum, r) => sum + r.amount, 0);
    
  const realExpenses = Math.abs(real
    .filter(r => r.concept.includes(propertyName) && r.amount < 0)
    .reduce((sum, r) => sum + r.amount, 0));
  
  const budgetNet = budgetIncome - budgetExpenses;
  const annualReturn = budgetNet * 12;
  const incomeDiff = realIncome - budgetIncome;
  
  return {
    budgetIncome,
    budgetExpenses,
    budgetNet,
    annualReturn,
    realIncome,
    realExpenses,
    incomeDiff
  };
}

export default view;