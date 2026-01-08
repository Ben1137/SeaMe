/**
 * VelocityLayer Usage Examples
 *
 * This file demonstrates how to use the VelocityLayer component
 * to display wind and ocean current particle animations on a Leaflet map.
 */

import React, { useState, useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { VelocityLayer } from './VelocityLayer';

/**
 * Example 1: Basic Wind Layer
 *
 * This example shows how to display wind data with default settings
 */
export function BasicWindLayerExample() {
  const mapRef = useRef<L.Map | null>(null);
  const [windData, setWindData] = useState<L.VelocityData | null>(null);

  useEffect(() => {
    // Initialize map
    if (!mapRef.current) {
      const map = L.map('map-container').setView([40.7128, -74.0060], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      mapRef.current = map;
    }

    // Fetch wind data (example)
    async function fetchWindData() {
      // Replace with your actual data source
      const data: L.VelocityData = {
        0: {
          header: {
            parameterCategory: 2,
            parameterNumber: 2,
            dx: 0.5,
            dy: 0.5,
            nx: 100,
            ny: 100,
            la1: 35.0,
            la2: 45.0,
            lo1: -80.0,
            lo2: -70.0,
            refTime: new Date().toISOString(),
          },
          data: new Array(10000).fill(0).map(() => Math.random() * 20 - 10), // U component
        },
        1: {
          header: {
            parameterCategory: 2,
            parameterNumber: 3,
            dx: 0.5,
            dy: 0.5,
            nx: 100,
            ny: 100,
            la1: 35.0,
            la2: 45.0,
            lo1: -80.0,
            lo2: -70.0,
            refTime: new Date().toISOString(),
          },
          data: new Array(10000).fill(0).map(() => Math.random() * 20 - 10), // V component
        },
      };
      setWindData(data);
    }

    fetchWindData();
  }, []);

  return (
    <div>
      <div id="map-container" style={{ height: '600px', width: '100%' }} />
      <VelocityLayer
        data={windData}
        type="wind"
        visible={true}
        map={mapRef.current}
      />
    </div>
  );
}

/**
 * Example 2: Ocean Currents with Custom Styling
 *
 * This example shows how to customize the appearance of ocean current data
 */
export function CustomCurrentsLayerExample() {
  const mapRef = useRef<L.Map | null>(null);
  const [currentData, setCurrentData] = useState<L.VelocityData | null>(null);
  const [showLayer, setShowLayer] = useState(true);

  // Custom color scale for ocean currents (from slow to fast)
  const customColorScale = [
    'rgba(0, 0, 255, 0.7)',      // Deep blue - very slow
    'rgba(0, 128, 255, 0.7)',    // Blue
    'rgba(0, 255, 255, 0.7)',    // Cyan
    'rgba(0, 255, 128, 0.7)',    // Green-cyan
    'rgba(128, 255, 0, 0.7)',    // Yellow-green
    'rgba(255, 255, 0, 0.7)',    // Yellow
    'rgba(255, 128, 0, 0.7)',    // Orange
    'rgba(255, 0, 0, 0.7)',      // Red - very fast
  ];

  return (
    <div>
      <div id="map-container" style={{ height: '600px', width: '100%' }} />

      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
        <button onClick={() => setShowLayer(!showLayer)}>
          {showLayer ? 'Hide' : 'Show'} Currents
        </button>
      </div>

      <VelocityLayer
        data={currentData}
        type="currents"
        visible={showLayer}
        map={mapRef.current}
        maxVelocity={2.5}
        minVelocity={0.1}
        velocityScale={0.01}
        colorScale={customColorScale}
        opacity={0.85}
        particleMultiplier={1 / 3000}
        frameRate={20}
      />
    </div>
  );
}

/**
 * Example 3: Dynamic Data Updates
 *
 * This example shows how to update velocity data in real-time
 */
export function DynamicDataExample() {
  const mapRef = useRef<L.Map | null>(null);
  const [velocityData, setVelocityData] = useState<L.VelocityData | null>(null);
  const [dataType, setDataType] = useState<'wind' | 'currents'>('wind');
  const [timestamp, setTimestamp] = useState(0);

  useEffect(() => {
    // Simulate real-time data updates
    const interval = setInterval(() => {
      setTimestamp(Date.now());
      // In a real application, fetch new data here
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch data based on type and timestamp
    async function fetchData() {
      // Replace with your actual data fetching logic
      console.log(`Fetching ${dataType} data for ${timestamp}`);
    }

    fetchData();
  }, [dataType, timestamp]);

  return (
    <div>
      <div id="map-container" style={{ height: '600px', width: '100%' }} />

      <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000 }}>
        <select
          value={dataType}
          onChange={(e) => setDataType(e.target.value as 'wind' | 'currents')}
        >
          <option value="wind">Wind</option>
          <option value="currents">Currents</option>
        </select>
      </div>

      <VelocityLayer
        data={velocityData}
        type={dataType}
        visible={true}
        map={mapRef.current}
        maxVelocity={dataType === 'wind' ? 25 : 3}
      />
    </div>
  );
}

/**
 * Example 4: Integration with Existing MapComponent
 *
 * This example shows how to integrate VelocityLayer with the existing MapComponent
 */
export function IntegratedMapExample() {
  const mapInstance = useRef<L.Map | null>(null);
  const [activeLayer, setActiveLayer] = useState<'none' | 'wind' | 'currents'>('none');
  const [velocityData, setVelocityData] = useState<L.VelocityData | null>(null);

  useEffect(() => {
    // Initialize your map
    if (!mapInstance.current) {
      const map = L.map('integrated-map').setView([40.7128, -74.0060], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      mapInstance.current = map;
    }
  }, []);

  useEffect(() => {
    // Fetch velocity data when layer changes
    if (activeLayer !== 'none') {
      // Fetch data for the active layer type
      fetchVelocityData(activeLayer);
    }
  }, [activeLayer]);

  async function fetchVelocityData(type: 'wind' | 'currents') {
    // Implement your data fetching logic here
    // This could integrate with Open-Meteo or other marine data APIs
    console.log(`Fetching ${type} data...`);
  }

  return (
    <div className="relative h-full w-full">
      <div id="integrated-map" style={{ height: '100%', width: '100%' }} />

      {/* Layer Controls */}
      <div className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded shadow">
        <div className="space-y-2">
          <button
            onClick={() => setActiveLayer('none')}
            className={activeLayer === 'none' ? 'font-bold' : ''}
          >
            None
          </button>
          <button
            onClick={() => setActiveLayer('wind')}
            className={activeLayer === 'wind' ? 'font-bold' : ''}
          >
            Wind
          </button>
          <button
            onClick={() => setActiveLayer('currents')}
            className={activeLayer === 'currents' ? 'font-bold' : ''}
          >
            Currents
          </button>
        </div>
      </div>

      {/* Velocity Layers */}
      <VelocityLayer
        data={velocityData}
        type="wind"
        visible={activeLayer === 'wind'}
        map={mapInstance.current}
        maxVelocity={20}
      />

      <VelocityLayer
        data={velocityData}
        type="currents"
        visible={activeLayer === 'currents'}
        map={mapInstance.current}
        maxVelocity={2}
      />
    </div>
  );
}

/**
 * Utility: Create Sample Velocity Data
 *
 * This function creates sample velocity data for testing purposes
 */
export function createSampleVelocityData(
  latMin: number,
  latMax: number,
  lonMin: number,
  lonMax: number,
  gridSize: number = 50,
  maxMagnitude: number = 15
): L.VelocityData {
  const dx = (lonMax - lonMin) / gridSize;
  const dy = (latMax - latMin) / gridSize;
  const totalPoints = gridSize * gridSize;

  // Generate sample U component (east-west)
  const uData = new Array(totalPoints).fill(0).map(() =>
    (Math.random() - 0.5) * 2 * maxMagnitude
  );

  // Generate sample V component (north-south)
  const vData = new Array(totalPoints).fill(0).map(() =>
    (Math.random() - 0.5) * 2 * maxMagnitude
  );

  return {
    0: {
      header: {
        parameterCategory: 2,
        parameterNumber: 2,
        dx,
        dy,
        nx: gridSize,
        ny: gridSize,
        la1: latMax,
        la2: latMin,
        lo1: lonMin,
        lo2: lonMax,
        refTime: new Date().toISOString(),
      },
      data: uData,
    },
    1: {
      header: {
        parameterCategory: 2,
        parameterNumber: 3,
        dx,
        dy,
        nx: gridSize,
        ny: gridSize,
        la1: latMax,
        la2: latMin,
        lo1: lonMin,
        lo2: lonMax,
        refTime: new Date().toISOString(),
      },
      data: vData,
    },
  };
}
