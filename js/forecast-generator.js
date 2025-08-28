import { getPMA, getRecurrences, saveForecast, getTaxTables, getProperties } from './storage.js';
import { calculateNetSalary, addMonths, getLastDayOfMonth, fmtDateISO } from './utils.js';

// Enhanced monthly salary calculation that matches nomina view logic
function calculateMonthlyNetSalary(salaryConfig, taxTables, monthNum) {
  try {
    // Validate inputs
    const validateInput = (value, min = 0, max = Infinity, defaultValue = 0) => {
      const num = parseFloat(value);
      if (isNaN(num) || num < min || num > max) return defaultValue;
      return Number(num.toFixed(2));
    };

    const grossAnnual = validateInput(salaryConfig.grossAnnual, 0, 10000000, 0);
    const monthlyBase = Number((grossAnnual / (salaryConfig.numPayments || 14)).toFixed(2));
    
    // Check if this month has special payments
    const isExtraPayMonth = salaryConfig.extraPayMonths && salaryConfig.extraPayMonths.includes(monthNum);
    const isVariableMonth = salaryConfig.variableMonths && salaryConfig.variableMonths.includes(monthNum);
    const isBonusMonth = salaryConfig.bonusMonth === monthNum;
    const isFlexiplanMonth = !(salaryConfig.socialBenefits?.flexiplan?.excludeMonths || [7, 8]).includes(monthNum);
    
    let salaryBase = monthlyBase;
    let variable = 0;
    let bonus = 0;
    let extraPay = 0;
    
    // Calculate extra pay
    if (isExtraPayMonth && salaryConfig.numPayments === 14) {
      extraPay = monthlyBase;
    }
    
    // Calculate variable pay
    if (isVariableMonth && salaryConfig.variablePercent > 0) {
      const monthKey = salaryConfig.variableMonths.indexOf(monthNum);
      const variablePercent = monthKey === 0 ? 
        validateInput(salaryConfig.variableDistribution?.month1, 0, 200, 40) : 
        validateInput(salaryConfig.variableDistribution?.month2, 0, 200, 60);
      variable = Number(((salaryConfig.grossAnnual * salaryConfig.variablePercent / 100) * (variablePercent / 100)).toFixed(2));
    }
    
    // Calculate bonus
    if (isBonusMonth && salaryConfig.bonusPercent > 0) {
      bonus = Number((salaryConfig.grossAnnual * salaryConfig.bonusPercent / 100).toFixed(2));
    }
    
    const monthlyGross = Number((salaryBase + variable + bonus + extraPay).toFixed(2));
    
    // Calculate monthly deductions
    const flexiplanDeduction = isFlexiplanMonth ? validateInput(salaryConfig.socialBenefits?.flexiplan?.amount, 0, 1000, 0) : 0;
    const grossBeforeFlexiplan = Number((monthlyGross - flexiplanDeduction).toFixed(2));
    
    // Social Security contributions
    const ssBaseMonthly = Math.min(grossBeforeFlexiplan, taxTables.ss.max);
    const ssContribution = Number((ssBaseMonthly * taxTables.ss.rate).toFixed(2));
    const unemploymentContribution = Number((ssBaseMonthly * 0.0155).toFixed(2));
    const trainingContribution = Number((ssBaseMonthly * 0.001).toFixed(2));
    
    // Calculate monthly taxable income
    const monthlyTaxableIncome = Number((grossBeforeFlexiplan - ssContribution - unemploymentContribution - trainingContribution).toFixed(2));
    
    // IRPF calculation - simplified for forecast
    let irpfContribution = 0;
    const manualIrpfRate = validateInput(salaryConfig.manualIrpfRate, 0, 50, 0);
    if (manualIrpfRate > 0) {
      irpfContribution = Number((monthlyTaxableIncome * (manualIrpfRate / 100)).toFixed(2));
    } else {
      // Use approximate annual effective rate for monthly calculation
      const annualGross = salaryConfig.grossAnnual || 90646;
      let annualIrpfContribution = 0;
      let remainingIncome = annualGross;
      
      for (const bracket of taxTables.irpf) {
        if (remainingIncome > bracket.min) {
          const taxableInBracket = Math.min(remainingIncome, bracket.max) - bracket.min;
          annualIrpfContribution += taxableInBracket * bracket.rate;
          remainingIncome -= taxableInBracket;
        }
      }
      
      // Calculate effective rate and apply to monthly income
      const effectiveRate = annualIrpfContribution / annualGross;
      irpfContribution = Number((monthlyTaxableIncome * effectiveRate).toFixed(2));
    }
    
    // Other deductions
    const solidarityFee = validateInput(salaryConfig.solidarityFee, 0, 1000, 0);
    const pensionPlan = validateInput(salaryConfig.pensionPlan, 0, 10000, 0);
    
    const monthlyDeductions = Number((ssContribution + unemploymentContribution + trainingContribution + 
                                     irpfContribution + solidarityFee + pensionPlan + flexiplanDeduction).toFixed(2));
    const monthlyNet = Number((monthlyGross - monthlyDeductions).toFixed(2));
    
    return {
      monthlyNet,
      monthlyGross,
      monthlyDeductions,
      isExtraPayMonth,
      isVariableMonth,
      isBonusMonth
    };
  } catch (error) {
    console.error(`Error calculating monthly salary for month ${monthNum}:`, error);
    return { monthlyNet: 0, monthlyGross: 0, monthlyDeductions: 0, isExtraPayMonth: false, isVariableMonth: false, isBonusMonth: false };
  }
}

