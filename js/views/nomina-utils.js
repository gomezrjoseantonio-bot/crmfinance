/**
 * Enhanced Spanish Payroll System - Calculation Utilities
 * This module contains utility functions for payroll calculations
 */

import { PAYROLL_CONSTANTS } from './nomina-config.js';

// Enhanced input validation with descriptive error handling
export function validateInput(value, min = 0, max = Infinity, defaultValue = 0, fieldName = 'campo') {
  const num = parseFloat(value);
  if (isNaN(num)) {
    console.warn(`Valor no numérico en ${fieldName}: ${value}. Usando valor por defecto: ${defaultValue}`);
    return defaultValue;
  }
  if (num < min) {
    console.warn(`Valor ${num} menor que el mínimo ${min} en ${fieldName}. Usando mínimo.`);
    return min;
  }
  if (num > max) {
    console.warn(`Valor ${num} mayor que el máximo ${max} en ${fieldName}. Usando máximo.`);
    return max;
  }
  return Number(num.toFixed(2));
}

// Calculate IRPF using progressive tax brackets
export function calculateIRPF(taxableIncome, brackets = PAYROLL_CONSTANTS.IRPF_BRACKETS_2024) {
  let totalTax = 0;
  let taxDetails = [];
  
  for (const bracket of brackets) {
    if (taxableIncome > bracket.min) {
      const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
      const taxInBracket = taxableInBracket * bracket.rate;
      totalTax += taxInBracket;
      
      if (taxableInBracket > 0) {
        taxDetails.push({
          range: `${bracket.min} - ${bracket.max === Infinity ? '∞' : bracket.max}`,
          taxableAmount: taxableInBracket,
          rate: bracket.rate,
          tax: taxInBracket
        });
      }
    }
  }
  
  return {
    totalTax: Number(totalTax.toFixed(2)),
    effectiveRate: taxableIncome > 0 ? Number((totalTax / taxableIncome).toFixed(4)) : 0,
    details: taxDetails
  };
}

// Calculate Social Security contributions
export function calculateSocialSecurity(monthlyGross, ssMax, ssRate) {
  const ssBase = Math.min(monthlyGross, ssMax);
  return {
    base: Number(ssBase.toFixed(2)),
    contribution: Number((ssBase * ssRate).toFixed(2)),
    unemployment: Number((ssBase * PAYROLL_CONSTANTS.UNEMPLOYMENT_RATE).toFixed(2)),
    training: Number((ssBase * PAYROLL_CONSTANTS.TRAINING_RATE).toFixed(2))
  };
}

// Calculate variable payment for a specific month
export function calculateVariablePayment(salaryConfig, monthNum) {
  if (!salaryConfig.variableMonths?.includes(monthNum) || salaryConfig.variablePercent <= 0) {
    return 0;
  }
  
  const monthKey = salaryConfig.variableMonths.indexOf(monthNum);
  const variablePercent = monthKey === 0 ? 
    validateInput(salaryConfig.variableDistribution?.month1, 0, 200, 40, 'variable mes 1') : 
    validateInput(salaryConfig.variableDistribution?.month2, 0, 200, 60, 'variable mes 2');
  
  const totalVariable = salaryConfig.grossAnnual * salaryConfig.variablePercent / 100;
  return Number((totalVariable * (variablePercent / 100)).toFixed(2));
}

// Calculate bonus payment for a specific month
export function calculateBonusPayment(salaryConfig, monthNum) {
  if (monthNum !== salaryConfig.bonusMonth || salaryConfig.bonusPercent <= 0) {
    return 0;
  }
  
  return Number((salaryConfig.grossAnnual * salaryConfig.bonusPercent / 100).toFixed(2));
}

// Calculate extra payment for a specific month
export function calculateExtraPayment(salaryConfig, monthNum) {
  if (!salaryConfig.extraPayMonths?.includes(monthNum) || salaryConfig.numPayments !== 14) {
    return 0;
  }
  
  const monthlyBase = salaryConfig.grossAnnual / salaryConfig.numPayments;
  return Number(monthlyBase.toFixed(2));
}

