/**
 * Lazy-loaded chart wrapper component
 * 
 * Loads charts only when they enter the viewport.
 * Shows skeleton loader while loading.
 */

import React, { Suspense, lazy } from 'react';
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { ChartSkeleton } from './ui/ChartSkeleton';

interface LazyChartProps {
  chartType: 'tide' | 'wave' | 'swell' | 'wind';
  data: any;
  height?: number;
  className?: string;
}

// Lazy load chart components
const TideChart = lazy(() => import('./charts/TideChart'));
const WaveChart = lazy(() => import('./charts/WaveChart'));
const SwellChart = lazy(() => import('./charts/SwellChart'));
const WindChart = lazy(() => import('./charts/WindChart'));

const chartComponents = {
  tide: TideChart,
  wave: WaveChart,
  swell: SwellChart,
  wind: WindChart,
};

export const LazyChart: React.FC<LazyChartProps> = ({
  chartType,
  data,
  height = 300,
  className = '',
}) => {
  const { ref, isVisible } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '50px', // Start loading 50px before visible
    freezeOnceVisible: true,
  });

  const ChartComponent = chartComponents[chartType];

  return (
    <div ref={ref} className={className}>
      {isVisible ? (
        <Suspense fallback={<ChartSkeleton height={height} />}>
          <ChartComponent data={data} height={height} />
        </Suspense>
      ) : (
        <ChartSkeleton height={height} />
      )}
    </div>
  );
};
