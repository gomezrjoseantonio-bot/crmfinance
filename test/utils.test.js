// Tests for utils.js
describe('Utils Functions', () => {
  
  describe('fmtEUR', () => {
    it('should format positive numbers correctly', () => {
      const result = fmtEUR(1234.56);
      assert.equal(result, '1.234,56 €');
    });

    it('should format negative numbers correctly', () => {
      const result = fmtEUR(-1234.56);
      assert.equal(result, '-1.234,56 €');
    });

    it('should format zero correctly', () => {
      const result = fmtEUR(0);
      assert.equal(result, '0,00 €');
    });

    it('should handle null/undefined values', () => {
      assert.equal(fmtEUR(null), '0,00 €');
      assert.equal(fmtEUR(undefined), '0,00 €');
    });
  });

  describe('parseEuro', () => {
    it('should parse Spanish format correctly', () => {
      assert.equal(parseEuro('1.234,56'), 1234.56);
      assert.equal(parseEuro('1234,56'), 1234.56);
    });

    it('should parse English format correctly', () => {
      assert.equal(parseEuro('1234.56'), 1234.56);
    });

    it('should handle currency symbols', () => {
      assert.equal(parseEuro('1.234,56 €'), 1234.56);
      assert.equal(parseEuro('€ 1234.56'), 1234.56);
      assert.equal(parseEuro('1234.56 EUR'), 1234.56);
    });

    it('should handle invalid input', () => {
      assert.equal(parseEuro('invalid'), 0);
      assert.equal(parseEuro(''), 0);
      assert.equal(parseEuro(null), 0);
    });

    it('should handle numeric input', () => {
      assert.equal(parseEuro(1234.56), 1234.56);
    });
  });

  describe('groupBy', () => {
    it('should group array by property', () => {
      const data = [
        { type: 'A', value: 1 },
        { type: 'B', value: 2 },
        { type: 'A', value: 3 }
      ];
      const result = groupBy(data, 'type');
      
      assert.equal(Object.keys(result).length, 2);
      assert.equal(result.A.length, 2);
      assert.equal(result.B.length, 1);
      assert.equal(result.A[0].value, 1);
      assert.equal(result.A[1].value, 3);
    });

    it('should group array by function', () => {
      const data = [
        { amount: 100 },
        { amount: -50 },
        { amount: 200 },
        { amount: -75 }
      ];
      const result = groupBy(data, item => item.amount > 0 ? 'positive' : 'negative');
      
      assert.equal(Object.keys(result).length, 2);
      assert.equal(result.positive.length, 2);
      assert.equal(result.negative.length, 2);
    });

    it('should handle empty array', () => {
      const result = groupBy([], 'type');
      assert.deepEqual(result, {});
    });
  });

  describe('fmtDateISO', () => {
    it('should format date correctly', () => {
      const date = new Date('2025-03-15');
      const result = fmtDateISO(date);
      assert.equal(result, '2025-03-15');
    });

    it('should handle single digit months and days', () => {
      const date = new Date('2025-01-05');
      const result = fmtDateISO(date);
      assert.equal(result, '2025-01-05');
    });
  });
});