// Check if Flexiplan applies for a specific month
export function isFlexiplanMonth(monthNum) {
  return !PAYROLL_CONSTANTS.FLEXIPLAN_EXCLUDED_MONTHS.includes(monthNum);
}

// Calculate total monthly gross for a specific month
export function calculateMonthlyGross(salaryConfig, monthNum) {
  const monthlyBase = salaryConfig.grossAnnual / salaryConfig.numPayments;
  const variable = calculateVariablePayment(salaryConfig, monthNum);
  const bonus = calculateBonusPayment(salaryConfig, monthNum);
  const extraPay = calculateExtraPayment(salaryConfig, monthNum);
  
  return {
    base: Number(monthlyBase.toFixed(2)),
    variable,
    bonus,
    extraPay,
    total: Number((monthlyBase + variable + bonus + extraPay).toFixed(2))
  };
}

// Performance monitoring for calculations
export function measureCalculationTime(calculationName, calculationFunction) {
  const startTime = performance.now();
  const result = calculationFunction();
  const endTime = performance.now();
  
  console.log(`${calculationName} took ${(endTime - startTime).toFixed(2)}ms`);
  return result;
}

// Batch validation for all salary configuration fields
export function validateSalaryConfig(config) {
  const limits = PAYROLL_CONSTANTS.VALIDATION_LIMITS;
  
  const validated = {
    grossAnnual: validateInput(config.grossAnnual, limits.MIN_GROSS_ANNUAL, limits.MAX_GROSS_ANNUAL, 0, 'salario bruto anual'),
    variablePercent: validateInput(config.variablePercent, limits.MIN_VARIABLE_PERCENT, limits.MAX_VARIABLE_PERCENT, 0, 'porcentaje variable'),
    bonusPercent: validateInput(config.bonusPercent, limits.MIN_BONUS_PERCENT, limits.MAX_BONUS_PERCENT, 0, 'porcentaje bono'),
    manualIrpfRate: validateInput(config.manualIrpfRate, limits.MIN_IRPF_MANUAL, limits.MAX_IRPF_MANUAL, 0, 'IRPF manual'),
    payDay: validateInput(config.payDay, limits.MIN_PAY_DAY, limits.MAX_PAY_DAY, 25, 'día de pago'),
    solidarityFee: validateInput(config.solidarityFee, 0, 1000, 0, 'cuota solidaridad'),
    pensionPlan: validateInput(config.pensionPlan, 0, 10000, 0, 'plan pensiones'),
    flexiplanAmount: validateInput(config.socialBenefits?.flexiplan?.amount, limits.MIN_FLEXIPLAN, limits.MAX_FLEXIPLAN, 15, 'flexiplan')
  };
  
  // Validate month selections
  validated.numPayments = [12, 14].includes(config.numPayments) ? config.numPayments : 14;
  validated.bonusMonth = (config.bonusMonth >= 1 && config.bonusMonth <= 12) ? config.bonusMonth : 4;
  
  // Validate variable distribution
  validated.variableDistribution = {
    month1: validateInput(config.variableDistribution?.month1, 0, 200, 40, 'distribución variable mes 1'),
    month2: validateInput(config.variableDistribution?.month2, 0, 200, 60, 'distribución variable mes 2')
  };
  
  return validated;
}

// Generate summary statistics for payroll analysis
export function generatePayrollSummary(salaryData) {
  const summary = {
    totalGross: salaryData.totalEconomic,
    totalDeductions: salaryData.totalDeductions,
    totalNet: salaryData.netTotal,
    effectiveRate: salaryData.irpfRate,
    socialSecurityBurden: (salaryData.ssContribution + salaryData.unemploymentContribution + salaryData.trainingContribution) / salaryData.totalEconomic,
    netToGrossRatio: salaryData.netTotal / salaryData.totalEconomic,
    monthlyNetAverage: salaryData.netMonthly
  };
  
  return summary;
}