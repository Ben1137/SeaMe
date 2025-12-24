import { describe, it, expect } from 'vitest';
import { getMoonData, generateTideData } from '../calculations';

describe('getMoonData', () => {
  it('should calculate moon phase and illumination for a given date', () => {
    const testDate = new Date('2024-01-15T12:00:00Z');
    const moonData = getMoonData(testDate);

    expect(moonData).toHaveProperty('phase');
    expect(moonData).toHaveProperty('illumination');
    expect(moonData).toHaveProperty('phaseValue');

    expect(typeof moonData.phase).toBe('string');
    expect(typeof moonData.illumination).toBe('number');
    expect(typeof moonData.phaseValue).toBe('number');

    // Illumination should be between 0 and 100
    expect(moonData.illumination).toBeGreaterThanOrEqual(0);
    expect(moonData.illumination).toBeLessThanOrEqual(100);

    // Phase value should be between 0 and 1
    expect(moonData.phaseValue).toBeGreaterThanOrEqual(0);
    expect(moonData.phaseValue).toBeLessThan(1);
  });

  it('should return valid moon phases', () => {
    const validPhases = [
      'New Moon',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full Moon',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent',
    ];

    const moonData = getMoonData(new Date());
    expect(validPhases).toContain(moonData.phase);
  });

  it('should handle different dates consistently', () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-01');

    const moon1 = getMoonData(date1);
    const moon2 = getMoonData(date2);

    expect(moon1.phase).toBe(moon2.phase);
    expect(moon1.illumination).toBe(moon2.illumination);
    expect(moon1.phaseValue).toBe(moon2.phaseValue);
  });

  it('should calculate full moon illumination near 100%', () => {
    // Known full moon date: 2024-01-25
    const fullMoonDate = new Date('2024-01-25T12:00:00Z');
    const moonData = getMoonData(fullMoonDate);

    // Full moon illumination should be close to 100%
    expect(moonData.illumination).toBeGreaterThan(90);
  });

  it('should calculate new moon illumination near 0%', () => {
    // Known new moon date: 2024-01-11
    const newMoonDate = new Date('2024-01-11T12:00:00Z');
    const moonData = getMoonData(newMoonDate);

    // New moon illumination should be close to 0%
    expect(moonData.illumination).toBeLessThan(15);
  });
});

describe('generateTideData', () => {
  it('should generate tide data with required properties', () => {
    const lat = 32.0853;
    const lng = 34.7818;
    const tideData = generateTideData(lat, lng);

    expect(tideData).toHaveProperty('currentHeight');
    expect(tideData).toHaveProperty('rising');
    expect(tideData).toHaveProperty('nextHigh');
    expect(tideData).toHaveProperty('nextLow');
    expect(tideData).toHaveProperty('hourly');
  });

  it('should generate 48 hours of hourly tide data', () => {
    const tideData = generateTideData(32.0853, 34.7818);

    expect(tideData.hourly).toHaveLength(48);
    expect(tideData.hourly[0]).toHaveProperty('time');
    expect(tideData.hourly[0]).toHaveProperty('height');
  });

  it('should have valid tide heights (positive values)', () => {
    const tideData = generateTideData(32.0853, 34.7818);

    tideData.hourly.forEach(tide => {
      expect(tide.height).toBeGreaterThan(0);
      expect(tide.height).toBeLessThan(5); // Reasonable max tide height
    });
  });

  it('should have next high and low tide events', () => {
    const tideData = generateTideData(32.0853, 34.7818);

    expect(tideData.nextHigh).toBeDefined();
    expect(tideData.nextHigh.type).toBe('HIGH');
    expect(tideData.nextHigh.height).toBeGreaterThan(0);

    expect(tideData.nextLow).toBeDefined();
    expect(tideData.nextLow.type).toBe('LOW');
    expect(tideData.nextLow.height).toBeGreaterThan(0);

    // High tide should be higher than low tide
    expect(tideData.nextHigh.height).toBeGreaterThan(tideData.nextLow.height);
  });

  it('should return boolean for rising property', () => {
    const tideData = generateTideData(32.0853, 34.7818);

    expect(typeof tideData.rising).toBe('boolean');
  });

  it('should have valid ISO date strings for tide times', () => {
    const tideData = generateTideData(32.0853, 34.7818);

    tideData.hourly.forEach(tide => {
      const date = new Date(tide.time);
      expect(date.toString()).not.toBe('Invalid Date');
    });

    expect(new Date(tideData.nextHigh.time).toString()).not.toBe('Invalid Date');
    expect(new Date(tideData.nextLow.time).toString()).not.toBe('Invalid Date');
  });

  it('should vary tide data based on longitude (phase shift)', () => {
    const tide1 = generateTideData(32.0853, 0);     // Greenwich
    const tide2 = generateTideData(32.0853, 180);   // Opposite side

    // Due to longitude-based phase shift, heights should differ
    expect(tide1.currentHeight).not.toBe(tide2.currentHeight);
  });

  it('should have current height matching first hourly value', () => {
    const tideData = generateTideData(32.0853, 34.7818);

    expect(tideData.currentHeight).toBe(tideData.hourly[0].height);
  });

  it('should determine rising/falling correctly', () => {
    const tideData = generateTideData(32.0853, 34.7818);

    const isRising = tideData.hourly[1].height > tideData.hourly[0].height;
    expect(tideData.rising).toBe(isRising);
  });

  it('should handle edge coordinates', () => {
    // Test extreme latitude
    const tideNorth = generateTideData(89.9, 0);
    expect(tideNorth.hourly).toHaveLength(48);

    const tideSouth = generateTideData(-89.9, 0);
    expect(tideSouth.hourly).toHaveLength(48);

    // Test extreme longitude
    const tideWest = generateTideData(0, -179);
    expect(tideWest.hourly).toHaveLength(48);

    const tideEast = generateTideData(0, 179);
    expect(tideEast.hourly).toHaveLength(48);
  });

  it('should generate realistic tidal patterns', () => {
    const tideData = generateTideData(32.0853, 34.7818);

    // Tides should oscillate - check that we have both increases and decreases
    let hasIncrease = false;
    let hasDecrease = false;

    for (let i = 1; i < tideData.hourly.length; i++) {
      const diff = tideData.hourly[i].height - tideData.hourly[i - 1].height;
      if (diff > 0) hasIncrease = true;
      if (diff < 0) hasDecrease = true;
    }

    expect(hasIncrease).toBe(true);
    expect(hasDecrease).toBe(true);
  });
});
