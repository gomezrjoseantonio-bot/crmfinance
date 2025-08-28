import { getProperties, saveProperties } from '../storage.js';
import { fmtEUR, parseEuro } from '../utils.js';

function renderRentalYearConfiguration(property) {
  const currentYear = new Date().getFullYear();
  const selectedYear = property.selectedRentalYear || currentYear;
  const yearlyRentals = property.yearlyRentals || {};
  const yearData = yearlyRentals[selectedYear] || {
    monthlyRent: property.monthlyRent || 0,
    bank: '',
    startMonth: 1,
    endMonth: 12,
    adjustments: {}
  };
  
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  return `
    <div style="background:#f9f9f9; padding:15px; border-radius:5px; margin-top:10px;">
      <h4 style="margin:0 0 15px 0;">Configuración de Rentas para ${selectedYear}</h4>
      
      <div class="row">
        <div class="col">
          <label class="small muted">Renta Mensual Base (€)</label><br/>
          <input type="number" id="yearly-monthly-rent" value="${yearData.monthlyRent}" style="width:100%; margin-bottom:10px">
          
          <label class="small muted">Banco de Recepción</label><br/>
          <select id="yearly-rent-bank" style="width:100%; margin-bottom:10px">
            <option value="">Seleccionar banco</option>
            <option value="SANTANDER" ${yearData.bank === 'SANTANDER' ? 'selected' : ''}>Santander</option>
            <option value="BBVA" ${yearData.bank === 'BBVA' ? 'selected' : ''}>BBVA</option>
            <option value="CAIXABANK" ${yearData.bank === 'CAIXABANK' ? 'selected' : ''}>CaixaBank</option>
            <option value="BANKINTER" ${yearData.bank === 'BANKINTER' ? 'selected' : ''}>Bankinter</option>
            <option value="ING" ${yearData.bank === 'ING' ? 'selected' : ''}>ING</option>
          </select>
        </div>
        <div class="col">
          <label class="small muted">Período de Aplicación</label><br/>
          <div style="display:flex; gap:10px; margin-bottom:10px;">
            <div>
              <label class="small muted">Desde mes:</label><br/>
              <select id="yearly-start-month" style="width:80px;">
                ${Array.from({length: 12}, (_, i) => {
                  const month = i + 1;
                  const selected = month === yearData.startMonth ? 'selected' : '';
                  return `<option value="${month}" ${selected}>${monthNames[i]}</option>`;
                }).join('')}
              </select>
            </div>
            <div>
              <label class="small muted">Hasta mes:</label><br/>
              <select id="yearly-end-month" style="width:80px;">
                ${Array.from({length: 12}, (_, i) => {
                  const month = i + 1;
                  const selected = month === yearData.endMonth ? 'selected' : '';
                  return `<option value="${month}" ${selected}>${monthNames[i]}</option>`;
                }).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div style="margin-top:15px;">
        <h4 style="margin:0 0 10px 0;">Ajustes Mensuales Específicos</h4>
        <div class="small muted" style="margin-bottom:10px;">Configura importes específicos para meses concretos (opcional)</div>
        
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px;">
          ${monthNames.map((month, index) => {
            const monthNum = index + 1;
            const adjustment = yearData.adjustments[monthNum] || '';
            return `
              <div>
                <label class="small muted">${month} ${selectedYear}</label><br/>
                <input type="number" id="monthly-adjustment-${monthNum}" value="${adjustment}" 
                       placeholder="${yearData.monthlyRent}" style="width:100%;" 
                       title="Dejar vacío para usar renta base">
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <div style="margin-top:15px; padding:10px; background:#e8f4fd; border-radius:5px;">
        <strong>Resumen Anual ${selectedYear}:</strong>
        <div id="yearly-summary-${selectedYear}">
          ${renderYearlySummary(yearData, selectedYear)}
        </div>
      </div>
      
      <button onclick="saveYearlyRentalConfig('${property.id}')" class="primary" style="margin-top:10px;">Guardar Configuración ${selectedYear}</button>
    </div>
  `;
}

function renderYearlySummary(yearData, year) {
  const monthlyRent = yearData.monthlyRent || 0;
  const startMonth = yearData.startMonth || 1;
  const endMonth = yearData.endMonth || 12;
  const adjustments = yearData.adjustments || {};
  
  let totalAnnual = 0;
  let activeMonths = 0;
  
  for (let month = startMonth; month <= endMonth; month++) {
    const monthlyAmount = adjustments[month] ? parseFloat(adjustments[month]) : monthlyRent;
    totalAnnual += monthlyAmount;
    activeMonths++;
  }
  
  return `
    <div>Renta total anual: <strong>${fmtEUR(totalAnnual)}</strong></div>
    <div>Meses activos: ${activeMonths} | Promedio mensual: ${fmtEUR(totalAnnual / Math.max(1, activeMonths))}</div>
    <div>Banco: <strong>${yearData.bank || 'No especificado'}</strong></div>
  `;
}

function renderPortfolioSummary(properties) {
  let totalInvestment = 0;
  let totalMonthlyRent = 0;
  let totalMonthlyOperatingCosts = 0;
  let totalMonthlyFinancingCosts = 0;
  
  properties.forEach(property => {
    // Investment
    totalInvestment += (property.purchaseValue || 0) + 
                      (property.acquisitionCosts?.itp || 0) + 
                      (property.acquisitionCosts?.broker || 0) + 
                      (property.acquisitionCosts?.improvements || 0) + 
                      (property.acquisitionCosts?.maintenance || 0) + 
                      (property.acquisitionCosts?.furniture || 0);
    
    // Monthly rent
    totalMonthlyRent += property.monthlyRent || 0;
    
    // Operating costs (calculate annual costs based on months, then average)
    const operatingCosts = property.operatingCosts || {};
    let propertyAnnualOperatingCosts = 0;
    Object.values(operatingCosts).forEach(cost => {
      if (cost.enabled && cost.amount > 0) {
        const monthsCount = (cost.months || [1,2,3,4,5,6,7,8,9,10,11,12]).length;
        propertyAnnualOperatingCosts += cost.amount * monthsCount;
      }
    });
    totalMonthlyOperatingCosts += propertyAnnualOperatingCosts / 12;
    
    // Financing costs
    const financing = property.financing || {};
    totalMonthlyFinancingCosts += (financing.mortgage?.payment || 0) + (financing.loans?.payment || 0);
  });
  
  const totalMonthlyNet = totalMonthlyRent - totalMonthlyOperatingCosts - totalMonthlyFinancingCosts;
  const totalAnnualNet = totalMonthlyNet * 12;
  const portfolioYield = totalInvestment > 0 ? (totalAnnualNet / totalInvestment * 100) : 0;
  
  return `
    <div class="row">
      <div class="col">
        <h3 style="margin:0 0 5px 0;">💰 Ingresos Mensuales</h3>
        <div class="kpi">${fmtEUR(totalMonthlyRent)}</div>
        <div class="small muted">Anual: ${fmtEUR(totalMonthlyRent * 12)}</div>
      </div>
      <div class="col">
        <h3 style="margin:0 0 5px 0;">📉 Gastos Mensuales</h3>
        <div class="kpi">${fmtEUR(totalMonthlyOperatingCosts + totalMonthlyFinancingCosts)}</div>
        <div class="small muted">Explotación: ${fmtEUR(totalMonthlyOperatingCosts)} | Financiación: ${fmtEUR(totalMonthlyFinancingCosts)}</div>
      </div>
      <div class="col">
        <h3 style="margin:0 0 5px 0; color:${totalMonthlyNet >= 0 ? 'green' : 'red'};">💵 Beneficio Neto</h3>
        <div class="kpi" style="color:${totalMonthlyNet >= 0 ? 'green' : 'red'};">${fmtEUR(totalMonthlyNet)}</div>
        <div class="small muted">Anual: ${fmtEUR(totalAnnualNet)}</div>
      </div>
      <div class="col">
        <h3 style="margin:0 0 5px 0;">📈 Rentabilidad</h3>
        <div class="kpi">${portfolioYield.toFixed(2)}%</div>
        <div class="small muted">Inversión: ${fmtEUR(totalInvestment)}</div>
      </div>
    </div>
  `;
}

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
          ${renderRoomsConfiguration(property)}
        </div>
        
        <div id="full-config" style="display:${(property.rentalType || 'full') === 'full' ? 'block' : 'none'}">
          <label class="small muted">Renta Mensual Total (€)</label><br/>
          <input type="number" id="monthly-rent" value="${property.monthlyRent || 0}" style="width:100%; margin-bottom:10px">
        </div>
        
        <div style="margin-top:15px; border-top:1px solid #ddd; padding-top:15px;">
          <h3 style="margin:0 0 10px 0;">📅 Configuración de Rentas por Año</h3>
          
          <label class="small muted">Año de Configuración:</label><br/>
          <select id="rental-year" style="width:120px; margin-bottom:10px;" onchange="updateRentalYearConfig('${property.id}')">
            ${Array.from({length: 10}, (_, i) => {
              const year = new Date().getFullYear() + i - 2;
              const selected = year === new Date().getFullYear() ? 'selected' : '';
              return `<option value="${year}" ${selected}>${year}</option>`;
            }).join('')}
          </select>
          
          <div id="rental-year-config">
            ${renderRentalYearConfiguration(property)}
          </div>
        </div>
        
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
    
    <div class="row">
      <div class="col"><div class="card">
        <h2>🏦 Costes de Financiación</h2>
        <div class="muted small">Hipotecas y préstamos asociados al inmueble</div>
        
        <div style="margin-top:15px;">
          <h3 style="margin-top:0">Hipoteca Principal</h3>
          <div class="row">
            <div class="col">
              <label class="small muted">Cuota Mensual (€)</label><br/>
              <input type="number" id="mortgage-payment" value="${property.financing?.mortgage?.payment || 0}" style="width:100%; margin-bottom:10px">
              
              <label class="small muted">Banco</label><br/>
              <select id="mortgage-bank" style="width:100%; margin-bottom:10px">
                <option value="">Seleccionar banco</option>
                <option value="SANTANDER" ${property.financing?.mortgage?.bank === 'SANTANDER' ? 'selected' : ''}>Santander</option>
                <option value="BBVA" ${property.financing?.mortgage?.bank === 'BBVA' ? 'selected' : ''}>BBVA</option>
              </select>
            </div>
            <div class="col">
              <label class="small muted">Día de Pago</label><br/>
              <input type="number" id="mortgage-day" value="${property.financing?.mortgage?.day || 1}" min="1" max="31" style="width:100%; margin-bottom:10px">
              
              <label class="small muted">Capital Pendiente (€)</label><br/>
              <input type="number" id="mortgage-balance" value="${property.financing?.mortgage?.balance || 0}" style="width:100%; margin-bottom:10px">
            </div>
          </div>
          
          <h3>Otros Préstamos</h3>
          <div class="row">
            <div class="col">
              <label class="small muted">Cuota Mensual Total (€)</label><br/>
              <input type="number" id="loans-payment" value="${property.financing?.loans?.payment || 0}" style="width:100%; margin-bottom:10px">
              
              <label class="small muted">Banco Principal</label><br/>
              <select id="loans-bank" style="width:100%; margin-bottom:10px">
                <option value="">Seleccionar banco</option>
                <option value="SANTANDER" ${property.financing?.loans?.bank === 'SANTANDER' ? 'selected' : ''}>Santander</option>
                <option value="BBVA" ${property.financing?.loans?.bank === 'BBVA' ? 'selected' : ''}>BBVA</option>
              </select>
            </div>
            <div class="col">
              <label class="small muted">Día de Pago</label><br/>
              <input type="number" id="loans-day" value="${property.financing?.loans?.day || 1}" min="1" max="31" style="width:100%; margin-bottom:10px">
              
              <label class="small muted">Capital Pendiente Total (€)</label><br/>
              <input type="number" id="loans-balance" value="${property.financing?.loans?.balance || 0}" style="width:100%; margin-bottom:10px">
            </div>
          </div>
          
          <button onclick="saveFinancingCosts('${property.id}')" class="primary">Guardar Financiación</button>
        </div>
      </div></div>
      
      <div class="col"><div class="card">
        <h2>📊 Análisis de Rentabilidad</h2>
        <div class="muted small">Resumen financiero del inmueble</div>
        
        <div style="margin-top:15px;">
          ${renderProfitabilityAnalysis(property)}
        </div>
      </div></div>
    </div>
  `;
  
  // Add event listener for rental type change
  const rentalTypeSelect = detailsContainer.querySelector('#rental-type');
  const roomsConfig = detailsContainer.querySelector('#rooms-config');
  const fullConfig = detailsContainer.querySelector('#full-config');
  
  rentalTypeSelect.onchange = () => {
    const isRooms = rentalTypeSelect.value === 'rooms';
    roomsConfig.style.display = isRooms ? 'block' : 'none';
    fullConfig.style.display = isRooms ? 'none' : 'block';
  };
}

