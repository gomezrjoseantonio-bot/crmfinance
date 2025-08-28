// Export utilities for properties and operating costs

import { getProperties, getOperatingCosts } from './storage.js';
import { fmtEUR } from './utils.js';

// Convert data to CSV format
function arrayToCSV(data, headers) {
  const csvRows = [];
  
  // Add headers
  csvRows.push(headers.join(';'));
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const escaped = ('' + (row[header] || '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(';'));
  });
  
  return csvRows.join('\n');
}

// Export properties to CSV/XLS
export function exportPropertiesToCSV() {
  try {
    const properties = getProperties();
    
    if (properties.length === 0) {
      alert('No hay propiedades para exportar');
      return;
    }
    
    const exportData = [];
    
    properties.forEach(property => {
      if (property.type === 'complete') {
        exportData.push({
          direccion: property.address,
          tipo: 'Piso completo',
          renta_total: property.rent,
          habitacion: '-',
          renta_habitacion: '-',
          ocupada: '-',
          fecha_creacion: new Date(property.createdAt).toLocaleDateString('es-ES')
        });
      } else {
        property.rooms.forEach(room => {
          exportData.push({
            direccion: property.address,
            tipo: 'Por habitaciones',
            renta_total: property.rooms.reduce((sum, r) => sum + r.rent, 0),
            habitacion: room.name,
            renta_habitacion: room.rent,
            ocupada: room.occupied ? 'Sí' : 'No',
            fecha_creacion: new Date(property.createdAt).toLocaleDateString('es-ES')
          });
        });
      }
    });
    
    const headers = ['direccion', 'tipo', 'renta_total', 'habitacion', 'renta_habitacion', 'ocupada', 'fecha_creacion'];
    const csv = arrayToCSV(exportData, headers);
    
    downloadFile(csv, 'propiedades.csv', 'text/csv;charset=utf-8;');
    
  } catch (error) {
    console.error('Error exporting properties:', error);
    alert('Error al exportar las propiedades');
  }
}

// Export operating costs to CSV/XLS
export function exportOperatingCostsToCSV() {
  try {
    const costs = getOperatingCosts();
    
    if (costs.length === 0) {
      alert('No hay costes operativos para exportar');
      return;
    }
    
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const exportData = costs.map(cost => ({
      nombre: cost.name,
      importe: cost.amount,
      meses_numeros: cost.months.join(', '),
      meses_nombres: cost.months.map(m => monthNames[m - 1]).join(', '),
      total_anual: cost.amount * cost.months.length,
      fecha_creacion: new Date(cost.createdAt).toLocaleDateString('es-ES')
    }));
    
    const headers = ['nombre', 'importe', 'meses_numeros', 'meses_nombres', 'total_anual', 'fecha_creacion'];
    const csv = arrayToCSV(exportData, headers);
    
    downloadFile(csv, 'costes_operativos.csv', 'text/csv;charset=utf-8;');
    
  } catch (error) {
    console.error('Error exporting operating costs:', error);
    alert('Error al exportar los costes operativos');
  }
}

