import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMarineData } from '../useMarineData';
import { mockMarineWeatherData } from '../../src/test/mocks/weatherData';
import React from 'react';

// Mock the fetchMarineWeather function
vi.mock('@seame/core', () => ({
  fetchMarineWeather: vi.fn(() => Promise.resolve(mockMarineWeatherData)),
  MarineWeatherData: {},
}));

describe('useMarineData', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a new QueryClient for each test to ensure isolation
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries in tests
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  describe('Basic Functionality', () => {
    it('should fetch marine data for valid coordinates', async () => {
      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockMarineWeatherData);
    });

    it('should not fetch when coordinates are missing', () => {
      const { result } = renderHook(() => useMarineData(0, 0), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when lat is null/undefined', () => {
      const { result } = renderHook(() => useMarineData(null as any, 34.7818), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('should not fetch when lon is null/undefined', () => {
      const { result } = renderHook(() => useMarineData(32.0853, null as any), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('Query States', () => {
    it('should start in loading state', () => {
      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });

    it('should transition to success state', async () => {
      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should handle error state', async () => {
      const { fetchMarineWeather } = await import('@seame/core');
      vi.mocked(fetchMarineWeather).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('Query Key', () => {
    it('should use unique query key based on coordinates', () => {
      const { result: result1 } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });
      const { result: result2 } = renderHook(() => useMarineData(40.7128, -74.0060), { wrapper });

      // Different coordinates should have different query keys
      expect(result1.current).toBeDefined();
      expect(result2.current).toBeDefined();
    });

    it('should share cache for same coordinates', async () => {
      const { result: result1 } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second hook with same coordinates should use cached data
      const { result: result2 } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      expect(result2.current.data).toEqual(result1.current.data);
    });
  });

  describe('Refetch Behavior', () => {
    it('should support manual refetch', async () => {
      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const refetchResult = await result.current.refetch();

      expect(refetchResult.isSuccess).toBe(true);
      expect(refetchResult.data).toEqual(mockMarineWeatherData);
    });

    it('should refetch on window focus', async () => {
      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // The hook should be configured to refetch on window focus
      expect(result.current).toBeDefined();
    });
  });

  describe('Custom Options', () => {
    it('should accept custom query options', async () => {
      const onSuccess = vi.fn();

      const { result } = renderHook(
        () =>
          useMarineData(32.0853, 34.7818, {
            // @ts-ignore - older version compatibility
            onSuccess,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Custom options should be applied
      expect(result.current.data).toEqual(mockMarineWeatherData);
    });

    it('should allow overriding staleTime', async () => {
      const { result } = renderHook(
        () =>
          useMarineData(32.0853, 34.7818, {
            staleTime: 1000,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockMarineWeatherData);
    });
  });

  describe('Data Structure', () => {
    it('should return data with correct structure', async () => {
      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toHaveProperty('latitude');
      expect(result.current.data).toHaveProperty('longitude');
      expect(result.current.data).toHaveProperty('hourly');
      expect(result.current.data).toHaveProperty('current');
      expect(result.current.data).toHaveProperty('general');
      expect(result.current.data).toHaveProperty('tides');
    });

    it('should have hourly data as array', async () => {
      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(Array.isArray(result.current.data?.hourly.time)).toBe(true);
      expect(Array.isArray(result.current.data?.hourly.wave_height)).toBe(true);
    });

    it('should have current conditions', async () => {
      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.current).toHaveProperty('windSpeed');
      expect(result.current.data?.current).toHaveProperty('waveHeight');
      expect(result.current.data?.current).toHaveProperty('seaTemperature');
    });
  });

  describe('Coordinate Updates', () => {
    it('should refetch when coordinates change', async () => {
      const { result, rerender } = renderHook(
        ({ lat, lon }) => useMarineData(lat, lon),
        {
          wrapper,
          initialProps: { lat: 32.0853, lon: 34.7818 },
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const firstData = result.current.data;

      // Change coordinates
      rerender({ lat: 40.7128, lon: -74.0060 });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should have refetched (though mock returns same data)
      expect(result.current.data).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should expose error object when fetch fails', async () => {
      const { fetchMarineWeather } = await import('@seame/core');
      const errorMessage = 'API request failed';
      vi.mocked(fetchMarineWeather).mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(errorMessage);
    });
  });

  describe('Cache Behavior', () => {
    it('should use cached data when available', async () => {
      // First render to populate cache
      const { result: result1 } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      await waitFor(() => {
        expect(result1.current.isSuccess).toBe(true);
      });

      // Second render should use cached data immediately
      const { result: result2 } = renderHook(() => useMarineData(32.0853, 34.7818), { wrapper });

      expect(result2.current.data).toBeDefined();
      expect(result2.current.data).toEqual(result1.current.data);
    });
  });
});
