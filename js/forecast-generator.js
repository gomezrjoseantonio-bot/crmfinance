import { getPMA, getRecurrences, saveForecast, getTaxTables } from './storage.js';
import { calculateNetSalary, addMonths, getLastDayOfMonth, fmtDateISO } from './utils.js';

export function generateForecast(year, fromMonth = 1) {
  const pma = getPMA(year);
  const recurrences = getRecurrences();
  const taxTables = getTaxTables();
  const forecast = [];
  
  console.log('Generating forecast for year', year, 'from month', fromMonth);
  
  // Generate salary movements
  if (pma.salary && pma.salary.grossAnnual > 0) {
    const netMonthlySalary = calculateNetSalary(pma.salary.grossAnnual, taxTables);
    
    for (let month = fromMonth; month <= 12; month++) {
      const isExtraPayMonth = pma.salary.extraPayMonths.includes(month);
      const payAmount = isExtraPayMonth ? netMonthlySalary * 2 : netMonthlySalary;
      
      // Add variable amount if specified
      const variableAmount = pma.salary.variableByMonth[month] || 0;
      
      const payDate = calculatePayDate(year, month, pma.salary.payDay);
      
      forecast.push({
        date: payDate,
        accountId: pma.salary.accountId,
        concept: isExtraPayMonth ? 'Nómina + Paga extra' : 'Nómina',
        amount: payAmount + variableAmount,
        category: 'SALARIO',
        source: 'PMA_SALARY'
      });
    }
  }
  
  // Generate recurrence movements
  recurrences.forEach(recurrence => {
    const movements = expandRecurrence(recurrence, year, fromMonth);
    forecast.push(...movements);
  });
  
  // Sort by date
  forecast.sort((a, b) => a.date.localeCompare(b.date));
  
  // Save forecast
  saveForecast(forecast, year);
  
  console.log(`Generated ${forecast.length} forecast movements`);
  return forecast;
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