
import React from 'react';
import { MarineWeatherData } from '@seame/core';
import {
  Wind, Navigation, Sun, Moon, Eye, Droplets,
  Gauge, Thermometer, Sunrise, Sunset, Cloud, ArrowUp, ArrowDown
} from 'lucide-react';
import { format, parseISO, differenceInMinutes, addDays } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface AtmosphereProps {
  weatherData: MarineWeatherData | null;
}

const Atmosphere: React.FC<AtmosphereProps> = ({ weatherData }) => {
  const { t } = useTranslation();

  if (!weatherData || !weatherData.general || !weatherData.current) return null;
  const { general, current } = weatherData;

  // Helper function to convert degrees to cardinal direction
  const getCardinalDirection = (degrees: number): string => {
    const normalizedDegrees = ((degrees % 360) + 360) % 360; // Normalize to 0-360

    if ((normalizedDegrees >= 0 && normalizedDegrees < 22.5) || normalizedDegrees >= 337.5) {
      return t('directions.north');
    } else if (normalizedDegrees >= 22.5 && normalizedDegrees < 67.5) {
      return t('directions.northeast');
    } else if (normalizedDegrees >= 67.5 && normalizedDegrees < 112.5) {
      return t('directions.east');
    } else if (normalizedDegrees >= 112.5 && normalizedDegrees < 157.5) {
      return t('directions.southeast');
    } else if (normalizedDegrees >= 157.5 && normalizedDegrees < 202.5) {
      return t('directions.south');
    } else if (normalizedDegrees >= 202.5 && normalizedDegrees < 247.5) {
      return t('directions.southwest');
    } else if (normalizedDegrees >= 247.5 && normalizedDegrees < 292.5) {
      return t('directions.west');
    } else {
      return t('directions.northwest');
    }
  };

  // Helper function to translate moon phase
  const getMoonPhaseTranslation = (phase: string): string => {
    const phaseMap: Record<string, string> = {
      'New Moon': 'newMoon',
      'Waxing Crescent': 'waxingCrescent',
      'First Quarter': 'firstQuarter',
      'Waxing Gibbous': 'waxingGibbous',
      'Full Moon': 'fullMoon',
      'Waning Gibbous': 'waningGibbous',
      'Last Quarter': 'lastQuarter',
      'Waning Crescent': 'waningCrescent'
    };
    const key = phaseMap[phase] || 'newMoon';
    return t(`moonPhases.${key}`);
  };

  // --- Sun Cycle Calculation ---
  const now = new Date();
  const sunrise = new Date(general.sunrise);
  const sunset = new Date(general.sunset);
  
  const dayDuration = differenceInMinutes(sunset, sunrise);
  const timeSinceSunrise = differenceInMinutes(now, sunrise);
  let sunProgress = 0;
  
  if (timeSinceSunrise < 0) sunProgress = 0; // Before sunrise
  else if (timeSinceSunrise > dayDuration) sunProgress = 100; // After sunset
  else sunProgress = (timeSinceSunrise / dayDuration) * 100;

  // --- Moon Cycle Calculation (Animation Position) ---
  let moonProgress = -1; // -1 means moon is not visible/not calculated for arc
  
  if (general.moonrise && general.moonset) {
      const moonrise = new Date(general.moonrise);
      const moonset = new Date(general.moonset);
      
      // Handle day crossing for moon (if set is before rise, it sets the next day)
      let effectiveMoonset = moonset;
      if (moonset < moonrise) effectiveMoonset = addDays(moonset, 1);
      
      // If now is between rise and set
      if (now >= moonrise && now <= effectiveMoonset) {
          const moonDuration = differenceInMinutes(effectiveMoonset, moonrise);
          const timeSinceMoonrise = differenceInMinutes(now, moonrise);
          moonProgress = (timeSinceMoonrise / moonDuration) * 100;
      }
  }

  // --- Pressure Scale ---
  const pressure = general.pressure;
  const pressurePercent = Math.min(100, Math.max(0, ((pressure - 980) / (1040 - 980)) * 100));
  let pressureLabel = t('atmosphere.normal');
  if (pressure < 1005) pressureLabel = t('atmosphere.lowSystem');
  if (pressure > 1022) pressureLabel = t('atmosphere.highPressure');

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto pb-24">
      
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Cloud className="text-accent" /> {t('nav.atmosphere')}
        </h1>
        <p className="text-secondary text-sm">
          {t('atmosphere.subtitle')}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* --- SOLAR & LUNAR CYCLE --- */}
        <div className="bg-card border border-app rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
           <h2 className="text-sm font-bold text-secondary uppercase mb-4 flex items-center gap-2">
             <Sun size={16} className="text-yellow-500" /> {t('atmosphere.solarCycle')}
           </h2>

           {/* Sun Arc Animation */}
           <div className="relative h-24 mb-6">
              {/* Arc Line */}
              <div className="absolute bottom-0 left-0 right-0 h-24 border-t-2 border-l-2 border-r-2 border-subtle rounded-t-full opacity-30"></div>
              
              {/* Sun Icon Moving on Arc */}
              <div 
                className="absolute w-8 h-8 text-yellow-400 transition-all duration-1000 ease-out z-10"
                style={{
                    left: `${sunProgress}%`,
                    bottom: `${Math.sin((sunProgress / 100) * Math.PI) * 100}%`,
                    transform: 'translate(-50%, 50%)',
                    opacity: sunProgress > 0 && sunProgress < 100 ? 1 : 0.3
                }}
              >
                 <Sun size={32} fill="currentColor" className="animate-pulse shadow-yellow-500 drop-shadow-lg" />
              </div>
              
              {/* Time Labels */}
              <div className="absolute bottom-[-20px] left-0 text-xs text-muted flex flex-col items-center">
                 <Sunrise size={16} />
                 <span>{format(sunrise, 'HH:mm')}</span>
              </div>
              <div className="absolute bottom-[-20px] right-0 text-xs text-muted flex flex-col items-center">
                 <Sunset size={16} />
                 <span>{format(sunset, 'HH:mm')}</span>
              </div>
           </div>

           {/* Moon Arc Animation */}
           <div className="border-t border-app pt-6 mt-4">
               <h2 className="text-sm font-bold text-secondary uppercase mb-4 flex items-center gap-2">
                 <Moon size={16} className="text-secondary" /> {t('atmosphere.lunarCycle')}
               </h2>

               <div className="relative h-24 mb-2">
                  {/* Arc Line (Dashed for Moon) */}
                  <div className="absolute bottom-0 left-0 right-0 h-24 border-t-2 border-l-2 border-r-2 border-subtle border-dashed rounded-t-full opacity-30"></div>
                  
                  {/* Moon Icon Moving on Arc */}
                  {moonProgress >= 0 ? (
                      <div
                        className="absolute w-6 h-6 text-secondary transition-all duration-1000 ease-out z-10"
                        style={{
                            left: `${moonProgress}%`,
                            bottom: `${Math.sin((moonProgress / 100) * Math.PI) * 100}%`,
                            transform: 'translate(-50%, 50%)'
                        }}
                      >
                         <Moon size={24} fill="currentColor" className="drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                      </div>
                  ) : (
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] text-muted uppercase font-bold tracking-widest bg-card px-2">
                          {t('atmosphere.moonDown')}
                      </div>
                  )}
                  
                  {/* Time Labels */}
                  <div className="absolute bottom-[-20px] left-0 text-xs text-muted flex flex-col items-center">
                     <span className="text-[10px] uppercase flex items-center gap-1"><ArrowUp size={10}/> {t('atmosphere.rise')}</span>
                     <span className="font-mono">{general.moonrise ? format(parseISO(general.moonrise), 'HH:mm') : '--:--'}</span>
                  </div>
                  <div className="absolute bottom-[-20px] right-0 text-xs text-muted flex flex-col items-center">
                     <span className="text-[10px] uppercase flex items-center gap-1"><ArrowDown size={10}/> {t('atmosphere.set')}</span>
                     <span className="font-mono">{general.moonset ? format(parseISO(general.moonset), 'HH:mm') : '--:--'}</span>
                  </div>
               </div>
           </div>

           <div className="bg-app-base/50 rounded-lg p-3 mt-8 grid grid-cols-2 gap-4 border border-app">
               {/* Moon Phase Details */}
               <div className="flex items-center gap-3">
                   <div className="relative">
                       <Moon size={32} className="text-secondary" />
                       {/* Simple overlay to simulate phase visually if possible, otherwise rely on text */}
                       <div className="absolute inset-0 bg-app-base/60 rounded-full mix-blend-multiply" style={{ width: `${100 - general.moonIllumination}%`, marginLeft: 'auto' }}></div>
                   </div>
                   <div>
                       <div className="text-[10px] text-muted uppercase">{t('atmosphere.phase')}</div>
                       <div className="text-primary text-sm font-bold">{getMoonPhaseTranslation(general.moonPhase)}</div>
                       <div className="text-[10px] text-accent">{general.moonIllumination}% {t('atmosphere.illumination')}</div>
                   </div>
               </div>

               <div className="text-right flex flex-col justify-center">
                   <div className="text-[10px] text-muted uppercase">{t('atmosphere.nextFullMoon')}</div>
                   <div className="text-primary text-sm font-mono">
                     {general.nextFullMoon ? format(parseISO(general.nextFullMoon), 'dd MMM') : '--'}
                   </div>
               </div>
           </div>
        </div>

        {/* --- WIND & GUSTS --- */}
        <div className="bg-card border border-app rounded-xl p-6 relative">
            <h2 className="text-sm font-bold text-secondary uppercase mb-6 flex items-center gap-2">
             <Wind size={16} className="text-cyan-400" /> {t('atmosphere.windDynamics')}
           </h2>

           <div className="flex items-center justify-around">
               {/* Compass */}
               <div className="relative w-32 h-32 border-4 border-app rounded-full flex items-center justify-center bg-app-base shadow-inner">
                   <div className="absolute top-1 text-[10px] font-bold text-muted">N</div>
                   <div className="absolute bottom-1 text-[10px] font-bold text-muted">S</div>
                   <div className="absolute left-1 text-[10px] font-bold text-muted">W</div>
                   <div className="absolute right-1 text-[10px] font-bold text-muted">E</div>
                   
                   {/* Animated Arrow */}
                   <div 
                     className="transition-transform duration-1000 ease-out"
                     style={{ transform: `rotate(${current.windDirection}deg)` }}
                   >
                      <Navigation size={48} className="text-cyan-500 fill-cyan-500/20" />
                   </div>
               </div>

               {/* Metrics */}
               <div className="space-y-4">
                  <div className="bg-elevated/50 p-3 rounded-lg border border-subtle w-36">
                      <div className="text-xs text-secondary mb-1">{t('weather.windSpeed')}</div>
                      <div className="text-3xl font-bold text-primary">{current.windSpeed.toFixed(1)} <span className="text-sm text-muted">{t('units.kmh')}</span></div>
                  </div>
                  <div className="bg-elevated/50 p-3 rounded-lg border border-subtle w-36">
                      <div className="text-xs text-secondary mb-1">{t('atmosphere.gusts')}</div>
                      <div className="text-3xl font-bold text-purple-400">{current.windGusts.toFixed(1)} <span className="text-sm text-muted">{t('units.kmh')}</span></div>
                  </div>
               </div>
           </div>
           <div className="text-center mt-6 text-xs text-muted">
               {t('atmosphere.currentDirection')}: <span className="text-primary font-bold">{current.windDirection}° {getCardinalDirection(current.windDirection)}</span>
           </div>
        </div>

        {/* --- ATMOSPHERIC METRICS --- */}
        <div className="bg-card border border-app rounded-xl p-6 md:col-span-2">
           <h2 className="text-sm font-bold text-secondary uppercase mb-6 flex items-center gap-2">
             <Gauge size={16} className="text-teal-400" /> {t('atmosphere.atmosphericConditions')}
           </h2>

           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">

               {/* Visibility */}
               <div className="flex flex-col items-center p-4 bg-app-base rounded-xl border border-app">
                   <Eye size={24} className="text-accent mb-2" />
                   <div className="text-xs text-muted uppercase">{t('atmosphere.visibility')}</div>
                   <div className="text-2xl font-bold text-primary mt-1">{(general.visibility / 1000).toFixed(1)} <span className="text-sm">{t('units.kilometers')}</span></div>
                   <div className="text-[10px] text-green-400 mt-1">
                      {general.visibility > 9000 ? t('atmosphere.clearView') : t('atmosphere.reducedHaze')}
                   </div>
               </div>

               {/* Humidity */}
               <div className="flex flex-col items-center p-4 bg-app-base rounded-xl border border-app">
                   <Droplets size={24} className="text-blue-500 mb-2" />
                   <div className="text-xs text-muted uppercase">{t('atmosphere.humidity')}</div>
                   <div className="text-2xl font-bold text-primary mt-1">{general.humidity}%</div>
                   <div className="w-full bg-elevated h-1.5 rounded-full mt-2 overflow-hidden">
                       <div className="bg-blue-500 h-full" style={{ width: `${general.humidity}%` }}></div>
                   </div>
               </div>

               {/* Pressure */}
               <div className="flex flex-col items-center p-4 bg-app-base rounded-xl border border-app col-span-2 md:col-span-1">
                   <Gauge size={24} className="text-orange-400 mb-2" />
                   <div className="text-xs text-muted uppercase">{t('table.pressure')}</div>
                   <div className="text-2xl font-bold text-primary mt-1">{Math.round(general.pressure)} <span className="text-sm">{t('units.hpa')}</span></div>
                   <div className="text-[10px] text-orange-300 mt-1">{pressureLabel}</div>
                   {/* Bar Indicator */}
                   <div className="w-full h-1.5 bg-elevated rounded-full mt-2 relative">
                       <div className="absolute top-0 bottom-0 w-2 bg-primary rounded-full transition-all duration-1000" style={{ left: `${pressurePercent}%` }}></div>
                   </div>
                   <div className="flex justify-between w-full text-[8px] text-muted mt-1 px-1">
                       <span>{t('forecast.low')}</span><span>{t('forecast.high')}</span>
                   </div>
               </div>

               {/* Today's Stats */}
               <div className="flex flex-col items-center p-4 bg-app-base rounded-xl border border-app col-span-2 md:col-span-1">
                   <Thermometer size={24} className="text-red-400 mb-2" />
                   <div className="text-xs text-muted uppercase">{t('atmosphere.todaySummary')}</div>
                   <div className="w-full space-y-2 mt-2">
                       <div className="flex justify-between items-center text-sm">
                           <span className="text-secondary">{t('atmosphere.current')}</span>
                           <span className="text-primary font-bold">{general.temperature.toFixed(1)}°</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                           <span className="text-secondary">{t('forecast.high')}</span>
                           <span className="text-red-300 font-bold">{general.dailyForecast[0]?.tempMax}°</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                           <span className="text-secondary">{t('forecast.low')}</span>
                           <span className="text-blue-300 font-bold">{general.dailyForecast[0]?.tempMin}°</span>
                       </div>
                   </div>
               </div>

           </div>
        </div>

      </div>
    </div>
  );
};

export default Atmosphere;