function renderProfitabilityAnalysis(property) {
  // Calculate monthly income
  const monthlyRent = property.monthlyRent || 0;
  
  // Calculate monthly operating costs (average based on months applied)
  const operatingCosts = property.operatingCosts || {};
  let totalAnnualOperatingCosts = 0;
  
  Object.values(operatingCosts).forEach(cost => {
    if (cost.enabled && cost.amount > 0) {
      const monthsCount = (cost.months || [1,2,3,4,5,6,7,8,9,10,11,12]).length;
      totalAnnualOperatingCosts += cost.amount * monthsCount;
    }
  });
  
  const monthlyOperatingCosts = totalAnnualOperatingCosts / 12;
  
  // Calculate monthly financing costs
  const financing = property.financing || {};
  const monthlyFinancingCosts = (financing.mortgage?.payment || 0) + (financing.loans?.payment || 0);
  
  // Calculate net monthly income
  const monthlyNet = monthlyRent - monthlyOperatingCosts - monthlyFinancingCosts;
  
  // Calculate annual figures
  const annualRent = monthlyRent * 12;
  const annualOperatingCosts = totalAnnualOperatingCosts;
  const annualFinancingCosts = monthlyFinancingCosts * 12;
  const annualNet = monthlyNet * 12;
  
  // Calculate investment metrics
  const totalInvestment = (property.purchaseValue || 0) + 
                         (property.acquisitionCosts?.itp || 0) + 
                         (property.acquisitionCosts?.broker || 0) + 
                         (property.acquisitionCosts?.improvements || 0) + 
                         (property.acquisitionCosts?.maintenance || 0) + 
                         (property.acquisitionCosts?.furniture || 0);
  
  const grossYield = totalInvestment > 0 ? (annualRent / totalInvestment * 100) : 0;
  const netYield = totalInvestment > 0 ? (annualNet / totalInvestment * 100) : 0;
  
  // Calculate since purchase (assuming property was purchased)
  const purchaseDate = property.purchaseDate ? new Date(property.purchaseDate) : new Date();
  const monthsSincePurchase = Math.max(1, Math.ceil((new Date() - purchaseDate) / (1000 * 60 * 60 * 24 * 30)));
  const totalNetSincePurchase = monthlyNet * monthsSincePurchase;
  
  return `
    <div style="margin-bottom:15px;">
      <label for="analysis-year-${property.id}" class="small muted">Año para Análisis de Presupuesto:</label>
      <select id="analysis-year-${property.id}" style="width:120px; margin-left:10px;" onchange="updateProfitabilityAnalysis('${property.id}')">
        ${Array.from({length: 5}, (_, i) => {
          const year = new Date().getFullYear() + i - 1;
          const selected = year === new Date().getFullYear() ? 'selected' : '';
          return `<option value="${year}" ${selected}>${year}</option>`;
        }).join('')}
      </select>
    </div>
    
    <div class="row" style="margin-bottom:15px;">
      <div class="col">
        <h3 style="margin:0 0 10px 0; color:var(--accent);">💰 Ingresos Mensuales</h3>
        <div class="kpi" style="font-size:18px;">${fmtEUR(monthlyRent)}</div>
        <div class="small muted">Anual: ${fmtEUR(annualRent)}</div>
        ${property.rentalType === 'rooms' && property.rooms ? renderRoomsProfitability(property) : ''}
      </div>
      <div class="col">
        <h3 style="margin:0 0 10px 0; color:var(--accent);">📉 Gastos Mensuales</h3>
        <div class="kpi" style="font-size:18px;">${fmtEUR(monthlyOperatingCosts + monthlyFinancingCosts)}</div>
        <div class="small muted">Explotación: ${fmtEUR(monthlyOperatingCosts)} | Financiación: ${fmtEUR(monthlyFinancingCosts)}</div>
      </div>
    </div>
    
    <div class="row" style="margin-bottom:15px;">
      <div class="col">
        <h3 style="margin:0 0 10px 0; color:${monthlyNet >= 0 ? 'green' : 'red'};">💵 Beneficio Neto Mensual</h3>
        <div class="kpi" style="font-size:20px; color:${monthlyNet >= 0 ? 'green' : 'red'};">${fmtEUR(monthlyNet)}</div>
        <div class="small muted">Anual: ${fmtEUR(annualNet)}</div>
      </div>
      <div class="col">
        <h3 style="margin:0 0 10px 0; color:var(--accent);">📈 Rentabilidades</h3>
        <div style="margin-bottom:5px;"><strong>Bruta:</strong> ${grossYield.toFixed(2)}%</div>
        <div><strong>Neta:</strong> ${netYield.toFixed(2)}%</div>
      </div>
    </div>
    
    ${property.rentalType === 'rooms' && property.rooms ? renderDetailedRoomAnalysis(property, monthlyOperatingCosts, monthlyFinancingCosts, totalInvestment) : ''}
    
    <div class="row">
      <div class="col">
        <h3 style="margin:0 0 10px 0; color:var(--accent);">🎯 Desde la Compra</h3>
        <div><strong>Meses transcurridos:</strong> ${monthsSincePurchase}</div>
        <div><strong>Beneficio acumulado:</strong> ${fmtEUR(totalNetSincePurchase)}</div>
        <div class="small muted">Inversión total: ${fmtEUR(totalInvestment)}</div>
      </div>
    </div>
  `;
}

