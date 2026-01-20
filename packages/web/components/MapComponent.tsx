
import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { Coordinate, PointForecast, DetailedPointForecast, fetchPointForecast, fetchHourlyPointForecast, fetchBulkPointForecast, fetchMarineGridData, convertToVelocityFormat, generateWaveGridCells } from '@seame/core';
import { Trash2, Navigation, MapPin, Wind, Layers, Waves, X, Clock, Activity, Droplets, ChevronDown, ChevronUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { MaskedVelocityLayer } from './map/MaskedVelocityLayer';
import { WaveHeatmapLayer } from './map/WaveHeatmapLayer';
import { SmoothWaveHeatmap } from './map/SmoothWaveHeatmap';
import { RainRadarLayer } from './map/RainRadarLayer';
// import { CrispLandMask, CrispLandMaskStyles } from './map/CrispLandMask'; // Removed: SmoothWaveHeatmap now handles land clipping internally
import { ColorScaleLegend } from './map/ColorScaleLegend';
import { GeoJSONLayers } from './map/GeoJSONLayers';
import { BathymetryLayer } from './map/BathymetryLayer';
import { PortsLayer } from './map/PortsLayer';
import { ReefLayer } from './map/ReefLayer';
import { COLOR_SCALES } from '../utils/colorScales';
import { UNIFIED_PARTICLE_CONFIG, DARK_MAP_CONFIG, LAND_MASK_CONFIG } from '../utils/particleConfig';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapComponentProps {
  currentLocation: Coordinate;
}

interface RouteLeg {
  id: number;
  distance: number; // Nautical Miles
  bearing: number; // Degrees
  startIdx: number;
  endIdx: number;
}

type MapLayer = 'NONE' | 'WIND' | 'WAVE' | 'SWELL' | 'CURRENTS' | 'WIND_WAVE' | 'SIGNIFICANT_WAVE';
type AdvancedLayer = 'NONE' | 'WIND_PARTICLES' | 'CURRENT_PARTICLES' | 'WAVE_HEATMAP';

const toRad = (deg: number) => deg * Math.PI / 180;
const toDeg = (rad: number) => rad * 180 / Math.PI;

const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
  const startLatRad = toRad(startLat);
  const startLngRad = toRad(startLng);
  const destLatRad = toRad(destLat);
  const destLngRad = toRad(destLng);

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
            Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
  
  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
};

const getWindColor = (speed: number) => {
  if (speed < 10) return '#60a5fa'; // Blue-400
  if (speed < 20) return '#22d3ee'; // Cyan-400
  if (speed < 30) return '#4ade80'; // Green-400
  if (speed < 50) return '#facc15'; // Yellow-400
  return '#f87171'; // Red-400
};

const getWaveColor = (height: number) => {
  if (height < 0.5) return '#93c5fd'; // Blue-300
  if (height < 1.0) return '#3b82f6'; // Blue-500
  if (height < 2.0) return '#34d399'; // Emerald-400
  if (height < 3.0) return '#facc15'; // Yellow-400
  return '#ef4444'; // Red-500
};

const getCurrentColor = (speed: number) => {
  if (speed < 0.2) return '#93c5fd';
  if (speed < 0.5) return '#22d3ee';
  if (speed < 1.0) return '#34d399';
  if (speed < 1.5) return '#facc15';
  return '#ef4444';
};

