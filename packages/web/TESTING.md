# Testing Guide for SeaYou Marine Weather Dashboard

This document provides comprehensive information about the testing infrastructure and practices for the SeaYou project.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Coverage](#coverage)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)

## Overview

The SeaYou project uses **Vitest** as the testing framework with:

- **Unit Tests**: Pure functions, utilities, and calculations
- **Integration Tests**: Service layer with mocked APIs
- **Component Tests**: React components with user interactions
- **Hook Tests**: Custom React hooks

### Technology Stack

- **Vitest**: Fast unit test framework for Vite projects
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: Custom matchers for DOM assertions
- **@testing-library/user-event**: User interaction simulation
- **jsdom**: DOM implementation for Node.js

## Installation

Install testing dependencies:

```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8 --filter @seame/web
```

## Running Tests

### Development Mode (Watch)

Run tests in watch mode for active development:

```bash
pnpm test
```

### Single Run

Run tests once (useful for CI):

```bash
pnpm test:run
```

### Interactive UI

Run tests with Vitest's interactive UI:

```bash
pnpm test:ui
```

### Coverage Report

Generate code coverage report:

```bash
pnpm test:coverage
```

Coverage reports are generated in:
- **HTML**: `./coverage/index.html`
- **JSON**: `./coverage/coverage.json`
- **LCOV**: `./coverage/lcov.info`

## Test Structure

```
packages/
├── core/
│   └── src/
│       ├── utils/
│       │   └── __tests__/
│       │       ├── calculations.test.ts
│       │       └── formatting.test.ts
│       └── services/
│           └── __tests__/
│               ├── cacheService.test.ts
│               └── weatherService.test.ts
└── web/
    ├── components/
    │   └── __tests__/
    │       └── Dashboard.test.tsx
    ├── hooks/
    │   └── __tests__/
    │       └── useMarineData.test.ts
    └── src/
        └── test/
            ├── setup.ts              # Test configuration
            └── mocks/
                ├── weatherData.ts    # Mock data
                └── handlers.ts       # Mock API handlers
```

## Test Files

### Core Utilities Tests

**`calculations.test.ts`** - Tests for tide and moon calculations:
- Moon phase calculations
- Tide data generation
- Tidal patterns validation

**`formatting.test.ts`** - Tests for weather description formatting:
- Weather code mappings
- Description accuracy
- Edge cases

### Service Tests

**`cacheService.test.ts`** - Tests for IndexedDB cache service:
- Cache key generation
- Set/get operations
- TTL expiration
- LRU eviction
- Cache statistics

**`weatherService.test.ts`** - Integration tests for weather API:
- Marine weather fetching
- Point forecasts
- Location search
- Reverse geocoding
- Error handling

### Component Tests

**`Dashboard.test.tsx`** - Tests for main Dashboard component:
- Loading states
- Error handling
- Weather data display
- User interactions
- Alert configuration
- Tab switching
- Accessibility

### Hook Tests

**`useMarineData.test.ts`** - Tests for React Query hook:
- Data fetching
- Query states
- Cache behavior
- Refetch logic
- Error handling

## Coverage

### Current Coverage Targets

- **Lines**: 50%
- **Functions**: 50%
- **Branches**: 50%
- **Statements**: 50%

### Viewing Coverage

After running `pnpm test:coverage`, open:

```bash
# Open HTML report
open coverage/index.html
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { getMoonData } from '../calculations';

describe('getMoonData', () => {
  it('should calculate moon phase and illumination', () => {
    const moonData = getMoonData(new Date('2024-01-15'));

    expect(moonData.phase).toBeDefined();
    expect(moonData.illumination).toBeGreaterThanOrEqual(0);
    expect(moonData.illumination).toBeLessThanOrEqual(100);
  });
});
```

### Component Test Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import Dashboard from '../Dashboard';

describe('Dashboard', () => {
  it('should render weather data', () => {
    render(<Dashboard weatherData={mockData} loading={false} />);

    expect(screen.getByText('Tel Aviv')).toBeInTheDocument();
  });
});
```

### Hook Test Example

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useMarineData } from '../useMarineData';

describe('useMarineData', () => {
  it('should fetch marine data', async () => {
    const { result } = renderHook(
      () => useMarineData(32.0853, 34.7818),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
```

## Best Practices

### 1. Test Organization

- Group related tests in `describe` blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Mock Management

- Use centralized mock data in `src/test/mocks/`
- Reset mocks between tests with `vi.clearAllMocks()`
- Mock external dependencies (APIs, browser APIs)

### 3. Async Testing

- Use `waitFor` for asynchronous assertions
- Avoid arbitrary timeouts
- Clean up side effects in `afterEach`

### 4. Component Testing

- Test user behavior, not implementation
- Use accessible queries (`getByRole`, `getByLabelText`)
- Test error states and edge cases

### 5. Coverage Goals

- Aim for meaningful coverage, not 100%
- Focus on critical paths and business logic
- Don't test trivial code or third-party libraries

## Continuous Integration

Tests automatically run on every push to the `main` branch via GitHub Actions.

The workflow:
1. Installs dependencies
2. Runs tests (`pnpm test:run`)
3. Builds the application
4. Deploys to GitHub Pages

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module"
```bash
# Solution: Ensure dependencies are installed
pnpm install
```

**Issue**: Coverage not generated
```bash
# Solution: Run with explicit coverage flag
pnpm test:coverage
```

**Issue**: Mock data not working
```bash
# Solution: Check mock imports and setup.ts
# Ensure mocks are defined before imports
```

### Debug Mode

Run tests with debugging:

```bash
# Enable verbose output
pnpm test --reporter=verbose

# Run specific test file
pnpm test calculations.test.ts
```

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Ensure all tests pass
3. Maintain or improve coverage
4. Update this documentation if needed

---

**Happy Testing!** 🧪