function renderRoomsConfiguration(property) {
  const rooms = property.rooms || [];
  const availableRooms = property.availableRooms || 1;
  
  // Ensure we have the right number of room configurations
  while (rooms.length < availableRooms) {
    rooms.push({
      name: `Habitación ${rooms.length + 1}`,
      rent: 0,
      occupied: false
    });
  }
  
  return `
    <label class="small muted">Número de Habitaciones Disponibles</label><br/>
    <input type="number" id="available-rooms" value="${availableRooms}" min="1" max="10" style="width:100%; margin-bottom:15px" onchange="updateRoomsCount('${property.id}')">
    
    <div class="grid" style="margin-bottom:15px;">
      <table>
        <thead>
          <tr>
            <th>Habitación</th>
            <th>Nombre</th>
            <th>Alquiler Mensual (€)</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${rooms.slice(0, availableRooms).map((room, index) => `
            <tr>
              <td>H${index + 1}</td>
              <td><input type="text" id="room-${index}-name" value="${room.name || `Habitación ${index + 1}`}" style="width:120px"></td>
              <td><input type="number" id="room-${index}-rent" value="${room.rent || 0}" style="width:80px"></td>
              <td>
                <select id="room-${index}-occupied" style="width:100px">
                  <option value="false" ${!room.occupied ? 'selected' : ''}>Libre</option>
                  <option value="true" ${room.occupied ? 'selected' : ''}>Ocupada</option>
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div style="margin-bottom:10px;">
      <strong>Resumen: </strong>
      <span id="rooms-summary">
        Total mensual: ${fmtEUR(rooms.slice(0, availableRooms).reduce((sum, room) => sum + (parseFloat(room.rent) || 0), 0))} | 
        Ocupadas: ${rooms.slice(0, availableRooms).filter(room => room.occupied).length}/${availableRooms}
      </span>
    </div>
  `;
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
  
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  return `
    <div class="grid" style="margin-bottom:15px;">
      <table>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Aplica</th>
            <th>Importe (€)</th>
            <th>Meses Aplicables</th>
            <th>Banco</th>
            <th>Día</th>
          </tr>
        </thead>
        <tbody>
          ${costTypes.map(cost => {
            const costData = costs[cost.id] || {};
            const months = costData.months || [1,2,3,4,5,6,7,8,9,10,11,12]; // Default to all months
            return `
            <tr>
              <td>${cost.label}</td>
              <td><input type="checkbox" id="cost-${cost.id}-enabled" ${costData.enabled ? 'checked' : ''}></td>
              <td><input type="number" id="cost-${cost.id}-amount" value="${costData.amount || cost.defaultValue}" style="width:80px"></td>
              <td>
                <div style="display:flex; flex-wrap:wrap; gap:2px; max-width:200px;">
                  ${monthNames.map((month, index) => `
                    <label style="font-size:11px; cursor:pointer;">
                      <input type="checkbox" id="cost-${cost.id}-month-${index + 1}" 
                             ${months.includes(index + 1) ? 'checked' : ''} 
                             style="margin-right:2px;">
                      ${month}
                    </label>
                  `).join('')}
                </div>
                <div style="margin-top:5px;">
                  <button type="button" onclick="toggleAllMonths('${cost.id}', true)" class="small">Todos</button>
                  <button type="button" onclick="toggleAllMonths('${cost.id}', false)" class="small">Ninguno</button>
                </div>
              </td>
              <td>
                <select id="cost-${cost.id}-bank" style="width:100px">
                  <option value="">Seleccionar</option>
                  <option value="SANTANDER" ${costData.bank === 'SANTANDER' ? 'selected' : ''}>Santander</option>
                  <option value="BBVA" ${costData.bank === 'BBVA' ? 'selected' : ''}>BBVA</option>
                </select>
              </td>
              <td><input type="number" id="cost-${cost.id}-day" value="${costData.day || 1}" min="1" max="31" style="width:50px"></td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div style="margin-bottom:15px; padding:10px; background:#f5f5f5; border-radius:5px;">
      <h4 style="margin:0 0 10px 0;">📊 Resumen de Costes Anuales</h4>
      <div id="costs-summary">
        ${renderCostsSummary(costs)}
      </div>
    </div>
    
    <button onclick="saveOperatingCosts('${property.id}')" class="primary">Guardar Costes de Explotación</button>
  `;
}

function renderCostsSummary(costs) {
  let totalAnnual = 0;
  const summaryItems = [];
  
  Object.entries(costs).forEach(([costId, costData]) => {
    if (costData.enabled && costData.amount > 0) {
      const monthsCount = (costData.months || [1,2,3,4,5,6,7,8,9,10,11,12]).length;
      const annualCost = costData.amount * monthsCount;
      totalAnnual += annualCost;
      
      const monthsText = costData.months ? costData.months.join(', ') : '1-12';
      summaryItems.push(`<div><strong>${getCostLabel(costId)}:</strong> ${fmtEUR(costData.amount)} × ${monthsCount} meses = ${fmtEUR(annualCost)} (Meses: ${monthsText})</div>`);
    }
  });
  
  return `
    ${summaryItems.join('')}
    <div style="margin-top:10px; font-weight:bold; color:#7c3aed;">
      <strong>Total Anual: ${fmtEUR(totalAnnual)}</strong>
    </div>
  `;
}

function renderRoomsProfitability(property) {
  const rooms = property.rooms || [];
  const totalRent = rooms.reduce((sum, room) => sum + (parseFloat(room.rent) || 0), 0);
  const occupiedRooms = rooms.filter(room => room.occupied);
  const occupiedRent = occupiedRooms.reduce((sum, room) => sum + (parseFloat(room.rent) || 0), 0);
  
  return `
    <div style="margin-top:10px; padding:10px; background:#f9f9f9; border-radius:5px;">
      <div class="small"><strong>Desglose por habitaciones:</strong></div>
      <div class="small">Potencial: ${fmtEUR(totalRent)} | Actual: ${fmtEUR(occupiedRent)}</div>
      <div class="small">Ocupación: ${occupiedRooms.length}/${rooms.length} habitaciones (${((occupiedRooms.length/rooms.length)*100).toFixed(1)}%)</div>
    </div>
  `;
}

function renderDetailedRoomAnalysis(property, monthlyOperatingCosts, monthlyFinancingCosts, totalInvestment) {
  const rooms = property.rooms || [];
  if (rooms.length === 0) return '';
  
  // Distribute costs proportionally among rooms based on rent
  const totalRent = rooms.reduce((sum, room) => sum + (parseFloat(room.rent) || 0), 0);
  
  return `
    <div class="row" style="margin-top:20px;">
      <div class="col"><div class="card">
        <h3 style="margin-top:0;">🏠 Análisis Detallado por Habitación</h3>
        
        <div class="grid">
          <table>
            <thead>
              <tr>
                <th>Habitación</th>
                <th>Alquiler Mensual</th>
                <th>Estado</th>
                <th>Gastos Asignados</th>
                <th>Beneficio Mensual</th>
                <th>Rentabilidad</th>
              </tr>
            </thead>
            <tbody>
              ${rooms.map(room => {
                const roomRent = parseFloat(room.rent) || 0;
                const roomProportion = totalRent > 0 ? roomRent / totalRent : 1 / rooms.length;
                const roomOperatingCosts = monthlyOperatingCosts * roomProportion;
                const roomFinancingCosts = monthlyFinancingCosts * roomProportion;
                const roomTotalCosts = roomOperatingCosts + roomFinancingCosts;
                const roomNet = room.occupied ? roomRent - roomTotalCosts : -roomTotalCosts;
                const roomInvestment = totalInvestment * roomProportion;
                const roomYield = roomInvestment > 0 && room.occupied ? ((roomRent * 12) / roomInvestment * 100) : 0;
                
                return `
                  <tr>
                    <td><strong>${room.name || 'Sin nombre'}</strong></td>
                    <td>${fmtEUR(roomRent)}</td>
                    <td style="color:${room.occupied ? 'green' : 'orange'}">${room.occupied ? '✅ Ocupada' : '⚠️ Libre'}</td>
                    <td>${fmtEUR(roomTotalCosts)}</td>
                    <td style="color:${roomNet >= 0 ? 'green' : 'red'}">${fmtEUR(roomNet)}</td>
                    <td>${roomYield.toFixed(2)}%</td>
                  </tr>
                `;
              }).join('')}
              <tr style="border-top:2px solid #ddd; font-weight:bold;">
                <td>TOTAL</td>
                <td>${fmtEUR(totalRent)}</td>
                <td>${rooms.filter(r => r.occupied).length}/${rooms.length}</td>
                <td>${fmtEUR(monthlyOperatingCosts + monthlyFinancingCosts)}</td>
                <td style="color:${(totalRent - monthlyOperatingCosts - monthlyFinancingCosts) >= 0 ? 'green' : 'red'}">${fmtEUR(totalRent - monthlyOperatingCosts - monthlyFinancingCosts)}</td>
                <td>${totalInvestment > 0 ? ((totalRent * 12) / totalInvestment * 100).toFixed(2) : 0}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div style="margin-top:15px; padding:10px; background:#e8f4fd; border-radius:5px;">
          <h4 style="margin:0 0 10px 0;">📊 Optimización de Ingresos</h4>
          <div class="row">
            <div class="col">
              <div><strong>Potencial máximo:</strong> ${fmtEUR(totalRent)} mensual</div>
              <div><strong>Ingresos actuales:</strong> ${fmtEUR(rooms.filter(r => r.occupied).reduce((sum, room) => sum + (parseFloat(room.rent) || 0), 0))} mensual</div>
            </div>
            <div class="col">
              <div><strong>Habitaciones libres:</strong> ${rooms.filter(r => !r.occupied).length}</div>
              <div><strong>Pérdida potencial:</strong> ${fmtEUR(rooms.filter(r => !r.occupied).reduce((sum, room) => sum + (parseFloat(room.rent) || 0), 0))} mensual</div>
            </div>
          </div>
        </div>
      </div></div>
    </div>
  `;
}

function getCostLabel(costId) {
  const labels = {
    management: 'Gestión', ibi: 'IBI', community: 'Comunidad', 
    homeInsurance: 'Seguro Hogar', lifeInsurance: 'Seguro Vida', 
    cleaning: 'Limpieza', electricity: 'Luz', water: 'Agua', 
    gas: 'Gas', internet: 'Internet', netflix: 'Netflix', 
    others: 'Otros', maintenance: 'Mantenimiento', furniture: 'Mobiliario'
  };
  return labels[costId] || costId;
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
      
      ${properties.length > 0 ? `
      <div class="row">
        <div class="col"><div class="card">
          <h2>📊 Resumen de Cartera</h2>
          ${renderPortfolioSummary(properties)}
        </div></div>
      </div>
      ` : ''}
      
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
      
      // Refresh the P&L view to show updated calculations
      showPropertyDetails(property, root);
    };
    
    window.saveRentalConfig = (propertyId) => {
      const properties = getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      
      property.rentalType = root.querySelector('#rental-type').value;
      
      if (property.rentalType === 'rooms') {
        property.availableRooms = parseInt(root.querySelector('#available-rooms').value) || 1;
        property.rooms = [];
        
        for (let i = 0; i < property.availableRooms; i++) {
          const nameInput = root.querySelector(`#room-${i}-name`);
          const rentInput = root.querySelector(`#room-${i}-rent`);
          const occupiedSelect = root.querySelector(`#room-${i}-occupied`);
          
          if (nameInput && rentInput && occupiedSelect) {
            property.rooms.push({
              name: nameInput.value || `Habitación ${i + 1}`,
              rent: parseFloat(rentInput.value) || 0,
              occupied: occupiedSelect.value === 'true'
            });
          }
        }
        
        // Calculate total monthly rent from rooms
        property.monthlyRent = property.rooms.reduce((sum, room) => sum + (parseFloat(room.rent) || 0), 0);
      } else {
        property.monthlyRent = parseFloat(root.querySelector('#monthly-rent').value) || 0;
      }
      
      saveProperties(properties);
      alert('Configuración de alquiler guardada correctamente');
      
      // Refresh the P&L view to show updated calculations
      showPropertyDetails(property, root);
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
        
        // Collect selected months
        const months = [];
        for (let i = 1; i <= 12; i++) {
          const monthCheckbox = root.querySelector(`#cost-${costId}-month-${i}`);
          if (monthCheckbox && monthCheckbox.checked) {
            months.push(i);
          }
        }
        
        property.operatingCosts[costId] = {
          enabled,
          amount,
          bank,
          day,
          months: months.length > 0 ? months : [1,2,3,4,5,6,7,8,9,10,11,12] // Default to all months
        };
      });
      
      saveProperties(properties);
      alert('Costes de explotación guardados correctamente');
      
      // Refresh the P&L view to show updated calculations
      showPropertyDetails(property, root);
    };
    
    window.saveFinancingCosts = (propertyId) => {
      const properties = getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      
      property.financing = {
        mortgage: {
          payment: parseFloat(root.querySelector('#mortgage-payment').value) || 0,
          bank: root.querySelector('#mortgage-bank').value,
          day: parseInt(root.querySelector('#mortgage-day').value) || 1,
          balance: parseFloat(root.querySelector('#mortgage-balance').value) || 0
        },
        loans: {
          payment: parseFloat(root.querySelector('#loans-payment').value) || 0,
          bank: root.querySelector('#loans-bank').value,
          day: parseInt(root.querySelector('#loans-day').value) || 1,
          balance: parseFloat(root.querySelector('#loans-balance').value) || 0
        }
      };
      
      saveProperties(properties);
      alert('Costes de financiación guardados correctamente');
      
      // Refresh the P&L view to show updated calculations
      showPropertyDetails(property, root);
    };
    
    // Room management functions
    window.updateRoomsCount = (propertyId) => {
      const properties = getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      
      const newCount = parseInt(root.querySelector('#available-rooms').value) || 1;
      property.availableRooms = newCount;
      
      // Initialize rooms array if it doesn't exist
      if (!property.rooms) property.rooms = [];
      
      // Adjust rooms array size
      while (property.rooms.length < newCount) {
        property.rooms.push({
          name: `Habitación ${property.rooms.length + 1}`,
          rent: 0,
          occupied: false
        });
      }
      
      saveProperties(properties);
      showPropertyDetails(property, root);
    };
    
    // Month toggle functions
    window.toggleAllMonths = (costId, selectAll) => {
      for (let i = 1; i <= 12; i++) {
        const checkbox = root.querySelector(`#cost-${costId}-month-${i}`);
        if (checkbox) checkbox.checked = selectAll;
      }
    };
    
    // Year selection for budget analysis
    window.updateProfitabilityAnalysis = (propertyId) => {
      const properties = getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      
      const selectedYear = parseInt(root.querySelector(`#analysis-year-${propertyId}`).value);
      
      // Here you would integrate with budget/forecast system to get projected data for the selected year
      // For now, we'll just refresh the current analysis
      showPropertyDetails(property, root);
      
      // Future implementation: Update the analysis with year-specific budget data
      console.log(`Análisis actualizado para el año ${selectedYear} de la propiedad ${propertyId}`);
    };
    
    // Rental year configuration functions
    window.updateRentalYearConfig = (propertyId) => {
      const properties = getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      
      const selectedYear = parseInt(root.querySelector('#rental-year').value);
      property.selectedRentalYear = selectedYear;
      
      saveProperties(properties);
      showPropertyDetails(property, root);
    };
    
    window.saveYearlyRentalConfig = (propertyId) => {
      const properties = getProperties();
      const property = properties.find(p => p.id === propertyId);
      if (!property) return;
      
      const selectedYear = parseInt(root.querySelector('#rental-year').value);
      
      if (!property.yearlyRentals) property.yearlyRentals = {};
      
      // Collect monthly adjustments
      const adjustments = {};
      for (let month = 1; month <= 12; month++) {
        const adjustmentInput = root.querySelector(`#monthly-adjustment-${month}`);
        if (adjustmentInput && adjustmentInput.value) {
          adjustments[month] = parseFloat(adjustmentInput.value);
        }
      }
      
      property.yearlyRentals[selectedYear] = {
        monthlyRent: parseFloat(root.querySelector('#yearly-monthly-rent').value) || 0,
        bank: root.querySelector('#yearly-rent-bank').value,
        startMonth: parseInt(root.querySelector('#yearly-start-month').value) || 1,
        endMonth: parseInt(root.querySelector('#yearly-end-month').value) || 12,
        adjustments: adjustments
      };
      
      // Update the property's main monthly rent with current year's base rent
      if (selectedYear === new Date().getFullYear()) {
        property.monthlyRent = property.yearlyRentals[selectedYear].monthlyRent;
      }
      
      saveProperties(properties);
      alert(`Configuración de rentas para ${selectedYear} guardada correctamente`);
      
      // Refresh the P&L view to show updated calculations
      showPropertyDetails(property, root);
    };
  }
};

export default view;