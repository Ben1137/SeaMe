import { describe, it, expect } from 'vitest';
import { getWeatherDescription } from '../formatting';

describe('getWeatherDescription', () => {
  it('should return "Clear Sky" for code 0', () => {
    expect(getWeatherDescription(0)).toBe('Clear Sky');
  });

  it('should return "Mainly Clear" for code 1', () => {
    expect(getWeatherDescription(1)).toBe('Mainly Clear');
  });

  it('should return "Partly Cloudy" for code 2', () => {
    expect(getWeatherDescription(2)).toBe('Partly Cloudy');
  });

  it('should return "Overcast" for code 3', () => {
    expect(getWeatherDescription(3)).toBe('Overcast');
  });

  it('should handle fog codes', () => {
    expect(getWeatherDescription(45)).toBe('Fog');
    expect(getWeatherDescription(48)).toBe('Depositing Rime Fog');
  });

  it('should handle drizzle codes', () => {
    expect(getWeatherDescription(51)).toBe('Light Drizzle');
    expect(getWeatherDescription(53)).toBe('Moderate Drizzle');
    expect(getWeatherDescription(55)).toBe('Dense Drizzle');
  });

  it('should handle rain codes', () => {
    expect(getWeatherDescription(61)).toBe('Slight Rain');
    expect(getWeatherDescription(63)).toBe('Moderate Rain');
    expect(getWeatherDescription(65)).toBe('Heavy Rain');
  });

  it('should handle snow codes', () => {
    expect(getWeatherDescription(71)).toBe('Slight Snow');
    expect(getWeatherDescription(73)).toBe('Moderate Snow');
    expect(getWeatherDescription(75)).toBe('Heavy Snow');
    expect(getWeatherDescription(77)).toBe('Snow Grains');
  });

  it('should handle rain shower codes', () => {
    expect(getWeatherDescription(80)).toBe('Slight Rain Showers');
    expect(getWeatherDescription(81)).toBe('Moderate Rain Showers');
    expect(getWeatherDescription(82)).toBe('Violent Rain Showers');
  });

  it('should handle thunderstorm codes', () => {
    expect(getWeatherDescription(95)).toBe('Thunderstorm');
    expect(getWeatherDescription(96)).toBe('Thunderstorm with Hail');
    expect(getWeatherDescription(99)).toBe('Heavy Hail Thunderstorm');
  });

  it('should return "Unknown" for unrecognized codes', () => {
    expect(getWeatherDescription(999)).toBe('Unknown');
    expect(getWeatherDescription(-1)).toBe('Unknown');
    expect(getWeatherDescription(50)).toBe('Unknown');
  });

  it('should handle edge cases', () => {
    expect(getWeatherDescription(0)).toBe('Clear Sky');
    expect(getWeatherDescription(99)).toBe('Heavy Hail Thunderstorm');
  });

  describe('all valid weather codes', () => {
    const validCodes = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 61, 63, 65, 71, 73, 75, 77, 80, 81, 82, 95, 96, 99
    ];

    it('should return non-"Unknown" for all valid codes', () => {
      validCodes.forEach(code => {
        expect(getWeatherDescription(code)).not.toBe('Unknown');
      });
    });

    it('should return string descriptions for all codes', () => {
      validCodes.forEach(code => {
        const description = getWeatherDescription(code);
        expect(typeof description).toBe('string');
        expect(description.length).toBeGreaterThan(0);
      });
    });
  });
});
