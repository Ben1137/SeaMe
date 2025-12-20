/**
 * HAZARD MAP LAYER SERVICE
 * Displays nautical hazards directly on the Leaflet map
 * Integrates with existing nauticalChartService
 */

import * as L from 'leaflet';
import type { NauticalHazard } from '@seame/core';

// Hazard icon definitions
const HAZARD_ICONS = {
  reef: '🪸',
  rock: '🪨',
  wreck: '🚢',
  shallow_water: '⚠️',
  military_zone: '🚫',
  restricted_area: '⛔',
  anchorage_prohibited: '⚓',
  fishing_prohibited: '🎣',
  speed_limit: '🚤',
  traffic_separation: '➡️',
  cable_area: '🔌',
  pipeline: '🛢️',
};

const HAZARD_COLORS = {
  critical: '#ef4444', // Red-500
  danger: '#f97316',   // Orange-500
  warning: '#eab308',  // Yellow-500
  info: '#3b82f6',     // Blue-500
};

export class HazardMapLayer {
  private map: L.Map | null = null;
  private hazardLayer: L.LayerGroup | null = null;
  private markers: Map<string, L.Marker> = new Map();

  constructor(map: L.Map) {
    this.map = map;
    this.hazardLayer = L.layerGroup().addTo(map);
  }

  /**
   * Add hazards to map
   */
  addHazards(hazards: NauticalHazard[]): void {
    if (!this.map || !this.hazardLayer) return;

    // Clear existing markers
    this.clearHazards();

    hazards.forEach(hazard => {
      const marker = this.createHazardMarker(hazard);
      if (marker) {
        this.markers.set(hazard.id, marker);
        marker.addTo(this.hazardLayer!);
      }
    });
  }

