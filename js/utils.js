export const EUR = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2});
export function fmtEUR(n){ return EUR.format(+n||0).replace('\u00a0',' '); }
export function fmtDateISO(d){ const y=d.getFullYear(),m=('0'+(d.getMonth()+1)).slice(-2),da=('0'+d.getDate()).slice(-2); return `${y}-${m}-${da}`; }
export function parseEuro(str){
  if(typeof str==='number') return str;
  if(!str) return 0;
  // acepta "1.234,56" o "1234.56"
  let s=(''+str).trim().replace(/\s|EUR|€/gi,'');
  if(/,\d{2}$/.test(s)){ s=s.replace(/\./g,'').replace(',','.'); }
  return parseFloat(s)||0;
}
export function groupBy(arr, key){
  return arr.reduce((m,it)=>{ const k=typeof key==='function'? key(it): it[key]; (m[k]||(m[k]=[])).push(it); return m; },{});
}

// Nuevas funciones de utilidad para manejo de errores y UX
export function showMessage(message, type = 'info') {
  // Crear elemento de notificación
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Estilos inline para la notificación
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 16px',
    borderRadius: '8px',
    color: 'white',
    fontWeight: '500',
    zIndex: '9999',
    maxWidth: '400px',
    opacity: '0',
    transform: 'translateX(100%)',
    transition: 'all 0.3s ease'
  });

  // Colores según el tipo
  if (type === 'error') {
    notification.style.backgroundColor = '#dc2626';
  } else if (type === 'success') {
    notification.style.backgroundColor = '#059669';
  } else if (type === 'warning') {
    notification.style.backgroundColor = '#d97706';
  } else {
    notification.style.backgroundColor = '#2563eb';
  }

  document.body.appendChild(notification);

  // Animación de entrada
  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
  }, 10);

  // Remover después de 5 segundos
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

export function showError(message) {
  showMessage(message, 'error');
}

export function showSuccess(message) {
  showMessage(message, 'success');
}

export function showWarning(message) {
  showMessage(message, 'warning');
}

export function confirmAction(message, callback) {
  if (confirm(message)) {
    try {
      callback();
    } catch (error) {
      showError(`Error: ${error.message}`);
    }
  }
}

export function validateRequired(value, fieldName) {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName} es requerido`);
  }
  return true;
}

export function validateNumber(value, fieldName, min, max) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error(`${fieldName} debe ser un número válido`);
  }
  if (min !== undefined && num < min) {
    throw new Error(`${fieldName} debe ser mayor o igual a ${min}`);
  }
  if (max !== undefined && num > max) {
    throw new Error(`${fieldName} debe ser menor o igual a ${max}`);
  }
  return num;
}
