import { getReal, getCategories } from '../storage.js';
import { fmtEUR, groupBy } from '../utils.js';

const view = {
  route:'#/reportes', title:'Reportes',
  async mount(root){
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
    
    root.innerHTML = `
      <div class="row">
        <div class="col">
          <div class="card">
            <h1>Reportes</h1>
            <div class="small muted">Análisis visual de tus finanzas</div>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Gastos por Categoría</h2>
            <canvas id="categoryChart" width="400" height="200"></canvas>
          </div>
        </div>
        <div class="col">
          <div class="card">
            <h2>Tendencia Mensual</h2>
            <canvas id="monthlyChart" width="400" height="200"></canvas>
          </div>
        </div>
      </div>
      <div class="row">
        <div class="col">
          <div class="card">
            <h2>Resumen por Categorías</h2>
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
    `;
    
    // Initialize charts
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      initCharts(categoryData, monthlyData);
    });
  }
};

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