const MapComponent: React.FC<MapComponentProps> = ({ currentLocation }) => {
  const { t } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [routeStats, setRouteStats] = useState({ count: 0, distance: 0 });
  const [legs, setLegs] = useState<RouteLeg[]>([]);
  const [speed, setSpeed] = useState<number>(15);
  const [waypointForecasts, setWaypointForecasts] = useState<Record<number, PointForecast>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('NONE');
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [gridForecasts, setGridForecasts] = useState<PointForecast[]>([]);
  const [isLayersPanelExpanded, setIsLayersPanelExpanded] = useState(false);

  // Detail View State
  const [selectedPointDetail, setSelectedPointDetail] = useState<DetailedPointForecast | null>(null);
  const [isDetailSidebarOpen, setIsDetailSidebarOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Advanced Layers State
  const [advancedLayer, setAdvancedLayer] = useState<AdvancedLayer>('NONE');
  const [velocityData, setVelocityData] = useState<L.VelocityData | null>(null);
  const [waveHeatmapData, setWaveHeatmapData] = useState<Array<{lat: number; lng: number; value: number; color: string}>>([]);
  const [loadingAdvancedLayer, setLoadingAdvancedLayer] = useState(false);

  // GeoJSON Overlay Layers State
  const [geoJSONLayers, setGeoJSONLayers] = useState({
    coastline: false,
    bathymetry: false,
    reefs: false,
    ports: false,
    marineAreas: false,
    radar: false,
  });

  useEffect(() => {
    if (mapContainer.current && !mapInstance.current) {
      // Initialize map with zoom 8 for a "Country/Region" view
      const map = L.map(mapContainer.current, {
        preferCanvas: true, // Better performance for particle layers
      }).setView([currentLocation.lat, currentLocation.lng], 8);

      // Use CartoDB Dark Matter tiles for Windy-style dark map
      L.tileLayer(DARK_MAP_CONFIG.tileUrl, {
        attribution: DARK_MAP_CONFIG.attribution,
        className: 'map-tiles',
        opacity: DARK_MAP_CONFIG.opacity,
      }).addTo(map);

      L.circleMarker([currentLocation.lat, currentLocation.lng], {
        radius: 8, fillColor: "#3b82f6", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8
      }).addTo(map).bindPopup(t('map.currentPosition'));

      mapInstance.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => addRoutePoint(e.latlng));
      
      // Listen for move end to refresh grid if layer is active
      map.on('moveend', () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
           updateWeatherGrid();
        }, 500); 
      });
      
      // Inject CSS for animations
      const style = document.createElement('style');
      style.innerHTML = `
        @keyframes windFlow {
          0% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(-3px); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.6; }
        }
        @keyframes wavePulse {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        .wind-marker svg { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }
        .wave-badge { 
             transition: all 0.3s ease;
             box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .clickable-marker { cursor: pointer; }
        .clickable-marker:hover { transform: scale(1.1); }
      `;
      document.head.appendChild(style);
    }
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    if (mapInstance.current) {
      // Maintain Zoom 8 when location changes to ensure country-level context
      mapInstance.current.setView([currentLocation.lat, currentLocation.lng], 8);
    }
  }, [currentLocation.lat, currentLocation.lng]);

  // Effect to trigger grid update when layer changes
  useEffect(() => {
      updateWeatherGrid();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer]);

  // Effect to trigger advanced layer update when advanced layer changes
  // Debounced to prevent rapid API calls when switching layers quickly
  useEffect(() => {
      console.log('[MapComponent] Advanced layer changed to:', advancedLayer);

      // Debounce layer switching to prevent rapid API calls
      // Using 1500ms debounce to give time for other API requests to complete
      // and avoid hitting Open-Meteo's rate limits
      const timeoutId = setTimeout(() => {
          console.log('[MapComponent] Debounce timeout completed, calling updateAdvancedLayer');
          updateAdvancedLayer();
      }, 1500); // 1500ms debounce to prevent API rate limiting

      // Cleanup: cancel the timeout if layer changes again before timeout completes
      return () => {
          console.log('[MapComponent] Cleaning up debounce timeout');
          clearTimeout(timeoutId);
      };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedLayer]);

  // Debug logging for velocityData changes
  useEffect(() => {
      console.log('[MapComponent] velocityData state changed:', velocityData);
      console.log('[MapComponent] velocityData is null:', velocityData === null);
      console.log('[MapComponent] velocityData is undefined:', velocityData === undefined);
      if (velocityData) {
          console.log('[MapComponent] velocityData type:', Array.isArray(velocityData) ? 'array' : typeof velocityData);
      }
  }, [velocityData]);

  const updateWeatherGrid = async () => {
      if (!mapInstance.current || !layerGroupRef.current) return;

      // Clear existing grid markers
      layerGroupRef.current.clearLayers();

      if (activeLayer === 'NONE') return;

      setLoadingGrid(true);
      const bounds = mapInstance.current.getBounds();
      const west = bounds.getWest();
      const east = bounds.getEast();
      const north = bounds.getNorth();
      const south = bounds.getSouth();

      // Generate a grid focused on the visible marine area
      const gridPoints: Coordinate[] = [];
      const cols = 4;
      const rows = 4;

      const lngStep = (east - west) / cols;
      const latStep = (north - south) / rows;

      for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
              gridPoints.push({
                  lat: north - latStep * (r + 0.5),
                  lng: west + lngStep * (c + 0.5)
              });
          }
      }

      try {
          // Use Bulk Fetch API
          const forecasts = await fetchBulkPointForecast(gridPoints);

          // Filter out points with effectively 0 wave height (land)
          const marineForecasts = forecasts.filter(f => f.waveHeight > 0.05);

          renderGridMarkers(marineForecasts);
      } catch (e) {
          console.error("Failed to fetch grid", e);
      } finally {
          setLoadingGrid(false);
      }
  };

  // Ref to track if an advanced layer update is in progress
  const advancedLayerUpdateInProgress = useRef(false);

  const updateAdvancedLayer = async () => {
      console.log('[MapComponent] updateAdvancedLayer called, advancedLayer:', advancedLayer);

      if (!mapInstance.current) {
          console.log('[MapComponent] No map instance, returning');
          return;
      }

      if (advancedLayer === 'NONE') {
          console.log('[MapComponent] Setting layers to null');
          setVelocityData(null);
          setWaveHeatmapData([]);
          return;
      }

      // Prevent duplicate API calls
      if (advancedLayerUpdateInProgress.current) {
          console.log('[MapComponent] Advanced layer update already in progress, skipping');
          return;
      }

      advancedLayerUpdateInProgress.current = true;
      setLoadingAdvancedLayer(true);

      // Clear previous data first to ensure clean layer transition
      setVelocityData(null);
      setWaveHeatmapData([]);

      // Small delay to allow React to clean up the previous layer
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
          const bounds = mapInstance.current.getBounds();
          const boundingBox = {
              north: bounds.getNorth(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              west: bounds.getWest()
          };
          console.log('[MapComponent] Bounding box:', boundingBox);

          // Fetch grid data with higher resolution for better sea coverage
          // Using different resolutions based on layer type
          // Wave heatmap uses higher resolution for smoother interpolation
          // Note: 16x16 = 256 points is safe for API URL limits
          const resolution = advancedLayer === 'WAVE_HEATMAP'
              ? { latPoints: 16, lngPoints: 16 }  // 256 points - higher for smooth heatmap coverage
              : { latPoints: 12, lngPoints: 12 }; // 144 points for particles

          console.log('[MapComponent] Fetching grid data with resolution:', resolution);
          const gridData = await fetchMarineGridData(boundingBox, resolution);
          console.log('[MapComponent] Grid data received:', gridData);
          console.log('[MapComponent] Grid data points count:', gridData?.points?.length);

          if (advancedLayer === 'WIND_PARTICLES') {
              console.log('[MapComponent] Converting to wind velocity format...');
              const velocityField = convertToVelocityFormat(gridData, 'wind');
              console.log('[MapComponent] Velocity field:', velocityField);
              console.log('[MapComponent] Velocity field.wind:', velocityField.wind);
              console.log('[MapComponent] Velocity field.wind type:', Array.isArray(velocityField.wind) ? 'array' : typeof velocityField.wind);
              if (velocityField.wind) {
                  console.log('[MapComponent] Wind data[0]:', velocityField.wind[0]);
                  console.log('[MapComponent] Wind data[1]:', velocityField.wind[1]);

                  // DETAILED DIAGNOSTIC LOGGING
                  console.log('[MapComponent] === WIND DATA DETAILED STRUCTURE ===');
                  console.log('[MapComponent] Wind data[0] header:', {
                    parameterCategory: velocityField.wind[0]?.header?.parameterCategory,
                    parameterNumber: velocityField.wind[0]?.header?.parameterNumber,
                    nx: velocityField.wind[0]?.header?.nx,
                    ny: velocityField.wind[0]?.header?.ny,
                    lo1: velocityField.wind[0]?.header?.lo1,
                    la1: velocityField.wind[0]?.header?.la1,
                    lo2: velocityField.wind[0]?.header?.lo2,
                    la2: velocityField.wind[0]?.header?.la2,
                    dx: velocityField.wind[0]?.header?.dx,
                    dy: velocityField.wind[0]?.header?.dy,
                    refTime: velocityField.wind[0]?.header?.refTime,
                    forecastTime: velocityField.wind[0]?.header?.forecastTime,
                    parameterNumberName: velocityField.wind[0]?.header?.parameterNumberName,
                  });
                  console.log('[MapComponent] Wind data[0] values:', {
                    dataIsArray: Array.isArray(velocityField.wind[0]?.data),
                    dataLength: velocityField.wind[0]?.data?.length,
                    dataSample: velocityField.wind[0]?.data?.slice(0, 5),
                  });

                  console.log('[MapComponent] Wind data[1] header:', {
                    parameterCategory: velocityField.wind[1]?.header?.parameterCategory,
                    parameterNumber: velocityField.wind[1]?.header?.parameterNumber,
                    nx: velocityField.wind[1]?.header?.nx,
                    ny: velocityField.wind[1]?.header?.ny,
                    lo1: velocityField.wind[1]?.header?.lo1,
                    la1: velocityField.wind[1]?.header?.la1,
                    lo2: velocityField.wind[1]?.header?.lo2,
                    la2: velocityField.wind[1]?.header?.la2,
                    dx: velocityField.wind[1]?.header?.dx,
                    dy: velocityField.wind[1]?.header?.dy,
                    refTime: velocityField.wind[1]?.header?.refTime,
                    forecastTime: velocityField.wind[1]?.header?.forecastTime,
                    parameterNumberName: velocityField.wind[1]?.header?.parameterNumberName,
                  });
                  console.log('[MapComponent] Wind data[1] values:', {
                    dataIsArray: Array.isArray(velocityField.wind[1]?.data),
                    dataLength: velocityField.wind[1]?.data?.length,
                    dataSample: velocityField.wind[1]?.data?.slice(0, 5),
                  });

                  console.log('[MapComponent] Parameter Number Check:');
                  console.log('  [0] parameterCategory=', velocityField.wind[0]?.header?.parameterCategory, 'parameterNumber=', velocityField.wind[0]?.header?.parameterNumber, '-> Should be "2,2" for U-component');
                  console.log('  [1] parameterCategory=', velocityField.wind[1]?.header?.parameterCategory, 'parameterNumber=', velocityField.wind[1]?.header?.parameterNumber, '-> Should be "2,3" for V-component');
              }
              setVelocityData(velocityField.wind);
          } else if (advancedLayer === 'CURRENT_PARTICLES') {
              console.log('[MapComponent] Converting to current velocity format...');
              const velocityField = convertToVelocityFormat(gridData, 'current');
              console.log('[MapComponent] Velocity field:', velocityField);
              console.log('[MapComponent] Velocity field.current:', velocityField.current);

              // Check if there's actual current data (not all zeros)
              const hasCurrentData = gridData.points.some((p: any) => p.currentSpeed > 0.001);
              console.log('[MapComponent] Has non-zero current data:', hasCurrentData);

              // DETAILED DIAGNOSTIC LOGGING FOR CURRENTS
              if (velocityField.current) {
                  const uData = velocityField.current[0]?.data || [];
                  const vData = velocityField.current[1]?.data || [];
                  const hasNonZeroU = uData.some((v: number) => Math.abs(v) > 0.001);
                  const hasNonZeroV = vData.some((v: number) => Math.abs(v) > 0.001);

                  console.log('[MapComponent] === CURRENT DATA DETAILED STRUCTURE ===');
                  console.log('[MapComponent] U-component has non-zero values:', hasNonZeroU);
                  console.log('[MapComponent] V-component has non-zero values:', hasNonZeroV);
                  console.log('[MapComponent] U data sample:', uData.slice(0, 10));
                  console.log('[MapComponent] V data sample:', vData.slice(0, 10));

                  // Check if grid data has current data
                  console.log('[MapComponent] Grid points current data check:', gridData.points.slice(0, 5).map((p: any) => ({
                      lat: p.lat.toFixed(2),
                      lng: p.lng.toFixed(2),
                      currentSpeed: p.currentSpeed,
                      currentDirection: p.currentDirection,
                      currentU: p.currentU?.toFixed(4),
                      currentV: p.currentV?.toFixed(4)
                  })));

                  if (!hasNonZeroU && !hasNonZeroV) {
                      console.warn('[MapComponent] ⚠️ No ocean current data available for this region');
                      console.warn('[MapComponent] Open-Meteo Marine API may not have current data for this area');
                  }
              }

              setVelocityData(velocityField.current);
          } else if (advancedLayer === 'WAVE_HEATMAP') {
              console.log('[MapComponent] Generating wave grid cells...');
              const waveGrid = generateWaveGridCells(gridData, 'wave');
              console.log('[MapComponent] Wave grid:', waveGrid);
              console.log('[MapComponent] Wave grid cells count:', waveGrid?.cells?.length);

              // Filter out land points with balanced ocean detection
              // A point is considered ocean if:
              // 1. Wave height > 0.15m (balanced threshold for good coverage)
              // 2. OR it has ocean current data (currentSpeed > 0)
              const marineCells = waveGrid.cells.filter((cell, index) => {
                  const point = gridData.points[index];
                  const hasWaveActivity = cell.value > 0.1;
                  const hasCurrentData = (point?.currentSpeed || 0) > 0.01;
                  return hasWaveActivity || hasCurrentData;
              });
              console.log('[MapComponent] Marine cells after filtering:', marineCells.length);
              console.log('[MapComponent] Filtered out land cells:', waveGrid.cells.length - marineCells.length);
              setWaveHeatmapData(marineCells);
          }
      } catch (error) {
          console.error('[MapComponent] Failed to fetch advanced layer data:', error);
          console.error('[MapComponent] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      } finally {
          setLoadingAdvancedLayer(false);
          advancedLayerUpdateInProgress.current = false;
      }
  };

  const handlePointClick = async (lat: number, lng: number) => {
     setLoadingDetail(true);
     setIsDetailSidebarOpen(true);
     // Close route sidebar if open to prevent overlap
     setIsSidebarOpen(false);

     const data = await fetchHourlyPointForecast(lat, lng);
     setSelectedPointDetail(data);
     setLoadingDetail(false);
  };

  const renderGridMarkers = (points: PointForecast[]) => {
      if (!layerGroupRef.current) return;

      points.forEach(pt => {
          let iconHtml = '';
          
          if (activeLayer === 'WIND') {
              const color = getWindColor(pt.windSpeed);
              iconHtml = `
                <div class="clickable-marker" style="transform: rotate(${pt.windDirection}deg); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                   <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="wind-marker" style="animation: windFlow 2s infinite ease-in-out;">
                      <line x1="12" y1="19" x2="12" y2="5"></line>
                      <polyline points="5 12 12 5 19 12"></polyline>
                   </svg>
                   <div style="transform: rotate(-${pt.windDirection}deg); text-align: center; font-size: 10px; font-weight: 800; color: white; text-shadow: 0 1px 3px black; margin-top: -6px;">
                      ${Math.round(pt.windSpeed)}
                   </div>
                </div>
              `;
          } else if (activeLayer === 'WAVE' || activeLayer === 'SIGNIFICANT_WAVE') {
              const color = getWaveColor(pt.waveHeight);
              const period = pt.wavePeriod ? `${pt.wavePeriod.toFixed(0)}s` : '';
              iconHtml = `
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <div class="clickable-marker wave-badge" style="
                        background: ${color}; 
                        width: 32px; height: 32px; 
                        border-radius: 50%; border: 2px solid white; 
                        display: flex; align-items: center; justify-content: center; 
                        color: ${color}; font-weight: 800; font-size: 11px;
                        color: ${color};
                        animation: wavePulse 2s infinite;
                    ">
                       <div style="background:white; width: 24px; height: 24px; border-radius:50%; display:flex; align-items:center; justify-content:center;">
                          ${pt.waveHeight.toFixed(1)}
                       </div>
                    </div>
                    ${period ? `<div style="margin-top:2px; font-size:9px; color:#cbd5e1; font-weight:bold; background:rgba(15,23,42,0.7); padding:0 3px; rounded:4px;">${period}</div>` : ''}
                </div>
              `;
          } else if (activeLayer === 'WIND_WAVE' || activeLayer === 'SWELL') {
             let height = 0;
             let direction = 0;
             let period = 0;
             
             if (activeLayer === 'WIND_WAVE') {
                 height = pt.windWaveHeight || 0;
                 direction = pt.windWaveDirection || 0;
                 period = pt.windWavePeriod || 0;
             } else {
                 height = pt.swellHeight || 0;
                 direction = pt.swellDirection || 0;
                 period = pt.swellPeriod || 0;
             }
             
             const color = getWaveColor(height);
             
             iconHtml = `
                <div class="clickable-marker" style="transform: rotate(${direction}deg); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                   <svg width="32" height="32" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="12 2 22 22 12 18 2 22 12 2"></polygon>
                   </svg>
                   <div style="transform: rotate(-${direction}deg); text-align: center; font-size: 9px; font-weight: 800; color: ${color}; text-shadow: 0 1px 3px black; display: flex; flex-direction: column; align-items: center;">
                      <span>${height.toFixed(1)}m</span>
                      <span style="font-size: 8px; color: #cbd5e1;">${period.toFixed(0)}s</span>
                   </div>
                </div>
             `;
          } else if (activeLayer === 'CURRENTS') {
              const color = getCurrentColor(pt.currentSpeed || 0);
              const speed = pt.currentSpeed?.toFixed(1) || '0.0';
              const dir = pt.currentDirection || 0;
              iconHtml = `
                <div class="clickable-marker" style="transform: rotate(${dir}deg); display: flex; flex-direction: column; align-items: center; justify-content: center;">
                   <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 2L15 22L12 18L9 22L12 2Z" fill="${color}" fill-opacity="0.3"></path>
                   </svg>
                   <div style="transform: rotate(-${dir}deg); text-align: center; font-size: 10px; font-weight: 800; color: #f0abfc; text-shadow: 0 1px 3px black; margin-top: -6px;">
                      ${speed}
                   </div>
                </div>
              `;
          }

          const icon = L.divIcon({
              className: `custom-weather-icon`,
              html: iconHtml,
              iconSize: [36, 36],
              iconAnchor: [18, 18]
          });

          const marker = L.marker([pt.lat, pt.lng], { icon }).addTo(layerGroupRef.current!);
          
          // Add click listener
          marker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              handlePointClick(pt.lat, pt.lng);
          });
      });
  };

  const addRoutePoint = async (latlng: L.LatLng) => {
    if (!mapInstance.current) return;

    // Add marker
    const marker = L.marker(latlng, { draggable: true }).addTo(mapInstance.current);
    marker.bindPopup(t('map.waypoint') + ` ${markersRef.current.length + 1}`).openPopup();
    
    // Update marker ref
    markersRef.current.push(marker);
    
    // Draw/Update Polyline
    const latlngs = markersRef.current.map(m => m.getLatLng());
    if (routeLineRef.current) {
      routeLineRef.current.setLatLngs(latlngs);
    } else {
      routeLineRef.current = L.polyline(latlngs, { color: '#3b82f6', weight: 4, dashArray: '10, 10' }).addTo(mapInstance.current);
    }

    // Calculate Route Stats
    calculateRouteStats(latlngs);

    // Fetch Weather for this point
    const forecast = await fetchPointForecast(latlng.lat, latlng.lng);
    setWaypointForecasts(prev => ({ ...prev, [markersRef.current.length - 1]: forecast }));

    // Auto-open route sidebar only on 2nd waypoint
    if (markersRef.current.length === 2) {
      setIsSidebarOpen(true);
      setIsDetailSidebarOpen(false); // Close detail sidebar
    }
  };

  const calculateRouteStats = (latlngs: L.LatLng[]) => {
    let dist = 0;
    const newLegs: RouteLeg[] = [];

    for (let i = 0; i < latlngs.length - 1; i++) {
      // Distance in Meters
      const d = latlngs[i].distanceTo(latlngs[i+1]);
      // Convert to Nautical Miles (1 NM = 1852 meters)
      const distNM = d / 1852;
      dist += distNM;

      // Calculate Bearing
      const bearing = calculateBearing(latlngs[i].lat, latlngs[i].lng, latlngs[i+1].lat, latlngs[i+1].lng);

      newLegs.push({
        id: i,
        distance: parseFloat(distNM.toFixed(1)),
        bearing: parseFloat(bearing.toFixed(0)),
        startIdx: i,
        endIdx: i + 1
      });
    }

    setRouteStats({
      count: latlngs.length,
      distance: parseFloat(dist.toFixed(1))
    });
    setLegs(newLegs);
  };

  const clearRoute = () => {
    if (!mapInstance.current) return;
    
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
    
    setRouteStats({ count: 0, distance: 0 });
    setLegs([]);
    setWaypointForecasts({});
    setIsSidebarOpen(false);
  };

  // Prepare chart data for Detail Sidebar
  const detailChartData = selectedPointDetail ? selectedPointDetail.hourly.time.map((t, i) => ({
      time: format(parseISO(t), 'HH:mm'),
      windSpeed: selectedPointDetail.hourly.windSpeed[i],
      waveHeight: selectedPointDetail.hourly.waveHeight[i],
      swellHeight: selectedPointDetail.hourly.swellHeight[i],
      currentSpeed: selectedPointDetail.hourly.currentSpeed?.[i] || 0
  })) : [];

  return (
    <div className="relative h-full w-full bg-card overflow-hidden">
      {/* Map Container with dark background */}
      <div
        ref={mapContainer}
        className="absolute inset-0 z-0"
        style={{ backgroundColor: DARK_MAP_CONFIG.backgroundColor }}
      />

      {/* Map Layer Controls */}
      <div className="absolute top-4 right-4 z-[400] bg-elevated backdrop-blur border border-app rounded-lg shadow-xl text-xs w-36 animate-in fade-in slide-in-from-right-4 overflow-hidden">
          <button
            onClick={() => setIsLayersPanelExpanded(!isLayersPanelExpanded)}
            className="w-full flex items-center justify-between gap-2 p-2 border-b border-subtle text-secondary font-bold uppercase bg-elevated hover:bg-hover transition-colors cursor-pointer"
          >
              <div className="flex items-center gap-2">
                <Layers size={14} /> {t('map.mapLayers')}
              </div>
              {isLayersPanelExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <div
            className="transition-all duration-300 ease-in-out overflow-hidden overflow-y-auto"
            style={{
              maxHeight: isLayersPanelExpanded ? '70vh' : '0',
              opacity: isLayersPanelExpanded ? 1 : 0
            }}
          >
            <div className="space-y-1 p-2">
               <button
                 onClick={() => setActiveLayer('NONE')}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${activeLayer === 'NONE' ? 'bg-button-secondary text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <div className={`w-2 h-2 rounded-full border ${activeLayer === 'NONE' ? 'border-primary bg-transparent' : 'border-muted'}`}></div> {t('map.none')}
               </button>
               <button
                 onClick={() => setActiveLayer('WIND')}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${activeLayer === 'WIND' ? 'bg-blue-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Wind size={12} /> {t('map.wind')}
               </button>
               <button
                 onClick={() => setActiveLayer('WAVE')}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${activeLayer === 'WAVE' ? 'bg-teal-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Waves size={12} /> {t('map.sigWaves')}
               </button>
               <button
                 onClick={() => setActiveLayer('WIND_WAVE')}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${activeLayer === 'WIND_WAVE' ? 'bg-cyan-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Waves size={12} /> {t('map.windWaves')}
               </button>
               <button
                 onClick={() => setActiveLayer('SWELL')}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${activeLayer === 'SWELL' ? 'bg-indigo-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Waves size={12} /> {t('weather.swell')}
               </button>
               <button
                 onClick={() => setActiveLayer('CURRENTS')}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${activeLayer === 'CURRENTS' ? 'bg-emerald-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Activity size={12} /> {t('map.currents')}
               </button>

               {/* Divider for Advanced Layers */}
               <div className="border-t border-subtle my-2 pt-2">
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 px-2">Advanced Layers</div>
               </div>

               <button
                 onClick={() => setAdvancedLayer(advancedLayer === 'WIND_PARTICLES' ? 'NONE' : 'WIND_PARTICLES')}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${advancedLayer === 'WIND_PARTICLES' ? 'bg-purple-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Wind size={12} /> Wind Particles
               </button>
               <button
                 onClick={() => setAdvancedLayer(advancedLayer === 'CURRENT_PARTICLES' ? 'NONE' : 'CURRENT_PARTICLES')}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${advancedLayer === 'CURRENT_PARTICLES' ? 'bg-violet-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Activity size={12} /> Current Particles
               </button>
               <button
                 onClick={() => setAdvancedLayer(advancedLayer === 'WAVE_HEATMAP' ? 'NONE' : 'WAVE_HEATMAP')}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${advancedLayer === 'WAVE_HEATMAP' ? 'bg-pink-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Waves size={12} /> Wave Heatmap
               </button>

               {/* Divider for GeoJSON Overlay Layers */}
               <div className="border-t border-subtle my-2 pt-2">
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 px-2">{t('map.geoJSONLayers') || 'Map Overlays'}</div>
               </div>

               {/* Coastline Toggle */}
               <button
                 onClick={() => setGeoJSONLayers(prev => ({ ...prev, coastline: !prev.coastline }))}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${geoJSONLayers.coastline ? 'bg-cyan-700 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <MapPin size={12} /> {t('map.coastline') || 'Coastline'}
               </button>

               {/* Bathymetry Toggle */}
               <button
                 onClick={() => setGeoJSONLayers(prev => ({ ...prev, bathymetry: !prev.bathymetry }))}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${geoJSONLayers.bathymetry ? 'bg-blue-700 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Droplets size={12} /> {t('map.bathymetry') || 'Bathymetry'}
               </button>

               {/* Reefs Toggle */}
               <button
                 onClick={() => setGeoJSONLayers(prev => ({ ...prev, reefs: !prev.reefs }))}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${geoJSONLayers.reefs ? 'bg-orange-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Waves size={12} /> {t('map.reefs') || 'Coral Reefs'}
               </button>

               {/* Ports Toggle */}
               <button
                 onClick={() => setGeoJSONLayers(prev => ({ ...prev, ports: !prev.ports }))}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${geoJSONLayers.ports ? 'bg-amber-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Navigation size={12} /> {t('map.ports') || 'Ports'}
               </button>

               {/* Marine Areas Toggle */}
               <button
                 onClick={() => setGeoJSONLayers(prev => ({ ...prev, marineAreas: !prev.marineAreas }))}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${geoJSONLayers.marineAreas ? 'bg-purple-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <MapPin size={12} /> {t('map.marineAreas') || 'Marine Areas'}
               </button>

               {/* Rain Radar Toggle */}
               <button
                 onClick={() => setGeoJSONLayers(prev => ({ ...prev, radar: !prev.radar }))}
                 className={`w-full text-left px-2 py-1.5 rounded flex items-center gap-2 transition-colors ${geoJSONLayers.radar ? 'bg-sky-600 text-primary' : 'text-muted hover:bg-hover'}`}
               >
                  <Droplets size={12} /> {t('map.rainRadar') || 'Rain Radar'}
               </button>
            </div>
            {(loadingGrid || loadingAdvancedLayer) && (
               <div className="pb-2 px-2 text-[10px] text-center text-blue-300 animate-pulse">{t('map.updatingForecast')}</div>
            )}
          </div>
      </div>

      {/* Sidebar Toggle Strip (Left) */}
      {!isSidebarOpen && legs.length > 0 && (
         <button
            onClick={() => { setIsSidebarOpen(true); setIsDetailSidebarOpen(false); }}
            className="absolute left-0 top-1/2 -translate-y-1/2 h-32 w-6 bg-elevated border-y border-r border-app rounded-r-xl flex items-center justify-center cursor-pointer hover:bg-button-secondary z-[400] shadow-xl transition-colors"
         >
            <div className="rotate-90 text-[10px] uppercase font-bold text-muted tracking-widest whitespace-nowrap">{t('map.routeInfo')}</div>
         </button>
      )}

      {/* Route Sidebar */}
      {isSidebarOpen && (
        <div className="absolute top-0 left-0 bottom-0 w-80 bg-card/95 backdrop-blur shadow-2xl border-r border-app z-[500] flex flex-col animate-in slide-in-from-left duration-300">
           {/* Header */}
           <div className="p-4 border-b border-app flex justify-between items-center bg-card">
              <div>
                 <h2 className="font-bold text-primary flex items-center gap-2"><Navigation size={18} className="text-accent"/> {t('map.routePlan')}</h2>
                 <p className="text-[10px] text-muted uppercase tracking-wider">{routeStats.count} {t('map.waypoints')} • {routeStats.distance} {t('units.nm')}</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-hover rounded text-muted transition-colors"><X size={20}/></button>
           </div>

           {/* Speed Control */}
           <div className="p-4 bg-elevated border-b border-app">
              <label className="text-xs text-secondary flex justify-between mb-2">
                  {t('map.avgSpeed')}: <span className="text-primary font-bold">{speed} {t('units.knots')}</span>
              </label>
              <input type="range" min="1" max="40" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} className="w-full h-1 bg-button-secondary rounded-lg appearance-none cursor-pointer" style={{ accentColor: 'var(--text-accent)' }} />
              <div className="flex justify-between text-[10px] text-muted mt-1">
                 <span>1 {t('units.knots')}</span><span>40 {t('units.knots')}</span>
              </div>
           </div>

           {/* Legs List */}
           <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {legs.map((leg, idx) => {
                 // Forecast at start of leg
                 const forecast = waypointForecasts[leg.startIdx];
                 const time = (leg.distance / speed) * 60; // minutes

                 return (
                   <div key={leg.id} className="bg-elevated border border-app rounded-lg p-3 relative group">
                      <div className="flex justify-between items-start mb-2">
                         <div className="text-xs font-bold text-primary">{t('map.leg')} {idx + 1}</div>
                         <div className="text-[10px] text-muted">{leg.distance} {t('units.nm')} @ {leg.bearing}°</div>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                         <div className="flex-1 h-1 bg-button-secondary rounded-full overflow-hidden">
                            <div className="h-full bg-accent w-1/2"></div>
                         </div>
                         <div className="text-[10px] text-accent font-mono">~{Math.round(time)}{t('units.minutes')}</div>
                      </div>

                      {forecast && (
                         <div className="grid grid-cols-2 gap-2 text-[10px] bg-card p-2 rounded border border-subtle">
                             <div className="flex items-center gap-1 text-secondary">
                                <Waves size={10} className="text-accent"/> {forecast.waveHeight.toFixed(1)}{t('units.meters')}
                             </div>
                             <div className="flex items-center gap-1 text-secondary">
                                <Wind size={10} className="text-accent"/> {forecast.windSpeed.toFixed(0)} {t('units.knots')}
                             </div>
                         </div>
                      )}

                      <div className="absolute left-[-18px] top-1/2 -translate-y-1/2 w-4 flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-accent border-2 border-card"></div>
                          {idx < legs.length - 1 && <div className="w-0.5 h-full bg-button-secondary my-1"></div>}
                      </div>
                   </div>
                 );
              })}
           </div>

           {/* Footer */}
           <div className="p-4 border-t border-app bg-card">
              <button onClick={clearRoute} className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                  <Trash2 size={14} /> {t('map.clearRoute')}
              </button>
           </div>
        </div>
      )}

      {/* Point Detail Sidebar */}
      {isDetailSidebarOpen && (
          <div className="absolute top-0 right-0 bottom-0 w-96 bg-card/95 backdrop-blur shadow-2xl border-l border-app z-[500] flex flex-col animate-in slide-in-from-right duration-300">
               <div className="p-4 border-b border-app flex justify-between items-center bg-card">
                  <div>
                     <h2 className="font-bold text-primary flex items-center gap-2"><Activity size={18} className="text-teal-400"/> {t('map.pointForecast')}</h2>
                     <p className="text-[10px] text-muted uppercase tracking-wider">
                         {selectedPointDetail ? `${selectedPointDetail.lat.toFixed(4)}N, ${selectedPointDetail.lng.toFixed(4)}E` : t('map.loadingData')}
                     </p>
                  </div>
                  <button onClick={() => setIsDetailSidebarOpen(false)} className="p-1 hover:bg-hover rounded text-muted transition-colors"><X size={20}/></button>
               </div>

               {loadingDetail ? (
                   <div className="flex-1 flex items-center justify-center text-blue-400 animate-pulse">
                       <Clock size={32} className="animate-spin mr-2" /> {t('map.loadingData')}
                   </div>
               ) : selectedPointDetail && (
                   <div className="flex-1 overflow-y-auto p-4 space-y-6">
                       
                       {/* Wave & Swell Chart - Show for Wave/Swell layers or by default if no specific layer */}
                       {(activeLayer === 'WAVE' || activeLayer === 'SWELL' || activeLayer === 'SIGNIFICANT_WAVE' || activeLayer === 'WIND_WAVE' || activeLayer === 'NONE') && (
                           <div className="bg-elevated/50 rounded-xl p-4 border border-app animate-in fade-in slide-in-from-right-8">
                               <h3 className="text-xs font-bold text-secondary uppercase mb-4 flex items-center gap-2"><Waves size={14}/> {t('map.waveSwellHeight')}</h3>
                               <div className="h-40 w-full min-h-[160px]">
                                   <ResponsiveContainer width="100%" height="100%">
                                       <AreaChart data={detailChartData}>
                                           <defs>
                                               <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                                                   <stop offset="5%" stopColor="var(--chart-tertiary)" stopOpacity={0.3}/>
                                                   <stop offset="95%" stopColor="var(--chart-tertiary)" stopOpacity={0}/>
                                               </linearGradient>
                                                <linearGradient id="swellGrad" x1="0" y1="0" x2="0" y2="1">
                                                   <stop offset="5%" stopColor="var(--chart-secondary)" stopOpacity={0.3}/>
                                                   <stop offset="95%" stopColor="var(--chart-secondary)" stopOpacity={0}/>
                                               </linearGradient>
                                           </defs>
                                           <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                                           <XAxis dataKey="time" stroke="var(--chart-text)" fontSize={10} tickLine={false} axisLine={false} interval={4} />
                                           <YAxis stroke="var(--chart-text)" fontSize={10} tickLine={false} axisLine={false} />
                                           <Tooltip
                                               contentStyle={{ backgroundColor: 'var(--app-bg-card)', borderColor: 'var(--app-border)' }}
                                               itemStyle={{ color: 'var(--text-secondary)' }}
                                               labelStyle={{ color: 'var(--text-muted)' }}
                                           />
                                           <Area type="monotone" dataKey="waveHeight" stroke="var(--chart-tertiary)" fill="url(#waveGrad)" strokeWidth={2} name={t('weather.waveHeight')} />
                                           <Area type="monotone" dataKey="swellHeight" stroke="var(--chart-secondary)" fill="url(#swellGrad)" strokeWidth={2} name={t('weather.swell')} />
                                       </AreaChart>
                                   </ResponsiveContainer>
                               </div>
                           </div>
                       )}

                       {/* Wind Chart - Show for Wind layer or None */}
                       {(activeLayer === 'WIND' || activeLayer === 'NONE') && (
                           <div className="bg-elevated/50 rounded-xl p-4 border border-app animate-in fade-in slide-in-from-right-10">
                               <h3 className="text-xs font-bold text-secondary uppercase mb-4 flex items-center gap-2"><Wind size={14}/> {t('map.windSpeedChart')}</h3>
                               <div className="h-40 w-full min-h-[160px]">
                                   <ResponsiveContainer width="100%" height="100%">
                                       <AreaChart data={detailChartData}>
                                           <defs>
                                               <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
                                                   <stop offset="5%" stopColor="var(--chart-primary)" stopOpacity={0.3}/>
                                                   <stop offset="95%" stopColor="var(--chart-primary)" stopOpacity={0}/>
                                               </linearGradient>
                                           </defs>
                                           <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                                           <XAxis dataKey="time" stroke="var(--chart-text)" fontSize={10} tickLine={false} axisLine={false} interval={4} />
                                           <YAxis stroke="var(--chart-text)" fontSize={10} tickLine={false} axisLine={false} />
                                           <Tooltip
                                               contentStyle={{ backgroundColor: 'var(--app-bg-card)', borderColor: 'var(--app-border)' }}
                                               itemStyle={{ color: 'var(--text-secondary)' }}
                                               labelStyle={{ color: 'var(--text-muted)' }}
                                           />
                                           <Area type="monotone" dataKey="windSpeed" stroke="var(--chart-primary)" fill="url(#windGrad)" strokeWidth={2} name={t('weather.windSpeed')} />
                                       </AreaChart>
                                   </ResponsiveContainer>
                               </div>
                           </div>
                       )}

                       {/* Currents Chart - Show if Currents Layer or None */}
                       {(activeLayer === 'CURRENTS' || activeLayer === 'NONE') && (
                           <div className="bg-elevated/50 rounded-xl p-4 border border-app animate-in fade-in slide-in-from-right-8">
                               <h3 className="text-xs font-bold text-secondary uppercase mb-4 flex items-center gap-2"><Activity size={14}/> {t('map.currentVelocity')}</h3>
                               <div className="h-40 w-full min-h-[160px]">
                                   <ResponsiveContainer width="100%" height="100%">
                                       <AreaChart data={detailChartData}>
                                           <defs>
                                               <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
                                                   <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                   <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                               </linearGradient>
                                           </defs>
                                           <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                                           <XAxis dataKey="time" stroke="var(--chart-text)" fontSize={10} tickLine={false} axisLine={false} interval={4} />
                                           <YAxis stroke="var(--chart-text)" fontSize={10} tickLine={false} axisLine={false} />
                                           <Tooltip
                                               contentStyle={{ backgroundColor: 'var(--app-bg-card)', borderColor: 'var(--app-border)' }}
                                               itemStyle={{ color: 'var(--text-secondary)' }}
                                               labelStyle={{ color: 'var(--text-muted)' }}
                                           />
                                           <Area type="monotone" dataKey="currentSpeed" stroke="#10b981" fill="url(#currentGrad)" strokeWidth={2} name={t('map.currents')} />
                                       </AreaChart>
                                   </ResponsiveContainer>
                               </div>
                           </div>
                       )}
                   </div>
               )}
          </div>
      )}

      {/* GeoJSON Overlay Layers */}
      <GeoJSONLayers
        map={mapInstance.current}
        visibleLayers={geoJSONLayers}
        opacity={0.8}
      />

      {/* Bathymetry Layer (dedicated component for depth contours) */}
      <BathymetryLayer
        map={mapInstance.current}
        visible={geoJSONLayers.bathymetry}
        opacity={0.6}
        depths={[200, 1000, 2000, 3000]}
      />

      {/* Ports Layer (with clustering) */}
      <PortsLayer
        map={mapInstance.current}
        visible={geoJSONLayers.ports}
      />

      {/* Reef Layer */}
      <ReefLayer
        map={mapInstance.current}
        visible={geoJSONLayers.reefs}
        opacity={0.7}
      />

      {/* Rain Radar Layer */}
      <RainRadarLayer
        map={mapInstance.current}
        visible={geoJSONLayers.radar}
        opacity={0.5}
        animated={true}
        animationSpeed={600}
      />

      {/* Advanced Visualization Layers - Using MaskedVelocityLayer for sea-only rendering */}
      {advancedLayer === 'WIND_PARTICLES' && (
        <MaskedVelocityLayer
          data={velocityData}
          type="wind"
          visible={true}
          map={mapInstance.current}
          maxVelocity={50}
          particleMultiplier={UNIFIED_PARTICLE_CONFIG.particleMultiplier}
          velocityScale={UNIFIED_PARTICLE_CONFIG.velocityScale}
          lineWidth={UNIFIED_PARTICLE_CONFIG.lineWidth}
          frameRate={UNIFIED_PARTICLE_CONFIG.frameRate}
          opacity={UNIFIED_PARTICLE_CONFIG.opacity}
          enableLandMask={true}
          maskResolution="50m"
          maskOpacity={0.9}
        />
      )}

      {advancedLayer === 'CURRENT_PARTICLES' && (
        <MaskedVelocityLayer
          data={velocityData}
          type="currents"
          visible={true}
          map={mapInstance.current}
          maxVelocity={2.0}
          particleMultiplier={UNIFIED_PARTICLE_CONFIG.particleMultiplier}
          velocityScale={0.125}
          lineWidth={UNIFIED_PARTICLE_CONFIG.lineWidth}
          frameRate={UNIFIED_PARTICLE_CONFIG.frameRate}
          opacity={UNIFIED_PARTICLE_CONFIG.opacity}
          enableLandMask={true}
          maskResolution="50m"
          maskOpacity={0.9}
        />
      )}

      {advancedLayer === 'WAVE_HEATMAP' && (
        <SmoothWaveHeatmap
          gridData={waveHeatmapData}
          visible={true}
          opacity={0.9}
          map={mapInstance.current}
        />
      )}

      {/* Crisp Land Mask - REMOVED: SmoothWaveHeatmap now handles invisible land clipping internally using GeoJSON mask */}
      {/* This eliminates the gray overlay while preventing waves from climbing over land */}

      {/* Color Scale Legend - Show when advanced layer is active */}
      {advancedLayer === 'WIND_PARTICLES' && (
        <ColorScaleLegend
          scale={COLOR_SCALES.wind}
          unit="km/h"
          title={t('map.legend.windSpeed')}
          position="bottomright"
        />
      )}

      {advancedLayer === 'CURRENT_PARTICLES' && (
        <ColorScaleLegend
          scale={COLOR_SCALES.current}
          unit="m/s"
          title={t('map.legend.currentVelocity')}
          position="bottomright"
        />
      )}

      {advancedLayer === 'WAVE_HEATMAP' && (
        <ColorScaleLegend
          scale={COLOR_SCALES.windyWave}
          unit="m"
          title={t('map.legend.waveHeight')}
          position="bottomright"
        />
      )}

      {/* Bathymetry Legend - Show when bathymetry layer is active */}
      {geoJSONLayers.bathymetry && (
        <ColorScaleLegend
          scale={COLOR_SCALES.bathymetry}
          unit="m"
          title={t('map.legend.bathymetry')}
          position="bottomleft"
        />
      )}

      {/* Marine Areas Legend - Show when marine areas layer is active */}
      {geoJSONLayers.marineAreas && (
        <div
          className="absolute z-[350] bottom-4 left-32 pointer-events-none"
        >
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl overflow-hidden w-[110px] animate-in fade-in slide-in-from-bottom-4 pointer-events-auto">
            <div className="px-2 py-1.5 border-b border-slate-700/50 bg-slate-800/50">
              <h3 className="text-[10px] font-bold text-white uppercase tracking-wide truncate">
                {t('map.legend.marineAreas')}
              </h3>
            </div>
            <div className="p-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border border-slate-700/50"
                  style={{ backgroundColor: '#6ba3e0', opacity: 0.6 }}
                />
                <span className="text-[10px] text-white">{t('map.marineAreas')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MapComponent;
    