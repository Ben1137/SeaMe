/**
 * Test Suite for Sea Detection Algorithm
 *
 * Run this file to verify the isOverSea() function works correctly
 * for known Mediterranean locations.
 */

import { isOverSea } from './weatherDataService-improved';

interface TestPoint {
  name: string;
  lat: number;
  lng: number;
  expectedResult: boolean;
  category: 'sea' | 'land' | 'coast';
}

/**
 * Comprehensive test points covering Mediterranean region
 */
const TEST_POINTS: TestPoint[] = [
  // ===== SEAS (Should return true) =====
  {
    name: 'Central Mediterranean',
    lat: 35.5,
    lng: 14.5,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Adriatic Sea (Central)',
    lat: 43.0,
    lng: 15.0,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Aegean Sea (Central)',
    lat: 38.5,
    lng: 25.0,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Tyrrhenian Sea',
    lat: 40.5,
    lng: 12.0,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Ionian Sea',
    lat: 38.0,
    lng: 18.0,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Levantine Sea',
    lat: 33.5,
    lng: 33.0,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Western Mediterranean',
    lat: 38.0,
    lng: 2.0,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Gulf of Lion',
    lat: 42.5,
    lng: 4.5,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Strait of Sicily',
    lat: 37.0,
    lng: 12.5,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Eastern Mediterranean',
    lat: 34.0,
    lng: 30.0,
    expectedResult: true,
    category: 'sea'
  },

  // ===== LAND (Should return false) =====
  {
    name: 'Rome, Italy',
    lat: 41.9,
    lng: 12.5,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Madrid, Spain',
    lat: 40.4,
    lng: -3.7,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Athens, Greece',
    lat: 37.98,
    lng: 23.73,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Istanbul, Turkey',
    lat: 41.01,
    lng: 28.96,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Marseille, France',
    lat: 43.3,
    lng: 5.4,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Tunis, Tunisia',
    lat: 36.8,
    lng: 10.2,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Barcelona, Spain',
    lat: 41.4,
    lng: 2.2,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Naples, Italy',
    lat: 40.85,
    lng: 14.27,
    expectedResult: false,
    category: 'land'
  },

  // ===== ISLANDS (Should return false) =====
  {
    name: 'Sicily (Palermo)',
    lat: 38.12,
    lng: 13.36,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Sardinia (Cagliari)',
    lat: 39.22,
    lng: 9.12,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Corsica (Ajaccio)',
    lat: 41.93,
    lng: 8.74,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Crete (Heraklion)',
    lat: 35.34,
    lng: 25.14,
    expectedResult: false,
    category: 'land'
  },
  {
    name: 'Cyprus (Nicosia)',
    lat: 35.19,
    lng: 33.38,
    expectedResult: false,
    category: 'land'
  },

  // ===== COASTAL WATERS (Should return true) =====
  {
    name: 'Off Barcelona Coast',
    lat: 41.3,
    lng: 2.5,
    expectedResult: true,
    category: 'coast'
  },
  {
    name: 'Off Naples Coast',
    lat: 40.6,
    lng: 14.0,
    expectedResult: true,
    category: 'coast'
  },
  {
    name: 'Off Athens Coast',
    lat: 37.8,
    lng: 23.9,
    expectedResult: true,
    category: 'coast'
  },
  {
    name: 'Off Tunis Coast',
    lat: 36.9,
    lng: 10.5,
    expectedResult: true,
    category: 'coast'
  },

  // ===== EDGE CASES =====
  {
    name: 'Gibraltar Strait',
    lat: 36.0,
    lng: -5.5,
    expectedResult: true,
    category: 'sea'
  },
  {
    name: 'Suez Canal (excluded)',
    lat: 30.5,
    lng: 32.3,
    expectedResult: false,
    category: 'land'
  }
];

/**
 * Run tests and display results
 */
