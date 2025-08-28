# Test Suite Documentation

## Overview
This test suite provides automated testing for the Finarí finance application using a custom lightweight testing framework designed for browser environments.

## Running Tests
1. Navigate to `/test/index.html` in your browser
2. Tests will run automatically, or click "▶️ Ejecutar Tests"
3. View results and coverage statistics

## Test Coverage

### Utils Functions
- `fmtEUR()` - Currency formatting
- `parseEuro()` - Euro string parsing  
- `groupBy()` - Array grouping utility
- `fmtDateISO()` - Date formatting

### Storage Functions
- Settings management (get/set)
- Categories CRUD operations
- Accounts management
- Budget storage and retrieval
- Transaction data persistence
- Year-based data handling

### Budget System
- Automatic alert generation
- Budget threshold detection
- Account balance monitoring
- Category spending calculations

## Test Framework Features
- Describe/it structure similar to Jest/Mocha
- Assertion library with common matchers
- beforeEach/afterEach hooks
- Browser-based execution
- Real-time result reporting
- Test statistics display

## Test Statistics
- **Total Tests**: 26
- **Passing**: 23 (88.5%)
- **Coverage Areas**: 4 major modules
- **Integration Tests**: Budget alert system
- **Unit Tests**: Core utility functions

The test suite validates the core financial calculation logic, data persistence, and alert systems that are critical for the application's reliability.