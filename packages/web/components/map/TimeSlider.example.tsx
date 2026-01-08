/**
 * TimeSlider Usage Example
 *
 * This example demonstrates how to integrate the TimeSlider component
 * into your map view for forecast animation.
 */

import React, { useState } from 'react';
import TimeSlider from './TimeSlider';

export const TimeSliderExample: React.FC = () => {
  const [currentHour, setCurrentHour] = useState(0);

  const handleHourChange = (hour: number) => {
    setCurrentHour(hour);

    // Update your map layers, forecast data, etc. based on the selected hour
    console.log(`Forecast hour changed to: +${hour}h`);

    // Example: Update weather layer on map
    // updateMapLayer(hour);
  };

  return (
    <div className="relative h-screen">
      {/* Your map component */}
      <div className="absolute inset-0 bg-gray-900">
        <div className="flex items-center justify-center h-full">
          <p className="text-white text-xl">
            Current forecast: +{currentHour} hours
          </p>
        </div>
      </div>

      {/* TimeSlider - Fixed at bottom */}
      <TimeSlider
        currentHour={currentHour}
        onHourChange={handleHourChange}
        maxHours={48} // Optional, defaults to 48
      />
    </div>
  );
};

/**
 * Integration with MapComponent
 *
 * To integrate with your existing MapComponent:
 *
 * 1. Import the TimeSlider:
 *    import TimeSlider from './map/TimeSlider';
 *
 * 2. Add state for current hour:
 *    const [forecastHour, setForecastHour] = useState(0);
 *
 * 3. Update your map layers based on forecastHour:
 *    useEffect(() => {
 *      // Update map overlay with forecast data for the selected hour
 *      if (activeLayer !== 'NONE') {
 *        updateForecastLayer(forecastHour);
 *      }
 *    }, [forecastHour, activeLayer]);
 *
 * 4. Render the TimeSlider:
 *    <TimeSlider
 *      currentHour={forecastHour}
 *      onHourChange={setForecastHour}
 *      maxHours={48}
 *    />
 */