export function generateForecast(year, fromMonth = 1) {
  try {
    const pma = getPMA(year);
    const recurrences = getRecurrences();
    const properties = getProperties(year);
    const taxTables = getTaxTables();
    const forecast = [];
    
    console.log('Generating forecast for year', year, 'from month', fromMonth);
    console.log('PMA data:', pma);
    console.log('Recurrences:', recurrences);
    console.log('Properties:', properties);
    
    // Generate salary movements with proper detailed monthly logic
    if (pma.salary && pma.salary.grossAnnual > 0) {
      try {
        console.log('Salary config:', pma.salary);
        
        for (let month = fromMonth; month <= 12; month++) {
          console.log('Processing salary for month:', month);
          
          // Calculate detailed monthly amounts using the same logic as nomina view
          const monthlyDetails = calculateMonthlyNetSalary(pma.salary, taxTables, month);
          console.log(`Month ${month} detailed calculation:`, monthlyDetails);
          
          if (!monthlyDetails || monthlyDetails.monthlyNet === 0) {
            console.error(`Failed to calculate monthly details for month ${month}`);
            continue;
          }
          
          const payDate = calculatePayDate(year, month, pma.salary.payDay || 25);
          
          forecast.push({
            date: payDate,
            accountId: pma.salary.accountId || 'SANTANDER',
            concept: monthlyDetails.isExtraPayMonth ? 'Nómina + Paga extra' : 'Nómina',
            amount: monthlyDetails.monthlyNet,
            category: 'SALARIO',
            source: 'PMA_SALARY'
          });
        }
      } catch (salaryError) {
        console.error('Error generating salary movements:', salaryError);
      }
    }
    
    // Generate recurrence movements
    console.log('Processing recurrences...');
    recurrences.forEach(recurrence => {
      try {
        const movements = expandRecurrence(recurrence, year, fromMonth);
        console.log(`Generated ${movements.length} movements for recurrence:`, recurrence.concept);
        forecast.push(...movements);
      } catch (recError) {
        console.error('Error expanding recurrence:', recurrence, recError);
      }
    });
    
    // Generate property movements (rental income, mortgages, operating costs)
    console.log('Processing properties...');
    properties.forEach(property => {
      try {
        const movements = expandPropertyMovements(property, year, fromMonth);
        console.log(`Generated ${movements.length} movements for property:`, property.address || property.id);
        forecast.push(...movements);
      } catch (propError) {
        console.error('Error expanding property movements:', property, propError);
      }
    });
    
    // Sort by date
    forecast.sort((a, b) => a.date.localeCompare(b.date));
    
    // Save forecast
    saveForecast(forecast, year);
    
    console.log(`Generated ${forecast.length} total forecast movements`);
    return forecast;
  } catch (error) {
    console.error('Error in generateForecast:', error);
    return [];
  }
}

