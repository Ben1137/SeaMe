/**
 * Cache Status Indicator Component
 * 
 * Shows cache statistics and allows manual cache management.
 * Useful for debugging and user transparency.
 */

import React, { useState } from 'react';
import { Database, Trash2, RefreshCw, HardDrive } from 'lucide-react';
import { useCacheStats, useCacheManagement } from '../hooks/useCachedWeather';

export const CacheStatusIndicator: React.FC = () => {
  const stats = useCacheStats();
  const { clearCache, deleteExpired } = useCacheManagement();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleClearCache = async () => {
    if (!confirm('Clear all cached weather data? You will need to re-download data.')) {
      return;
    }
    setIsClearing(true);
    await clearCache();
    setIsClearing(false);
    window.location.reload();
  };

  const handleDeleteExpired = async () => {
    setIsClearing(true);
    const deleted = await deleteExpired();
    setIsClearing(false);
    alert(`Deleted ${deleted} expired cache entries`);
  };

  const cachePercentage = (stats.totalSize / (50 * 1024 * 1024)) * 100;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Compact indicator */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 
                   rounded-lg shadow-lg border border-slate-200 dark:border-slate-700
                   hover:shadow-xl transition-all"
        title="Cache Status"
      >
        <Database size={16} className="text-blue-500" />
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {formatBytes(stats.totalSize)}
        </span>
        {stats.hitRate > 0 && (
          <span className="text-xs text-green-600 dark:text-green-400">
            {stats.hitRate.toFixed(0)}% hit
          </span>
        )}
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="absolute bottom-14 right-0 w-80 bg-white dark:bg-slate-800 
                        rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <HardDrive size={18} />
              Cache Status
            </h3>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          {/* Stats */}
          <div className="space-y-3 mb-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-600 dark:text-slate-400">Storage Used</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {formatBytes(stats.totalSize)} / 50 MB
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(cachePercentage, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Cached Items</span>
              <span className="font-medium text-slate-900 dark:text-white">
                {stats.itemCount}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Hit Rate</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                {stats.hitRate.toFixed(1)}%
              </span>
            </div>

            {stats.oldestItem > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Oldest Entry</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(stats.oldestItem).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleDeleteExpired}
              disabled={isClearing}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 
                         bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 
                         dark:hover:bg-slate-600 rounded-lg text-sm font-medium
                         text-slate-700 dark:text-slate-300 transition-colors
                         disabled:opacity-50"
            >
              <RefreshCw size={14} className={isClearing ? 'animate-spin' : ''} />
              Clean
            </button>
            <button
              onClick={handleClearCache}
              disabled={isClearing}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 
                         bg-red-100 dark:bg-red-900/30 hover:bg-red-200 
                         dark:hover:bg-red-900/50 rounded-lg text-sm font-medium
                         text-red-700 dark:text-red-400 transition-colors
                         disabled:opacity-50"
            >
              <Trash2 size={14} />
              Clear All
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Cache reduces API calls and enables offline access
          </p>
        </div>
      )}
    </div>
  );
};
