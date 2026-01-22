export { ColorScaleLegend, type ColorScaleLegendProps, type ColorScaleItem } from './ColorScaleLegend';
export { WaveHeatmapLayer, getWaveHeightColor, createGridDataFromForecasts } from './WaveHeatmapLayer';
export type { GridCell, WaveHeatmapLayerProps } from './WaveHeatmapLayer';
export { default as TimeSlider } from './TimeSlider';
export { VelocityLayer, type VelocityLayerProps } from './VelocityLayer';
export { MaskedVelocityLayer, type MaskedVelocityLayerProps } from './MaskedVelocityLayer';

// V2 Components - Zero-Bleed Land Masking
export { VelocityLayerV2, type VelocityLayerV2Props } from './VelocityLayerV2';
export { MaskedVelocityLayerV2, type MaskedVelocityLayerV2Props } from './MaskedVelocityLayerV2';
export { SmoothWaveHeatmapV2, type SmoothWaveHeatmapV2Props, type WaveGridPoint as WaveGridPointV2 } from './SmoothWaveHeatmapV2';

// Sea Mask Utilities
export { SeaMask, getSharedSeaMask, initializeSeaMask, renderLandMaskToCanvas, CachedLandMaskRenderer } from './SeaMaskUtils';
export type { Point, BoundingBox, SeaMaskConfig, LandMaskConfig } from './SeaMaskUtils';

// GeoJSON Layer Components
export { GeoJSONLayers, type GeoJSONLayersProps } from './GeoJSONLayers';
export { BathymetryLayer, type BathymetryLayerProps } from './BathymetryLayer';
export { PortsLayer, type PortsLayerProps, type PortFeature } from './PortsLayer';
export { ReefLayer, type ReefLayerProps, type ReefFeature } from './ReefLayer';

// Weather Radar Layer
export { RainRadarLayer, useRainRadarFrames, type RainRadarLayerProps, type RainRadarControls } from './RainRadarLayer';
