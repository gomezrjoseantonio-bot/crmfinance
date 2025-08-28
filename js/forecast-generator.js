import { getPMA, getRecurrences, saveForecast, getTaxTables, getProperties } from './storage.js';
import { calculateNetSalary, addMonths, getLastDayOfMonth, fmtDateISO } from './utils.js';

export function generateForecast(year, fromMonth = 1) {
  try {
    const pma = getPMA(year);
    const recurrences = getRecurrences();
    const properties = getProperties(year);
    const taxTables = getTaxTables();
    const forecast = [];
    
    console.log('Generating forecast for year', year, 'from month', fromMonth);
    console.log('PMA data:', pma);
    
    // Generate salary movements with minimal logic
    if (pma.salary && pma.salary.grossAnnual > 0) {
      try {
        console.log('Salary config:', pma.salary);
        const netMonthlySalary = calculateNetSalary(pma.salary.grossAnnual, taxTables);
        console.log('Net monthly salary:', netMonthlySalary);
        
        for (let month = fromMonth; month <= 12; month++) {
          console.log('Processing month:', month);
          
          // Simple date calculation
          const payDate = `${year}-${String(month).padStart(2, '0')}-25`;
          
          forecast.push({
            date: payDate,
            accountId: pma.salary.accountId || 'SANTANDER',
            concept: 'Nómina',
            amount: netMonthlySalary,
            category: 'SALARIO',
            source: 'PMA_SALARY'
          });
        }
      } catch (salaryError) {
        console.error('Error generating salary movements:', salaryError);
      }
    }
    
    // Sort by date
    forecast.sort((a, b) => a.date.localeCompare(b.date));
    
    // Save forecast
    saveForecast(forecast, year);
    
    console.log(`Generated ${forecast.length} forecast movements`);
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