// Export all data to CSV/XLS
export function exportAllDataToCSV() {
  try {
    const properties = getProperties();
    const costs = getOperatingCosts();
    
    if (properties.length === 0 && costs.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    
    let csvContent = '';
    
    // Properties section
    if (properties.length > 0) {
      csvContent += 'PROPIEDADES\n';
      csvContent += ';\n'; // Empty line
      
      const exportData = [];
      properties.forEach(property => {
        if (property.type === 'complete') {
          exportData.push({
            direccion: property.address,
            tipo: 'Piso completo',
            renta_total: property.rent,
            habitacion: '-',
            renta_habitacion: '-',
            ocupada: '-'
          });
        } else {
          property.rooms.forEach(room => {
            exportData.push({
              direccion: property.address,
              tipo: 'Por habitaciones',
              renta_total: property.rooms.reduce((sum, r) => sum + r.rent, 0),
              habitacion: room.name,
              renta_habitacion: room.rent,
              ocupada: room.occupied ? 'Sí' : 'No'
            });
          });
        }
      });
      
      const headers = ['direccion', 'tipo', 'renta_total', 'habitacion', 'renta_habitacion', 'ocupada'];
      csvContent += arrayToCSV(exportData, headers);
      csvContent += '\n\n';
    }
    
    // Operating costs section
    if (costs.length > 0) {
      csvContent += 'COSTES OPERATIVOS\n';
      csvContent += ';\n'; // Empty line
      
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      
      const costsData = costs.map(cost => ({
        nombre: cost.name,
        importe: cost.amount,
        meses: cost.months.map(m => monthNames[m - 1]).join(', '),
        total_anual: cost.amount * cost.months.length
      }));
      
      const costHeaders = ['nombre', 'importe', 'meses', 'total_anual'];
      csvContent += arrayToCSV(costsData, costHeaders);
    }
    
    downloadFile(csvContent, 'datos_completos.csv', 'text/csv;charset=utf-8;');
    
  } catch (error) {
    console.error('Error exporting all data:', error);
    alert('Error al exportar todos los datos');
  }
}

// Export to PDF (simplified HTML to PDF)
export function exportPropertiesToPDF() {
  try {
    const properties = getProperties();
    const costs = getOperatingCosts();
    
    if (properties.length === 0 && costs.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    
    // Create HTML content for PDF
    let htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reporte de Propiedades</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px; }
            h2 { color: #4a5568; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f8f9fa; font-weight: bold; }
            .property { margin: 15px 0; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px; }
            .cost-item { margin: 10px 0; padding: 10px; background-color: #f8f9fa; border-radius: 6px; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>🏠 Reporte de Propiedades y Costes Operativos</h1>
          <p><strong>Fecha del reporte:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
    `;
    
    // Properties section
    if (properties.length > 0) {
      htmlContent += '<h2>Propiedades</h2>';
      
      properties.forEach(property => {
        htmlContent += `
          <div class="property">
            <h3>${property.address}</h3>
            <p><strong>Tipo:</strong> ${property.type === 'complete' ? 'Piso completo' : 'Por habitaciones'}</p>
        `;
        
        if (property.type === 'complete') {
          htmlContent += `<p><strong>Renta mensual:</strong> ${fmtEUR(property.rent)}</p>`;
        } else {
          htmlContent += '<h4>Habitaciones:</h4><ul>';
          property.rooms.forEach(room => {
            htmlContent += `
              <li>
                <strong>${room.name}:</strong> ${fmtEUR(room.rent)}/mes 
                <span style="color: ${room.occupied ? '#dc2626' : '#16a34a'};">
                  (${room.occupied ? 'Ocupada' : 'Disponible'})
                </span>
              </li>
            `;
          });
          htmlContent += '</ul>';
          const totalRent = property.rooms.reduce((sum, room) => sum + room.rent, 0);
          htmlContent += `<p><strong>Renta total:</strong> ${fmtEUR(totalRent)}</p>`;
        }
        
        htmlContent += '</div>';
      });
    }
    
    // Operating costs section
    if (costs.length > 0) {
      htmlContent += '<h2>Costes Operativos</h2>';
      
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      
      costs.forEach(cost => {
        const monthsText = cost.months.map(m => monthNames[m - 1]).join(', ');
        const totalAnual = cost.amount * cost.months.length;
        
        htmlContent += `
          <div class="cost-item">
            <strong>${cost.name}:</strong> ${fmtEUR(cost.amount)} por aplicación<br>
            <strong>Meses:</strong> ${monthsText}<br>
            <strong>Total anual:</strong> ${fmtEUR(totalAnual)}
          </div>
        `;
      });
    }
    
    htmlContent += `
          <div class="footer">
            <p>Generado por Finarí - Tu plan maestro de finanzas personales</p>
          </div>
        </body>
      </html>
    `;
    
    // Create a new window with the HTML content for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Trigger print dialog
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
    
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    alert('Error al generar el PDF');
  }
}

// Utility function to download files
function downloadFile(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up the URL object
  setTimeout(() => URL.revokeObjectURL(url), 100);
}