function calculatePayDate(year, month, payDay) {
  // Handle "last" day of month
  if (payDay === 'last' || payDay > 28) {
    const lastDay = getLastDayOfMonth(year, month);
    const actualDay = payDay === 'last' ? lastDay : Math.min(payDay, lastDay);
    return fmtDateISO(new Date(year, month - 1, actualDay));
  }
  
  return fmtDateISO(new Date(year, month - 1, payDay));
}

function expandRecurrence(recurrence, year, fromMonth) {
  const movements = [];
  const startDate = recurrence.startDate ? new Date(recurrence.startDate) : new Date(year, 0, 1);
  const endDate = recurrence.endDate ? new Date(recurrence.endDate) : new Date(year, 11, 31);
  
  // Skip if recurrence doesn't apply to this year
  if (startDate.getFullYear() > year || endDate.getFullYear() < year) {
    return movements;
  }
  
  switch (recurrence.frequency) {
    case 'MENSUAL':
      for (let month = fromMonth; month <= 12; month++) {
        const date = calculateRecurrenceDate(year, month, recurrence.day);
        if (isDateInRange(date, startDate, endDate)) {
          movements.push(createMovementFromRecurrence(recurrence, date));
        }
      }
      break;
      
    case 'BIMESTRAL':
      for (let month = recurrence.anchorMonth || 1; month <= 12; month += 2) {
        if (month >= fromMonth) {
          const date = calculateRecurrenceDate(year, month, recurrence.day);
          if (isDateInRange(date, startDate, endDate)) {
            movements.push(createMovementFromRecurrence(recurrence, date));
          }
        }
      }
      break;
      
    case 'TRIMESTRAL':
      for (let month = recurrence.anchorMonth || 1; month <= 12; month += 3) {
        if (month >= fromMonth) {
          const date = calculateRecurrenceDate(year, month, recurrence.day);
          if (isDateInRange(date, startDate, endDate)) {
            movements.push(createMovementFromRecurrence(recurrence, date));
          }
        }
      }
      break;
      
    case 'SEMESTRAL':
      for (let month = recurrence.anchorMonth || 1; month <= 12; month += 6) {
        if (month >= fromMonth) {
          const date = calculateRecurrenceDate(year, month, recurrence.day);
          if (isDateInRange(date, startDate, endDate)) {
            movements.push(createMovementFromRecurrence(recurrence, date));
          }
        }
      }
      break;
      
    case 'ANUAL':
      const month = recurrence.anchorMonth || 1;
      if (month >= fromMonth) {
        const date = calculateRecurrenceDate(year, month, recurrence.day);
        if (isDateInRange(date, startDate, endDate)) {
          movements.push(createMovementFromRecurrence(recurrence, date));
        }
      }
      break;
      
    case 'SEMANAL':
      // Generate weekly from first occurrence in fromMonth
      let weeklyDate = new Date(year, fromMonth - 1, 1);
      while (weeklyDate.getFullYear() === year) {
        if (weeklyDate.getMonth() + 1 >= fromMonth && isDateInRange(weeklyDate, startDate, endDate)) {
          movements.push(createMovementFromRecurrence(recurrence, fmtDateISO(weeklyDate)));
        }
        weeklyDate.setDate(weeklyDate.getDate() + 7);
      }
      break;
      
    case 'QUINCENAL':
      // Generate bi-weekly from first occurrence in fromMonth
      let biWeeklyDate = new Date(year, fromMonth - 1, 1);
      while (biWeeklyDate.getFullYear() === year) {
        if (biWeeklyDate.getMonth() + 1 >= fromMonth && isDateInRange(biWeeklyDate, startDate, endDate)) {
          movements.push(createMovementFromRecurrence(recurrence, fmtDateISO(biWeeklyDate)));
        }
        biWeeklyDate.setDate(biWeeklyDate.getDate() + 14);
      }
      break;
  }
  
  return movements;
}

function calculateRecurrenceDate(year, month, day) {
  if (day === 'last') {
    const lastDay = getLastDayOfMonth(year, month);
    return fmtDateISO(new Date(year, month - 1, lastDay));
  }
  
  const actualDay = Math.min(day, getLastDayOfMonth(year, month));
  return fmtDateISO(new Date(year, month - 1, actualDay));
}

