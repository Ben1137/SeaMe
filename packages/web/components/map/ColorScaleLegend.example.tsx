/**
 * ColorScaleLegend Examples
 *
 * This file demonstrates various use cases for the ColorScaleLegend component.
 * You can use these examples as reference when integrating the legend into your maps.
 */

import React, { useState } from 'react';
import { ColorScaleLegend, ColorScaleItem } from './ColorScaleLegend';

// Example scale definitions matching your MapComponent color schemes

export const WAVE_HEIGHT_SCALE: ColorScaleItem[] = [
  { value: 0, color: '#93c5fd', label: '0' },
  { value: 0.5, color: '#3b82f6' },
  { value: 1.0, color: '#34d399' },
  { value: 2.0, color: '#facc15' },
  { value: 3.0, color: '#ef4444', label: '3+' }
];

export const WIND_SPEED_SCALE: ColorScaleItem[] = [
  { value: 0, color: '#60a5fa', label: '0' },
  { value: 10, color: '#22d3ee' },
  { value: 20, color: '#4ade80' },
  { value: 30, color: '#facc15' },
  { value: 50, color: '#f87171', label: '50+' }
];

export const CURRENT_SPEED_SCALE: ColorScaleItem[] = [
  { value: 0, color: '#93c5fd', label: '0' },
  { value: 0.2, color: '#22d3ee' },
  { value: 0.5, color: '#34d399' },
  { value: 1.0, color: '#facc15' },
  { value: 1.5, color: '#ef4444', label: '1.5+' }
];

export const SEA_TEMPERATURE_SCALE: ColorScaleItem[] = [
  { value: 10, color: '#0ea5e9', label: '10°' },
  { value: 15, color: '#38bdf8' },
  { value: 20, color: '#34d399' },
  { value: 25, color: '#facc15' },
  { value: 30, color: '#f87171', label: '30°+' }
];

// Example component showing all four positions
export function ColorScaleLegendDemo() {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="relative h-screen w-full bg-app-base">
      {/* Mock map background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-cyan-900/20" />

      {/* Toggle button */}
      <button
        onClick={() => setShowAll(!showAll)}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[500] bg-button text-white px-6 py-3 rounded-lg font-bold shadow-xl hover:bg-button-hover transition-colors"
      >
        {showAll ? 'Hide Legends' : 'Show All 4 Positions'}
      </button>

      {/* Top Left - Wind Speed */}
      {showAll && (
        <ColorScaleLegend
          scale={WIND_SPEED_SCALE}
          unit="km/h"
          title="Wind Speed"
          position="topleft"
        />
      )}

      {/* Top Right - Wave Height */}
      {showAll && (
        <ColorScaleLegend
          scale={WAVE_HEIGHT_SCALE}
          unit="m"
          title="Wave Height"
          position="topright"
        />
      )}

      {/* Bottom Left - Current Velocity */}
      {showAll && (
        <ColorScaleLegend
          scale={CURRENT_SPEED_SCALE}
          unit="m/s"
          title="Current Velocity"
          position="bottomleft"
        />
      )}

      {/* Bottom Right - Sea Temperature */}
      {showAll && (
        <ColorScaleLegend
          scale={SEA_TEMPERATURE_SCALE}
          unit="°C"
          title="Sea Temperature"
          position="bottomright"
        />
      )}
    </div>
  );
}

// Example integration with layer switching (like your MapComponent)
export function MapWithLayerLegend() {
  type LayerType = 'NONE' | 'WIND' | 'WAVE' | 'CURRENTS' | 'TEMP';
  const [activeLayer, setActiveLayer] = useState<LayerType>('NONE');

  const getLegendConfig = (layer: LayerType) => {
    switch (layer) {
      case 'WIND':
        return { scale: WIND_SPEED_SCALE, unit: 'km/h', title: 'Wind Speed' };
      case 'WAVE':
        return { scale: WAVE_HEIGHT_SCALE, unit: 'm', title: 'Wave Height' };
      case 'CURRENTS':
        return { scale: CURRENT_SPEED_SCALE, unit: 'm/s', title: 'Current Velocity' };
      case 'TEMP':
        return { scale: SEA_TEMPERATURE_SCALE, unit: '°C', title: 'Sea Temperature' };
      default:
        return null;
    }
  };

  const config = getLegendConfig(activeLayer);

  return (
    <div className="relative h-screen w-full bg-app-base">
      {/* Layer Controls */}
      <div className="absolute top-4 right-4 z-[500] bg-card border border-app rounded-lg p-3 shadow-xl">
        <h3 className="text-xs font-bold text-primary uppercase mb-2">Select Layer</h3>
        <div className="space-y-1">
          {(['NONE', 'WIND', 'WAVE', 'CURRENTS', 'TEMP'] as LayerType[]).map((layer) => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`w-full px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                activeLayer === layer
                  ? 'bg-button text-white'
                  : 'bg-elevated text-secondary hover:bg-button-secondary'
              }`}
            >
              {layer}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Legend */}
      {config && (
        <ColorScaleLegend
          scale={config.scale}
          unit={config.unit}
          title={config.title}
          position="bottomright"
        />
      )}
    </div>
  );
}

// Example with i18next translations
export function TranslatedLegendExample() {
  // This would use actual translations in your app
  const t = (key: string) => {
    const translations: Record<string, string> = {
      'map.wind': 'Wind',
      'units.kmh': 'km/h',
      // Hebrew examples
      'map.wind.he': 'רוח',
      'units.kmh.he': 'קמ״ש'
    };
    return translations[key] || key;
  };

  return (
    <div className="relative h-screen w-full bg-app-base">
      <ColorScaleLegend
        scale={WIND_SPEED_SCALE}
        unit={t('units.kmh')}
        title={t('map.wind')}
        position="bottomright"
      />
    </div>
  );
}

export default ColorScaleLegendDemo;
