// Enhanced error handling and validation utilities

// Enhanced error handling wrapper
export function withErrorHandling(fn, errorMessage = 'Ha ocurrido un error') {
  return async function(...args) {
    try {
      showLoadingState(true);
      const result = await fn.apply(this, args);
      showLoadingState(false);
      return result;
    } catch (error) {
      showLoadingState(false);
      console.error('Error:', error);
      showNotification(errorMessage + ': ' + error.message, 'error');
      throw error;
    }
  };
}

// Data validation functions
export function validateRequired(value, fieldName) {
  if (!value || value.toString().trim() === '') {
    throw new Error(`${fieldName} es obligatorio`);
  }
  return value.toString().trim();
}

export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('El formato del email no es válido');
  }
  return email;
}

export function validateNumeric(value, fieldName, min = null, max = null) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error(`${fieldName} debe ser un número válido`);
  }
  if (min !== null && num < min) {
    throw new Error(`${fieldName} debe ser mayor o igual a ${min}`);
  }
  if (max !== null && num > max) {
    throw new Error(`${fieldName} debe ser menor o igual a ${max}`);
  }
  return num;
}

export function validateLength(value, fieldName, minLength = null, maxLength = null) {
  const str = value.toString();
  if (minLength !== null && str.length < minLength) {
    throw new Error(`${fieldName} debe tener al menos ${minLength} caracteres`);
  }
  if (maxLength !== null && str.length > maxLength) {
    throw new Error(`${fieldName} no puede tener más de ${maxLength} caracteres`);
  }
  return str;
}

export function validateHexColor(color) {
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  if (!hexRegex.test(color)) {
    throw new Error('El color debe estar en formato hexadecimal (#RRGGBB)');
  }
  return color;
}

export function validateArray(arr, fieldName, minItems = null) {
  if (!Array.isArray(arr)) {
    throw new Error(`${fieldName} debe ser una lista válida`);
  }
  if (minItems !== null && arr.length < minItems) {
    throw new Error(`${fieldName} debe tener al menos ${minItems} elementos`);
  }
  return arr;
}

// Enhanced confirmation dialogs
export function confirmAction(message, destructive = false) {
  const action = destructive ? 'eliminar' : 'realizar esta acción';
  const fullMessage = `${message}\n\n¿Estás seguro de que quieres ${action}?`;
  
  if (destructive) {
    const confirmation = confirm(fullMessage + '\n\nEsta acción no se puede deshacer.');
    if (confirmation) {
      // Double confirmation for destructive actions
      const doubleConfirm = confirm('¿Estás completamente seguro? Esta acción es irreversible.');
      return doubleConfirm;
    }
    return false;
  }
  
  return confirm(fullMessage);
}

// Loading state management
let loadingCount = 0;

export function showLoadingState(show) {
  if (show) {
    loadingCount++;
  } else {
    loadingCount = Math.max(0, loadingCount - 1);
  }
  
  // Update UI loading state
  const elements = document.querySelectorAll('.loading-target, button, input, select');
  elements.forEach(el => {
    if (loadingCount > 0) {
      el.classList.add('loading');
      if (el.tagName === 'BUTTON') {
        el.disabled = true;
      }
    } else {
      el.classList.remove('loading');
      if (el.tagName === 'BUTTON') {
        el.disabled = false;
      }
    }
  });
  
  // Show/hide global loading indicator
  let loadingIndicator = document.querySelector('#global-loading');
  if (!loadingIndicator) {
    loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'global-loading';
    loadingIndicator.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
        <div>Procesando...</div>
      </div>
    `;
    document.body.appendChild(loadingIndicator);
  }
  
  loadingIndicator.style.display = loadingCount > 0 ? 'flex' : 'none';
}

// Notification system
export function showNotification(message, type = 'info', duration = 5000) {
  // Remove existing notifications of same type
  const existing = document.querySelectorAll(`.notification.${type}`);
  existing.forEach(el => el.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${icons[type] || icons.info}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
    </div>
  `;
  
  // Position at top-right
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    max-width: 400px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideInRight 0.3s ease-out;
    margin-bottom: 10px;
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
      }
    }, duration);
  }
}

// Enhanced data integrity validation
export function validatePropertyData(property) {
  validateRequired(property.address, 'Dirección');
  validateLength(property.address, 'Dirección', 5, 200);
  
  if (!['complete', 'rooms'].includes(property.type)) {
    throw new Error('Tipo de alquiler no válido');
  }
  
  if (property.type === 'complete') {
    validateNumeric(property.rent, 'Renta', 0, 10000);
  } else if (property.type === 'rooms') {
    validateArray(property.rooms, 'Habitaciones', 1);
    property.rooms.forEach((room, index) => {
      validateRequired(room.name, `Nombre de habitación ${index + 1}`);
      validateNumeric(room.rent, `Renta de habitación ${index + 1}`, 0, 5000);
    });
  }
  
  return property;
}

export function validateOperatingCostData(cost) {
  validateRequired(cost.name, 'Nombre del coste');
  validateLength(cost.name, 'Nombre del coste', 2, 100);
  validateNumeric(cost.amount, 'Importe', 0, 50000);
  validateArray(cost.months, 'Meses', 1);
  
  // Validate months are between 1-12
  cost.months.forEach(month => {
    if (month < 1 || month > 12) {
      throw new Error('Los meses deben estar entre 1 y 12');
    }
  });
  
  return cost;
}

// Backup and restore functionality
export function createBackup() {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      settings: JSON.parse(localStorage.getItem('fp-settings') || '{}'),
      accounts: JSON.parse(localStorage.getItem('fp-accounts') || '[]'),
      properties: JSON.parse(localStorage.getItem('fp-properties') || '[]'),
      operatingCosts: JSON.parse(localStorage.getItem('fp-operating-costs') || '[]'),
      realData: {}
    };
    
    // Get real data for all years
    const year = new Date().getFullYear();
    for (let y = year - 2; y <= year + 1; y++) {
      const key = `fp-real-${y}`;
      const yearData = localStorage.getItem(key);
      if (yearData) {
        data.realData[y] = JSON.parse(yearData);
      }
    }
    
    const backup = JSON.stringify(data, null, 2);
    const blob = new Blob([backup], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `finari-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    showNotification('Backup creado correctamente', 'success');
    
  } catch (error) {
    console.error('Error creating backup:', error);
    showNotification('Error al crear el backup', 'error');
  }
}

// Search and filter utilities
export function createSearchFilter(items, searchTerm, searchFields) {
  if (!searchTerm || searchTerm.trim() === '') {
    return items;
  }
  
  const term = searchTerm.toLowerCase().trim();
  return items.filter(item => {
    return searchFields.some(field => {
      const value = getNestedValue(item, field);
      return value && value.toString().toLowerCase().includes(term);
    });
  });
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, p) => o && o[p], obj);
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}