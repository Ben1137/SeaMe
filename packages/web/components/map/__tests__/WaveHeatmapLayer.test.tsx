/**
 * WAVE HEATMAP LAYER - UNIT TESTS
 */

import { describe, it, expect } from 'vitest';
import { getWaveHeightColor, createGridDataFromForecasts } from '../WaveHeatmapLayer';
import type { GridCell } from '../WaveHeatmapLayer';

describe('WaveHeatmapLayer Utilities', () => {
  describe('getWaveHeightColor', () => {
    it('should return blue for calm waves (< 0.5m)', () => {
      expect(getWaveHeightColor(0.3)).toBe('#93c5fd');
    });

    it('should return blue-500 for light waves (0.5-1.0m)', () => {
      expect(getWaveHeightColor(0.8)).toBe('#3b82f6');
    });

    it('should return emerald for moderate waves (1.0-2.0m)', () => {
      expect(getWaveHeightColor(1.5)).toBe('#34d399');
    });

    it('should return yellow for rough waves (2.0-3.0m)', () => {
      expect(getWaveHeightColor(2.5)).toBe('#facc15');
    });

    it('should return orange for very rough waves (3.0-4.0m)', () => {
      expect(getWaveHeightColor(3.5)).toBe('#fb923c');
    });

    it('should return red for high waves (≥ 4.0m)', () => {
      expect(getWaveHeightColor(4.5)).toBe('#ef4444');
    });

    it('should handle edge cases correctly', () => {
      expect(getWaveHeightColor(0.5)).toBe('#3b82f6');
      expect(getWaveHeightColor(1.0)).toBe('#34d399');
      expect(getWaveHeightColor(2.0)).toBe('#facc15');
      expect(getWaveHeightColor(3.0)).toBe('#fb923c');
      expect(getWaveHeightColor(4.0)).toBe('#ef4444');
    });

    it('should handle zero and negative values', () => {
      expect(getWaveHeightColor(0)).toBe('#93c5fd');
      expect(getWaveHeightColor(-0.5)).toBe('#93c5fd');
    });
  });

  describe('createGridDataFromForecasts', () => {
    it('should convert forecasts to grid data correctly', () => {
      const forecasts = [
        { lat: 32.0, lng: 34.5, waveHeight: 1.2 },
        { lat: 32.1, lng: 34.6, waveHeight: 2.5 },
      ];

      const result = createGridDataFromForecasts(forecasts);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        lat: 32.0,
        lng: 34.5,
        value: 1.2,
        color: getWaveHeightColor(1.2),
      });
      expect(result[1]).toEqual({
        lat: 32.1,
        lng: 34.6,
        value: 2.5,
        color: getWaveHeightColor(2.5),
      });
    });

    it('should handle empty forecast array', () => {
      const result = createGridDataFromForecasts([]);
      expect(result).toEqual([]);
    });

    it('should handle single forecast', () => {
      const forecasts = [{ lat: 32.0, lng: 34.5, waveHeight: 1.5 }];
      const result = createGridDataFromForecasts(forecasts);

      expect(result).toHaveLength(1);
      expect(result[0].value).toBe(1.5);
      expect(result[0].lat).toBe(32.0);
      expect(result[0].lng).toBe(34.5);
    });

    it('should preserve coordinate precision', () => {
      const forecasts = [{ lat: 32.123456, lng: 34.654321, waveHeight: 2.0 }];
      const result = createGridDataFromForecasts(forecasts);

      expect(result[0].lat).toBe(32.123456);
      expect(result[0].lng).toBe(34.654321);
    });

    it('should handle large datasets efficiently', () => {
      const forecasts = Array.from({ length: 100 }, (_, i) => ({
        lat: 32.0 + i * 0.01,
        lng: 34.5 + i * 0.01,
        waveHeight: Math.random() * 4,
      }));

      const result = createGridDataFromForecasts(forecasts);

      expect(result).toHaveLength(100);
      result.forEach((cell, i) => {
        expect(cell.lat).toBe(forecasts[i].lat);
        expect(cell.lng).toBe(forecasts[i].lng);
        expect(cell.value).toBe(forecasts[i].waveHeight);
        expect(cell.color).toBeDefined();
      });
    });
  });

  describe('GridCell type validation', () => {
    it('should create valid grid cells', () => {
      const cell: GridCell = {
        lat: 32.0,
        lng: 34.5,
        value: 1.5,
        color: '#3b82f6',
      };

      expect(cell.lat).toBe(32.0);
      expect(cell.lng).toBe(34.5);
      expect(cell.value).toBe(1.5);
      expect(cell.color).toBe('#3b82f6');
    });
  });

  describe('Color consistency', () => {
    it('should produce consistent colors for same wave heights', () => {
      const height = 2.3;
      const color1 = getWaveHeightColor(height);
      const color2 = getWaveHeightColor(height);

      expect(color1).toBe(color2);
    });

    it('should produce valid hex colors', () => {
      const heights = [0.2, 0.8, 1.5, 2.5, 3.5, 4.5];
      const hexColorPattern = /^#[0-9a-f]{6}$/i;

      heights.forEach((height) => {
        const color = getWaveHeightColor(height);
        expect(color).toMatch(hexColorPattern);
      });
    });
  });

  describe('Performance characteristics', () => {
    it('should handle 100 forecasts quickly', () => {
      const start = performance.now();

      const forecasts = Array.from({ length: 100 }, (_, i) => ({
        lat: 32.0 + i * 0.01,
        lng: 34.5 + i * 0.01,
        waveHeight: i % 5,
      }));

      createGridDataFromForecasts(forecasts);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50); // Should complete in < 50ms
    });

    it('should handle color generation efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        getWaveHeightColor(Math.random() * 5);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(10); // Should complete in < 10ms
    });
  });
});
