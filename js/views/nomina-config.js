/**
 * Enhanced Spanish Payroll System - Configuration and Constants
 * This file contains configuration options and constants for the payroll system
 */

// Spanish payroll system constants
export const PAYROLL_CONSTANTS = {
  // Social Security rates (2024-2025)
  SOCIAL_SECURITY: {
    GENERAL_RATE: 0.0635, // 6.35%
    MAX_BASE_2024: 4495.50,
    MAX_BASE_2025: 4720.50
  },
  
  // Other contribution rates
  UNEMPLOYMENT_RATE: 0.0155, // 1.55%
  TRAINING_RATE: 0.001, // 0.10%
  
  // IRPF brackets for 2024-2025 (simplified)
  IRPF_BRACKETS_2024: [
    { min: 0, max: 12450, rate: 0.19 },
    { min: 12450, max: 20200, rate: 0.24 },
    { min: 20200, max: 35200, rate: 0.30 },
    { min: 35200, max: 60000, rate: 0.37 },
    { min: 60000, max: 300000, rate: 0.47 },
    { min: 300000, max: Infinity, rate: 0.47 }
  ],
  
  // Validation limits
  VALIDATION_LIMITS: {
    MIN_GROSS_ANNUAL: 0,
    MAX_GROSS_ANNUAL: 10000000,
    MIN_VARIABLE_PERCENT: 0,
    MAX_VARIABLE_PERCENT: 100,
    MIN_BONUS_PERCENT: 0,
    MAX_BONUS_PERCENT: 15,
    MIN_IRPF_MANUAL: 0,
    MAX_IRPF_MANUAL: 50,
    MIN_FLEXIPLAN: 0,
    MAX_FLEXIPLAN: 1000,
    MIN_PAY_DAY: 1,
    MAX_PAY_DAY: 31
  },
  
  // Months excluded from Flexiplan
  FLEXIPLAN_EXCLUDED_MONTHS: [7, 8], // July and August
  
  // Default configuration
  DEFAULT_CONFIG: {
    numPayments: 14,
    extraPayMonths: [7, 12], // July and December
    variableMonths: [7, 12],
    variableDistribution: { month1: 40, month2: 60 },
    bonusMonth: 4, // April
    payDay: 25,
    flexiplanAmount: 15
  }
};

// Month names in Spanish
export const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// Error messages
export const ERROR_MESSAGES = {
  INVALID_INPUT: 'Valor inválido introducido',
  CALCULATION_ERROR: 'Error en el cálculo',
  SAVE_ERROR: 'Error al guardar los datos',
  EXPORT_ERROR: 'Error al exportar los datos'
};

// Success messages
export const SUCCESS_MESSAGES = {
  SAVED: '✅ Datos guardados correctamente',
  EXPORTED: '✅ Datos exportados exitosamente',
  FORECAST_GENERATED: '📊 Previsión generada correctamente'
};