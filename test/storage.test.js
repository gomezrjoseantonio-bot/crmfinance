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
});