// Tests for storage.js
describe('Storage Functions', () => {
  
  // Mock localStorage for testing
  let mockStorage = {};
  const originalLocalStorage = window.localStorage;
  
  beforeEach(() => {
    mockStorage = {};
    window.localStorage = {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, value) => mockStorage[key] = value,
      removeItem: (key) => delete mockStorage[key],
      clear: () => mockStorage = {}
    };
  });

  afterEach(() => {
    window.localStorage = originalLocalStorage;
  });

  describe('Settings Functions', () => {
    it('should get default settings when none exist', () => {
      const settings = getSettings();
      assert.deepEqual(settings, {});
    });

    it('should save and retrieve settings', () => {
      const testSettings = { theme: 'dark', accent: '#ff0000' };
      setSettings(testSettings);
      
      const retrieved = getSettings();
      assert.equal(retrieved.theme, 'dark');
      assert.equal(retrieved.accent, '#ff0000');
    });

    it('should get and set year correctly', () => {
      const testYear = 2024;
      setYear(testYear);
      
      const retrieved = getYear();
      assert.equal(retrieved, testYear);
    });
  });

  describe('Categories Functions', () => {
    it('should save and retrieve categories', () => {
      const testCategories = [
        { id: 'test', name: 'Test Category', color: '#ff0000', type: 'expense' }
      ];
      saveCategories(testCategories);
      
      const retrieved = getCategories();
      assert.equal(retrieved.length, 1);
      assert.equal(retrieved[0].id, 'test');
      assert.equal(retrieved[0].name, 'Test Category');
    });

    it('should return empty array when no categories exist', () => {
      const categories = getCategories();
      assert.deepEqual(categories, []);
    });
  });

  describe('Accounts Functions', () => {
    it('should save and retrieve accounts', () => {
      const testAccounts = [
        { id: 'TEST', name: 'Test Bank', threshold: 500 }
      ];
      saveAccounts(testAccounts);
      
      const retrieved = getAccounts();
      assert.equal(retrieved.length, 1);
      assert.equal(retrieved[0].id, 'TEST');
      assert.equal(retrieved[0].threshold, 500);
    });
  });

  describe('Budget Functions', () => {
    it('should save and retrieve budgets', () => {
      const testBudgets = [
        { categoryId: 'food', monthlyLimit: 500, alertThreshold: 0.8 }
      ];
      saveBudgets(testBudgets);
      
      const retrieved = getBudgets();
      assert.equal(retrieved.length, 1);
      assert.equal(retrieved[0].categoryId, 'food');
      assert.equal(retrieved[0].monthlyLimit, 500);
    });
  });

  describe('Real Data Functions', () => {
    it('should save and retrieve transaction data', () => {
      const testData = [
        { date: '2025-01-01', bank: 'TEST', concept: 'Test Transaction', amount: 100, category: 'test' }
      ];
      saveReal(testData, 2025);
      
      const retrieved = getReal(2025);
      assert.equal(retrieved.length, 1);
      assert.equal(retrieved[0].concept, 'Test Transaction');
      assert.equal(retrieved[0].amount, 100);
    });

    it('should handle different years', () => {
      const data2024 = [{ date: '2024-01-01', amount: 100 }];
      const data2025 = [{ date: '2025-01-01', amount: 200 }];
      
      saveReal(data2024, 2024);
      saveReal(data2025, 2025);
      
      assert.equal(getReal(2024)[0].amount, 100);
      assert.equal(getReal(2025)[0].amount, 200);
    });
  });

  describe('Budget Alerts', () => {
    beforeEach(() => {
      // Set up test data
      const categories = [
        { id: 'food', name: 'Food', color: '#ff0000', type: 'expense' },
        { id: 'transport', name: 'Transport', color: '#00ff00', type: 'expense' }
      ];
      const budgets = [
        { categoryId: 'food', monthlyLimit: 500, alertThreshold: 0.8 },
        { categoryId: 'transport', monthlyLimit: 200, alertThreshold: 0.8 }
      ];
      const accounts = [
        { id: 'TEST', name: 'Test Bank', threshold: 1000 }
      ];
      
      saveCategories(categories);
      saveBudgets(budgets);
      saveAccounts(accounts);
    });

    it('should detect budget warnings', () => {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const transactions = [
        { date: `${currentMonth}-01`, bank: 'TEST', concept: 'Food', amount: -450, category: 'food' },
        { date: `${currentMonth}-02`, bank: 'TEST', concept: 'Transport', amount: -50, category: 'transport' }
      ];
      saveReal(transactions);
      
      const alerts = getBudgetAlerts();
      const foodAlert = alerts.find(a => a.categoryId === 'food');
      assert.ok(foodAlert, 'Should have food budget warning');
      assert.equal(foodAlert.type, 'budget_warning');
      assert.equal(foodAlert.level, 'warning');
    });

    it('should detect budget exceeded', () => {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const transactions = [
        { date: `${currentMonth}-01`, bank: 'TEST', concept: 'Food', amount: -600, category: 'food' }
      ];
      saveReal(transactions);
      
      const alerts = getBudgetAlerts();
      const foodAlert = alerts.find(a => a.categoryId === 'food');
      assert.ok(foodAlert, 'Should have food budget exceeded alert');
      assert.equal(foodAlert.type, 'budget_exceeded');
      assert.equal(foodAlert.level, 'danger');
    });

    it('should detect account threshold violations', () => {
      const transactions = [
        { date: '2025-01-01', bank: 'TEST', concept: 'Large Expense', amount: -2000 }
      ];
      saveReal(transactions);
      
      const alerts = getBudgetAlerts();
      const accountAlert = alerts.find(a => a.type === 'account_threshold');
      assert.ok(accountAlert, 'Should have account threshold alert');
      assert.equal(accountAlert.accountId, 'TEST');
    });
  });

  describe('Data Clearing Functions', () => {
    beforeEach(() => {
      // Set up test data for multiple years
      const testData2023 = [
        { date: '2023-01-01', bank: 'TEST', concept: 'Test 2023', amount: 100, category: 'test' }
      ];
      const testData2024 = [
        { date: '2024-01-01', bank: 'TEST', concept: 'Test 2024', amount: 200, category: 'test' }
      ];
      
      saveReal(testData2023, 2023);
      saveReal(testData2024, 2024);
      saveForecast([{ amount: 1000, date: '2024-01-01' }], 2024);
      savePMA({ budget: 10000 }, 2024);
      saveRecurrences([{ type: 'INCOME', concept: 'Salary', amount: 3000 }]);
      saveProperties([{ id: 1, name: 'Test Property' }], 2024);
      saveLoans([{ id: 1, amount: 50000 }], 2024);
    });

    it('should clear real transactions for specific year', () => {
      clearRealTransactions(2024);
      
      // 2024 should be cleared
      assert.deepEqual(getReal(2024), []);
      
      // 2023 should remain
      assert.equal(getReal(2023).length, 1);
      assert.equal(getReal(2023)[0].concept, 'Test 2023');
    });

    it('should clear all data for specific year', () => {
      clearDataForYear(2024);
      
      // All 2024 data should be cleared
      assert.deepEqual(getReal(2024), []);
      assert.deepEqual(getForecast(2024), []);
      assert.deepEqual(getPMA(2024), {});
      assert.deepEqual(getProperties(2024), []);
      assert.deepEqual(getLoans(2024), []);
      
      // 2023 should remain
      assert.equal(getReal(2023).length, 1);
      
      // Recurrences should remain (they're not year-specific)
      assert.equal(getRecurrences().length, 1);
    });

    it('should clear all income and expense data across all years', () => {
      clearAllIncomeExpenseData();
      
      // All data should be cleared
      assert.deepEqual(getReal(2023), []);
      assert.deepEqual(getReal(2024), []);
      assert.deepEqual(getForecast(2024), []);
      assert.deepEqual(getPMA(2024), {});
      assert.deepEqual(getRecurrences(), []);
      assert.deepEqual(getProperties(2024), []);
      assert.deepEqual(getLoans(2024), []);
    });

    it('should preserve configuration data when clearing', () => {
      // Add some configuration
      const testAccounts = [{ id: 'TEST', name: 'Test Bank' }];
      const testCategories = [{ id: 'test', name: 'Test Category' }];
      const testBudgets = [{ categoryId: 'test', monthlyLimit: 500 }];
      
      saveAccounts(testAccounts);
      saveCategories(testCategories);
      saveBudgets(testBudgets);
      
      // Clear all data
      clearAllIncomeExpenseData();
      
      // Configuration should be preserved
      assert.deepEqual(getAccounts(), testAccounts);
      assert.deepEqual(getCategories(), testCategories);
      assert.deepEqual(getBudgets(), testBudgets);
    });
  });
});