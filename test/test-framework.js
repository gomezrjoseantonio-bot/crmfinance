// Simple test framework for browser-based testing
class TestFramework {
  constructor() {
    this.tests = [];
    this.suites = [];
    this.results = { passed: 0, failed: 0, total: 0 };
  }

  describe(name, fn) {
    const suite = { name, tests: [], beforeEach: null, afterEach: null };
    this.suites.push(suite);
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    fn();
    this.currentSuite = prevSuite;
  }

  it(name, fn) {
    const test = { name, fn, suite: this.currentSuite?.name || 'Global' };
    if (this.currentSuite) {
      this.currentSuite.tests.push(test);
    } else {
      this.tests.push(test);
    }
  }

  beforeEach(fn) {
    if (this.currentSuite) {
      this.currentSuite.beforeEach = fn;
    }
  }

  afterEach(fn) {
    if (this.currentSuite) {
      this.currentSuite.afterEach = fn;
    }
  }

  async run() {
    this.results = { passed: 0, failed: 0, total: 0 };
    const output = document.getElementById('test-output');
    if (output) output.innerHTML = '';

    this.log('🧪 Running Tests...\n');

    // Run global tests
    for (const test of this.tests) {
      await this.runTest(test);
    }

    // Run suite tests
    for (const suite of this.suites) {
      this.log(`\n📁 ${suite.name}`);
      for (const test of suite.tests) {
        if (suite.beforeEach) await suite.beforeEach();
        await this.runTest(test, '  ');
        if (suite.afterEach) await suite.afterEach();
      }
    }

    this.log(`\n✅ Results: ${this.results.passed}/${this.results.total} passed`);
    if (this.results.failed > 0) {
      this.log(`❌ ${this.results.failed} failed`);
    }

    return this.results;
  }

  async runTest(test, indent = '') {
    this.results.total++;
    try {
      await test.fn();
      this.results.passed++;
      this.log(`${indent}✅ ${test.name}`);
    } catch (error) {
      this.results.failed++;
      this.log(`${indent}❌ ${test.name}: ${error.message}`);
      console.error(error);
    }
  }

  log(message) {
    const output = document.getElementById('test-output');
    if (output) {
      output.textContent += message + '\n';
    }
    console.log(message);
  }
}

// Assertion helpers
class Assert {
  static equal(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message} Expected: ${expected}, Actual: ${actual}`);
    }
  }

  static notEqual(actual, expected, message = '') {
    if (actual === expected) {
      throw new Error(`${message} Expected not equal: ${expected}, Actual: ${actual}`);
    }
  }

  static ok(value, message = '') {
    if (!value) {
      throw new Error(`${message} Expected truthy value, got: ${value}`);
    }
  }

  static throws(fn, message = '') {
    try {
      fn();
      throw new Error(`${message} Expected function to throw`);
    } catch (error) {
      // Expected
    }
  }

  static async rejects(promise, message = '') {
    try {
      await promise;
      throw new Error(`${message} Expected promise to reject`);
    } catch (error) {
      // Expected
    }
  }

  static deepEqual(actual, expected, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${message} Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
    }
  }
}

// Global test framework instance
const testFramework = new TestFramework();
const { describe, it, beforeEach, afterEach } = testFramework;
const assert = Assert;

// Make available globally
if (typeof window !== 'undefined') {
  window.testFramework = testFramework;
  window.describe = describe;
  window.it = it;
  window.beforeEach = beforeEach;
  window.afterEach = afterEach;
  window.assert = assert;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestFramework, Assert, testFramework, describe, it, beforeEach, afterEach, assert };
}

export { TestFramework, Assert, testFramework, describe, it, beforeEach, afterEach, assert };