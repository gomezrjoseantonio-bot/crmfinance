import { getRecurrences, saveRecurrences, getAccounts, getYear } from '../storage.js';
import { fmtEUR, parseEuro } from '../utils.js';
import { generateForecast } from '../forecast-generator.js';

const view = {
  route: '#/recurrences',
  title: 'Recurrencias',
  
  async mount(root) {
    const recurrences = getRecurrences();
    const accounts = getAccounts();
    
    const accountOptions = accounts.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    
    const recurrenceRows = recurrences.map((rec, i) => `
      <tr>
        <td>${rec.type}</td>
        <td>${rec.concept}</td>
        <td>${rec.accountId}</td>
        <td>${fmtEUR(rec.amount)}</td>
        <td>${rec.frequency}</td>
        <td>${rec.day}</td>
        <td>${rec.category || '-'}</td>
        <td>
          <button class="delete-rec" data-index="${i}" style="font-size:12px">Borrar</button>
        </td>
      </tr>
    `).join('');
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>Recurrencias Maestro</h1>
            <div class="small muted">Define ingresos y gastos recurrentes que se propagarán automáticamente</div>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>➕ Añadir nueva recurrencia</h2>
            
            <div class="row">
              <div class="col">
                <label class="small muted">Tipo</label><br/>
                <select id="type" style="width:140px">
                  <option value="INGRESO">Ingreso</option>
                  <option value="GASTO">Gasto</option>
                </select>
              </div>
              <div class="col">
                <label class="small muted">Concepto</label><br/>
                <input type="text" id="concept" placeholder="Descripción" style="width:200px">
              </div>
              <div class="col">
                <label class="small muted">Cuenta</label><br/>
                <select id="accountId" style="width:140px">${accountOptions}</select>
              </div>
            </div>
            
            <div class="row" style="margin-top:10px">
              <div class="col">
                <label class="small muted">Importe (€)</label><br/>
                <input type="number" id="amount" step="0.01" style="width:120px">
              </div>
              <div class="col">
                <label class="small muted">Frecuencia</label><br/>
                <select id="frequency" style="width:140px">
                  <option value="MENSUAL">Mensual</option>
                  <option value="BIMESTRAL">Bimestral</option>
                  <option value="TRIMESTRAL">Trimestral</option>
                  <option value="SEMESTRAL">Semestral</option>
                  <option value="ANUAL">Anual</option>
                  <option value="SEMANAL">Semanal</option>
                  <option value="QUINCENAL">Quincenal</option>
                </select>
              </div>
              <div class="col">
                <label class="small muted">Día</label><br/>
                <input type="number" id="day" min="1" max="31" placeholder="1-31 o 'last'" style="width:80px">
              </div>
            </div>
            
            <div class="row" style="margin-top:10px">
              <div class="col">
                <label class="small muted">Categoría</label><br/>
                <input type="text" id="category" placeholder="Opcional" style="width:160px">
              </div>
              <div class="col">
                <label class="small muted">Mes ancla (para bi/tri/semestral/anual)</label><br/>
                <input type="number" id="anchorMonth" min="1" max="12" placeholder="1-12" style="width:80px">
              </div>
              <div class="col">
                <label class="small muted">Inicio</label><br/>
                <input type="date" id="startDate" style="width:140px">
              </div>
            </div>
            
            <div class="row" style="margin-top:10px">
              <div class="col">
                <label class="small muted">Fin (opcional)</label><br/>
                <input type="date" id="endDate" style="width:140px">
              </div>
              <div class="col">
                <label class="small muted">Notas</label><br/>
                <input type="text" id="notes" placeholder="Opcional" style="width:200px">
              </div>
            </div>
            
            <button id="addRecurrence" class="primary" style="margin-top:15px">Añadir recurrencia</button>
          </div>
        </div>
      </div>
      
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>📋 Recurrencias configuradas</h2>
            <div class="grid">
              <table>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Concepto</th>
                    <th>Cuenta</th>
                    <th>Importe</th>
                    <th>Frecuencia</th>
                    <th>Día</th>
                    <th>Categoría</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  ${recurrenceRows || '<tr><td colspan="8" style="text-align:center; color:var(--muted)">No hay recurrencias configuradas</td></tr>'}
                </tbody>
              </table>
            </div>
            
            <div style="margin-top:10px">
              <button id="generateForecast" class="primary">🔄 Generar previsión desde enero</button>
              <button id="regenerateFromMonth" style="margin-left:10px">🔄 Re-generar desde mes...</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Event handlers
    root.querySelector('#addRecurrence').onclick = () => {
      const type = root.querySelector('#type').value;
      const concept = root.querySelector('#concept').value.trim();
      const accountId = root.querySelector('#accountId').value;
      const amount = parseFloat(root.querySelector('#amount').value) || 0;
      const frequency = root.querySelector('#frequency').value;
      const day = parseInt(root.querySelector('#day').value) || 1;
      const category = root.querySelector('#category').value.trim();
      const anchorMonth = parseInt(root.querySelector('#anchorMonth').value) || 1;
      const startDate = root.querySelector('#startDate').value;
      const endDate = root.querySelector('#endDate').value;
      const notes = root.querySelector('#notes').value.trim();
      
      if (!concept || amount === 0) {
        alert('Por favor, introduce un concepto y un importe válidos');
        return;
      }
      
      const newRecurrence = {
        type,
        concept,
        accountId,
        amount: type === 'GASTO' ? -Math.abs(amount) : Math.abs(amount),
        frequency,
        day,
        category,
        anchorMonth,
        startDate,
        endDate: endDate || null,
        notes,
        id: Date.now().toString()
      };
      
      recurrences.push(newRecurrence);
      saveRecurrences(recurrences);
      
      alert('Recurrencia añadida correctamente');
      view.mount(root); // Refresh view
    };
    
    // Delete recurrence handlers
    root.querySelectorAll('.delete-rec').forEach(btn => {
      btn.onclick = () => {
        const index = parseInt(btn.getAttribute('data-index'));
        if (confirm('¿Estás seguro de que quieres eliminar esta recurrencia?')) {
          recurrences.splice(index, 1);
          saveRecurrences(recurrences);
          view.mount(root); // Refresh view
        }
      };
    });
    
    root.querySelector('#generateForecast').onclick = () => {
      generateForecastFromRecurrences(1);
      alert('Previsión generada desde enero');
    };
    
    root.querySelector('#regenerateFromMonth').onclick = () => {
      const month = prompt('¿Desde qué mes quieres regenerar? (1-12)', '1');
      const monthNum = parseInt(month);
      if (monthNum >= 1 && monthNum <= 12) {
        generateForecastFromRecurrences(monthNum);
        alert(`Previsión regenerada desde mes ${monthNum}`);
      }
    };
  }
};

function generateForecastFromRecurrences(fromMonth) {
  const year = getYear();
  const forecast = generateForecast(year, fromMonth);
  console.log(`Generated ${forecast.length} movements from month ${fromMonth}`);
}

export default view;