/**
 * Chart Skeleton Loader
 * 
 * Displays a pulsing skeleton while charts are loading.
 * Matches the dimensions of actual charts for no layout shift.
 */

import React from 'react';

interface ChartSkeletonProps {
  height?: number;
  className?: string;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ 
  height = 300,
  className = '' 
}) => {
  return (
    <div 
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-lg ${className}`}
      style={{ height: `${height}px` }}
    >
      <div className="p-4 space-y-4">
        {/* Title skeleton */}
        <div className="h-6 bg-slate-300 dark:bg-slate-700 rounded w-1/3"></div>
        
        {/* Chart area */}
        <div className="space-y-3">
          {/* Y-axis labels */}
          <div className="flex items-end justify-between" style={{ height: height - 100 }}>
            {[...Array(6)].map((_, i) => (
              <div 
                key={i}
                className="bg-slate-300 dark:bg-slate-700 rounded w-12"
                style={{ 
                  height: `${Math.random() * 60 + 20}%`,
                  opacity: 0.6 
                }}
              ></div>
            ))}
          </div>
          
          {/* X-axis labels */}
          <div className="flex justify-between">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i}
                className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-12"
              ></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div 
        className={`${sizeClasses[size]} border-4 border-slate-200 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin`}
      ></div>
    </div>
  );
};