export function runSeaDetectionTests(): void {
  console.log('\n========================================');
  console.log('SEA DETECTION ALGORITHM TEST SUITE');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;
  const failures: { point: TestPoint; actual: boolean }[] = [];

  TEST_POINTS.forEach((point) => {
    const actual = isOverSea(point.lat, point.lng);
    const success = actual === point.expectedResult;

    if (success) {
      passed++;
      console.log(`✓ ${point.name} (${point.category})`);
    } else {
      failed++;
      failures.push({ point, actual });
      console.log(
        `✗ ${point.name} (${point.category}) - Expected ${point.expectedResult}, got ${actual}`
      );
    }
  });

  // Summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${TEST_POINTS.length}`);
  console.log(`Passed: ${passed} (${((passed / TEST_POINTS.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed / TEST_POINTS.length) * 100).toFixed(1)}%)`);

  // Category breakdown
  console.log('\nBREAKDOWN BY CATEGORY:');
  const categories = ['sea', 'land', 'coast'] as const;
  categories.forEach((category) => {
    const categoryPoints = TEST_POINTS.filter((p) => p.category === category);
    const categoryPassed = categoryPoints.filter(
      (p) => isOverSea(p.lat, p.lng) === p.expectedResult
    ).length;
    console.log(
      `${category.toUpperCase()}: ${categoryPassed}/${categoryPoints.length} ` +
      `(${((categoryPassed / categoryPoints.length) * 100).toFixed(1)}%)`
    );
  });

  // Failed tests detail
  if (failures.length > 0) {
    console.log('\n========================================');
    console.log('FAILED TESTS DETAIL');
    console.log('========================================');
    failures.forEach(({ point, actual }) => {
      console.log(`\n${point.name}:`);
      console.log(`  Location: ${point.lat}°N, ${point.lng}°E`);
      console.log(`  Category: ${point.category}`);
      console.log(`  Expected: ${point.expectedResult ? 'SEA' : 'LAND'}`);
      console.log(`  Actual: ${actual ? 'SEA' : 'LAND'}`);
    });
  }

  console.log('\n========================================\n');
}

/**
 * Test grid generation in a specific area
 */
export function testGridGeneration(): void {
  console.log('\n========================================');
  console.log('GRID GENERATION TEST');
  console.log('========================================\n');

  // Test small area around central Mediterranean
  const testArea = {
    latMin: 35.0,
    latMax: 36.0,
    lngMin: 14.0,
    lngMax: 15.0,
    resolution: 0.25,
    seaOnly: true
  };

  console.log('Test Configuration:');
  console.log(`  Lat Range: ${testArea.latMin}° to ${testArea.latMax}°`);
  console.log(`  Lng Range: ${testArea.lngMin}° to ${testArea.lngMax}°`);
  console.log(`  Resolution: ${testArea.resolution}°`);
  console.log(`  Sea Only: ${testArea.seaOnly}`);

  // Calculate what we expect
  const latSteps = Math.ceil((testArea.latMax - testArea.latMin) / testArea.resolution) + 1;
  const lngSteps = Math.ceil((testArea.lngMax - testArea.lngMin) / testArea.resolution) + 1;
  const totalGrid = latSteps * lngSteps;

  console.log(`\nExpected Grid Points (without filter): ${totalGrid}`);
  console.log('  (This area should be mostly sea)');

  console.log('\n========================================\n');
}

/**
 * Visualize sea detection in a grid
 * Creates ASCII art representation
 */
export function visualizeSeaDetection(
  latMin: number,
  latMax: number,
  lngMin: number,
  lngMax: number,
  resolution: number
): void {
  console.log('\n========================================');
  console.log('SEA DETECTION VISUALIZATION');
  console.log('========================================\n');

  console.log(`Area: ${latMin}°N to ${latMax}°N, ${lngMin}°E to ${lngMax}°E`);
  console.log(`Resolution: ${resolution}°`);
  console.log(`Legend: █ = Sea, ░ = Land\n`);

  // Build grid from north to south (top to bottom)
  for (let lat = latMax; lat >= latMin; lat -= resolution) {
    let row = `${lat.toFixed(1)}° `;
    for (let lng = lngMin; lng <= lngMax; lng += resolution) {
      const isSea = isOverSea(lat, lng);
      row += isSea ? '█' : '░';
    }
    console.log(row);
  }

  // Print longitude labels
  let lngLabels = '      ';
  for (let lng = lngMin; lng <= lngMax; lng += resolution) {
    lngLabels += lng.toFixed(0).padStart(2, ' ')[0];
  }
  console.log(lngLabels);

  console.log('\n========================================\n');
}

/**
 * Run all tests
 */
export function runAllTests(): void {
  runSeaDetectionTests();
  testGridGeneration();

  // Visualize a sample area (Central Mediterranean)
  visualizeSeaDetection(34.0, 38.0, 12.0, 18.0, 0.5);

  // Visualize Adriatic Sea
  console.log('\n\nADRIATIC SEA:');
  visualizeSeaDetection(40.0, 45.0, 13.0, 19.0, 0.5);
}

// Auto-run if executed directly
if (require.main === module) {
  runAllTests();
}

// Export for use in other tests
export { TEST_POINTS };