function isDateInRange(date, startDate, endDate) {
  const checkDate = typeof date === 'string' ? new Date(date) : date;
  return checkDate >= startDate && checkDate <= endDate;
}

function createMovementFromRecurrence(recurrence, date) {
  return {
    date,
    accountId: recurrence.accountId,
    concept: recurrence.concept,
    amount: recurrence.amount,
    category: recurrence.category,
    subcategory: recurrence.subcategory,
    source: 'RECURRENCE',
    recurrenceId: recurrence.id,
    notes: recurrence.notes
  };
}

function expandPropertyMovements(property, year, fromMonth) {
  const movements = [];
  
  // Generate rental income
  if (property.monthlyRent && property.monthlyRent > 0) {
    const yearlyRentals = property.yearlyRentals || {};
    const yearData = yearlyRentals[year] || {
      monthlyRent: property.monthlyRent,
      bank: property.rentalBank || '',
      startMonth: 1,
      endMonth: 12,
      adjustments: {}
    };
    
    const startMonth = Math.max(yearData.startMonth || 1, fromMonth);
    const endMonth = yearData.endMonth || 12;
    
    for (let month = startMonth; month <= endMonth; month++) {
      const monthlyAmount = yearData.adjustments[month] ? 
        parseFloat(yearData.adjustments[month]) : 
        yearData.monthlyRent;
      
      if (monthlyAmount > 0) {
        const rentalDate = fmtDateISO(new Date(year, month - 1, 5)); // 5th of each month
        
        movements.push({
          date: rentalDate,
          accountId: yearData.bank || property.rentalBank || 'SANTANDER',
          concept: `Alquiler - ${property.address || property.id}`,
          amount: monthlyAmount,
          category: 'ALQUILER',
          source: 'PROPERTY_RENTAL',
          propertyId: property.id
        });
      }
    }
  }
  
  // Generate mortgage payments (monthly expenses)
  const financing = property.financing || {};
  if (financing.mortgage && financing.mortgage.payment > 0) {
    for (let month = fromMonth; month <= 12; month++) {
      const mortgageDate = fmtDateISO(new Date(year, month - 1, financing.mortgage.day || 1));
      
      movements.push({
        date: mortgageDate,
        accountId: financing.mortgage.bank || 'SANTANDER',
        concept: `Hipoteca - ${property.address || property.id}`,
        amount: -Math.abs(financing.mortgage.payment),
        category: 'HIPOTECA',
        source: 'PROPERTY_MORTGAGE',
        propertyId: property.id
      });
    }
  }
  
  // Generate other loan payments
  if (financing.loans && financing.loans.payment > 0) {
    for (let month = fromMonth; month <= 12; month++) {
      const loanDate = fmtDateISO(new Date(year, month - 1, financing.loans.day || 15));
      
      movements.push({
        date: loanDate,
        accountId: financing.loans.bank || 'SANTANDER',
        concept: `Préstamo inmueble - ${property.address || property.id}`,
        amount: -Math.abs(financing.loans.payment),
        category: 'PRESTAMO_INMUEBLE',
        source: 'PROPERTY_LOAN',
        propertyId: property.id
      });
    }
  }
  
  // Generate operating costs (monthly expenses)
  const operatingCosts = property.operatingCosts || {};
  Object.entries(operatingCosts).forEach(([costId, costConfig]) => {
    if (costConfig.applies && costConfig.amount > 0) {
      const applicableMonths = costConfig.months || [1,2,3,4,5,6,7,8,9,10,11,12];
      
      applicableMonths.forEach(month => {
        if (month >= fromMonth) {
          const costDate = fmtDateISO(new Date(year, month - 1, costConfig.day || 10));
          
          movements.push({
            date: costDate,
            accountId: costConfig.bank || 'SANTANDER',
            concept: `${costConfig.label || costId} - ${property.address || property.id}`,
            amount: -Math.abs(costConfig.amount),
            category: 'GASTOS_INMUEBLE',
            source: 'PROPERTY_OPERATING_COST',
            propertyId: property.id,
            costType: costId
          });
        }
      });
    }
  });
  
  return movements;
}