  /**
   * Create a marker for a hazard
   */
  private createHazardMarker(hazard: NauticalHazard): L.Marker | null {
    const icon = HAZARD_ICONS[hazard.type] || '⚠️';
    const color = HAZARD_COLORS[hazard.severity];

    // Create custom icon
    const divIcon = L.divIcon({
      html: `
        <div class="hazard-marker" style="
          position: relative;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Pulsing ring -->
          <div style="
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: ${color};
            opacity: 0.3;
            animation: hazardPulse 2s ease-out infinite;
          "></div>

          <!-- Main circle -->
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${color};
            border: 3px solid white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.2s;
          " onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
            ${icon}
          </div>
        </div>
      `,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });

    const marker = L.marker([hazard.lat, hazard.lon], { icon: divIcon });

    // Add popup with hazard details
    const popupContent = this.createPopupContent(hazard);
    marker.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'hazard-popup',
    });

    // Add safety circle if hazard has radius
    if (hazard.radius && hazard.radius > 0) {
      const circle = L.circle([hazard.lat, hazard.lon], {
        radius: hazard.radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 5',
      });
      circle.addTo(this.hazardLayer!);
    }

    return marker;
  }

  /**
   * Create popup content for hazard
   */
  private createPopupContent(hazard: NauticalHazard): string {
    const severityLabel = hazard.severity.toUpperCase();
    const severityColor = HAZARD_COLORS[hazard.severity];
    const icon = HAZARD_ICONS[hazard.type] || '⚠️';

    let depthInfo = '';
    if (hazard.depth !== undefined) {
      depthInfo = `
        <div style="margin-top: 8px; padding: 8px; background: #f0f9ff; border-radius: 4px;">
          <strong>Depth:</strong> ${hazard.depth.toFixed(1)}m
        </div>
      `;
    }

    return `
      <div style="min-width: 200px;">
        <!-- Header -->
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 2px solid ${severityColor};
        ">
          <span style="font-size: 24px;">${icon}</span>
          <div>
            <div style="
              font-weight: bold;
              color: ${severityColor};
              font-size: 12px;
              text-transform: uppercase;
            ">${severityLabel}</div>
            <div style="font-size: 14px; font-weight: 600;">
              ${hazard.description || this.formatHazardType(hazard.type)}
            </div>
          </div>
        </div>

        <!-- Location -->
        <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
          📍 ${hazard.lat.toFixed(4)}°, ${hazard.lon.toFixed(4)}°
        </div>

        <!-- Hazard Type -->
        <div style="margin-bottom: 8px;">
          <strong>Type:</strong> ${this.formatHazardType(hazard.type)}
        </div>

        ${depthInfo}

        <!-- Safety Radius -->
        ${hazard.radius ? `
          <div style="margin-top: 8px; padding: 8px; background: #fef3c7; border-radius: 4px;">
            <strong>Safety Zone:</strong> ${hazard.radius}m radius
          </div>
        ` : ''}

        <!-- Data Source -->
        <div style="margin-top: 12px; font-size: 11px; color: #94a3b8;">
          Source: ${hazard.source.toUpperCase()}
        </div>

        <!-- Warning -->
        <div style="
          margin-top: 12px;
          padding: 8px;
          background: #fee2e2;
          border-left: 3px solid #dc2626;
          border-radius: 4px;
          font-size: 11px;
        ">
          ⚠️ <strong>Always verify with official nautical charts</strong>
        </div>
      </div>
    `;
  }

  /**
   * Format hazard type for display
   */
  private formatHazardType(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Clear all hazards from map
   */
  clearHazards(): void {
    if (this.hazardLayer) {
      this.hazardLayer.clearLayers();
    }
    this.markers.clear();
  }

  /**
   * Show/hide hazards
   */
  setVisible(visible: boolean): void {
    if (!this.map || !this.hazardLayer) return;

    if (visible) {
      if (!this.map.hasLayer(this.hazardLayer)) {
        this.hazardLayer.addTo(this.map);
      }
    } else {
      this.map.removeLayer(this.hazardLayer);
    }
  }

  /**
   * Highlight hazards near a route
   */
  highlightNearRoute(routeHazards: Array<{
    hazard: NauticalHazard;
    distanceFromRoute: number;
  }>): void {
    // First, reset all markers to normal state
    this.markers.forEach(marker => {
      const element = marker.getElement();
      if (element) {
        element.style.opacity = '0.5';
      }
    });

    // Highlight hazards near route
    routeHazards.forEach(({ hazard }) => {
      const marker = this.markers.get(hazard.id);
      if (marker) {
        const element = marker.getElement();
        if (element) {
          element.style.opacity = '1';
          element.style.animation = 'hazardPulse 1s ease-out infinite';
        }

        // Open popup automatically if critical
        if (hazard.severity === 'critical') {
          marker.openPopup();
        }
      }
    });
  }

  /**
   * Filter hazards by severity
   */
  filterBySeverity(severities: Array<'critical' | 'danger' | 'warning' | 'info'>): void {
    this.markers.forEach((marker, hazardId) => {
      const element = marker.getElement();
      if (element) {
        // This is simplified - you'd need to store hazard data with marker
        // For now, show/hide based on visual inspection
        element.style.display = 'block';
      }
    });
  }

  /**
   * Destroy the layer
   */
  destroy(): void {
    this.clearHazards();
    if (this.hazardLayer && this.map) {
      this.map.removeLayer(this.hazardLayer);
    }
    this.hazardLayer = null;
    this.map = null;
  }
}

/**
 * Inject hazard marker animations
 */
export const injectHazardStyles = (): void => {
  if (document.getElementById('hazard-map-styles')) return;

  const style = document.createElement('style');
  style.id = 'hazard-map-styles';
  style.innerHTML = `
    @keyframes hazardPulse {
      0% {
        transform: scale(1);
        opacity: 0.3;
      }
      50% {
        transform: scale(1.4);
        opacity: 0.1;
      }
      100% {
        transform: scale(1);
        opacity: 0.3;
      }
    }

    .hazard-marker {
      transition: all 0.3s ease;
    }

    .hazard-popup .leaflet-popup-content-wrapper {
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .hazard-popup .leaflet-popup-tip {
      background: white;
    }
  `;
  document.head.appendChild(style);
};
