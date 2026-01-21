
import React from 'react';
import { MarineWeatherData, HourlyForecastItem, DailyForecastItem } from '@seame/core';
import {
  Wind, Navigation, Sun, Moon, Eye, Droplets,
  Gauge, Thermometer, Sunrise, Sunset, Cloud, ArrowUp, ArrowDown,
  CloudRain, CloudSnow, CloudLightning, CloudFog, CloudSun, Cloudy,
  Calendar
} from 'lucide-react';
import { format, parseISO, differenceInMinutes, addDays, isToday, isTomorrow } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface AtmosphereProps {
  weatherData: MarineWeatherData | null;
}

// Weather code to icon mapping
const getWeatherIcon = (code: number, isDay: boolean, size: number = 24) => {
  const className = "flex-shrink-0";

  // Clear
  if (code === 0) {
    return isDay ? <Sun size={size} className={`${className} text-yellow-400`} /> : <Moon size={size} className={`${className} text-slate-300`} />;
  }
  // Mainly clear, partly cloudy
  if (code >= 1 && code <= 2) {
    return isDay ? <CloudSun size={size} className={`${className} text-yellow-300`} /> : <Cloud size={size} className={`${className} text-slate-400`} />;
  }
  // Overcast
  if (code === 3) {
    return <Cloudy size={size} className={`${className} text-slate-400`} />;
  }
  // Fog
  if (code >= 45 && code <= 48) {
    return <CloudFog size={size} className={`${className} text-slate-400`} />;
  }
  // Drizzle
  if (code >= 51 && code <= 57) {
    return <CloudRain size={size} className={`${className} text-blue-300`} />;
  }
  // Rain
  if (code >= 61 && code <= 67) {
    return <CloudRain size={size} className={`${className} text-blue-400`} />;
  }
  // Snow
  if (code >= 71 && code <= 77) {
    return <CloudSnow size={size} className={`${className} text-blue-200`} />;
  }
  // Rain showers
  if (code >= 80 && code <= 82) {
    return <CloudRain size={size} className={`${className} text-blue-500`} />;
  }
  // Snow showers
  if (code >= 85 && code <= 86) {
    return <CloudSnow size={size} className={`${className} text-blue-300`} />;
  }
  // Thunderstorm
  if (code >= 95 && code <= 99) {
    return <CloudLightning size={size} className={`${className} text-purple-400`} />;
  }

  return <Cloud size={size} className={`${className} text-slate-400`} />;
};

// Get weather summary text based on conditions
const getWeatherSummary = (code: number, windGusts: number, feelsLike: number, t: (key: string, options?: Record<string, unknown>) => string): string => {
  let summary = '';

  // Weather condition part
  if (code === 0) {
    summary = t('atmosphere.clearConditions');
  } else if (code >= 1 && code <= 3) {
    summary = t('atmosphere.partlyCloudyConditions');
  } else if (code >= 51 && code <= 67 || code >= 80 && code <= 82) {
    summary = t('atmosphere.rainyConditions');
  } else {
    summary = t('atmosphere.cloudyConditions');
  }

  // Wind gusts part
  if (windGusts > 20) {
    summary += ' ' + t('atmosphere.windGustsInfo', { speed: Math.round(windGusts), temp: Math.round(feelsLike) });
  }

  return summary;
};

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

  // Format day name for 10-day forecast
  const formatDayName = (dateStr: string): string => {
    const date = parseISO(dateStr);
    if (isToday(date)) return t('atmosphere.today');
    if (isTomorrow(date)) return format(date, 'EEE');
    return format(date, 'EEE');
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

  // Calculate temperature range for the 10-day forecast bar visualization
  const allDailyTemps = general.dailyForecast.flatMap(d => [d.tempMin, d.tempMax]);
  const minTempRange = Math.min(...allDailyTemps);
  const maxTempRange = Math.max(...allDailyTemps);
  const tempRangeSpan = maxTempRange - minTempRange || 1;

  // Get sunrise and sunset times for hourly forecast markers
  const sunriseTime = format(sunrise, 'HH:mm');
  const sunsetTime = format(sunset, 'HH:mm');
  const sunriseHour = format(sunrise, 'HH');
  const sunsetHour = format(sunset, 'HH');

  return (
    <div className="p-4 space-y-4 max-w-7xl mx-auto pb-24">

      {/* --- HEADER --- */}
      <header className="mb-2">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Cloud className="text-accent" /> {t('nav.atmosphere')}
        </h1>
        <p className="text-secondary text-sm">
          {t('atmosphere.subtitle')}
        </p>
      </header>

      {/* --- CURRENT WEATHER HERO (Apple Weather Style) --- */}
      <div className="bg-gradient-to-b from-blue-500/20 via-blue-400/10 to-transparent rounded-2xl p-6 border border-app">
        <div className="text-center">
          {/* Large Temperature */}
          <div className="text-7xl font-thin text-primary mb-1">
            {Math.round(general.temperature)}°
          </div>

          {/* Feels Like */}
          <div className="text-secondary text-lg mb-2">
            {t('weather.feelsLike')}: {Math.round(general.feelsLike)}°
          </div>

          {/* High / Low */}
          <div className="text-secondary text-base flex items-center justify-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUp size={14} className="text-red-400" />
              <span className="font-semibold">{Math.round(general.dailyForecast[0]?.tempMax || 0)}°</span>
            </span>
            <span className="flex items-center gap-1">
              <ArrowDown size={14} className="text-blue-400" />
              <span className="font-semibold">{Math.round(general.dailyForecast[0]?.tempMin || 0)}°</span>
            </span>
          </div>
        </div>

        {/* Weather Summary */}
        <div className="mt-4 pt-4 border-t border-app/50">
          <p className="text-secondary text-sm text-center">
            {getWeatherSummary(general.weatherCode, current.windGusts, general.feelsLike, t)}
          </p>
        </div>
      </div>

      {/* --- 24-HOUR FORECAST (Apple Weather Style) --- */}
      <div className="bg-card border border-app rounded-xl p-4">
        <h2 className="text-xs font-bold text-secondary uppercase mb-3 flex items-center gap-2">
          <Calendar size={14} className="text-accent" /> {t('atmosphere.hourlyForecast')}
        </h2>

        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
          <div className="flex gap-4 min-w-max pb-2">
            {general.hourlyForecast.map((hour: HourlyForecastItem, index: number) => {
              const hourTime = parseISO(hour.time);
              const hourStr = format(hourTime, 'HH');
              const isNow = index === 0;
              const isSunrise = hourStr === sunriseHour;
              const isSunset = hourStr === sunsetHour;

              return (
                <div
                  key={hour.time}
                  className="flex flex-col items-center min-w-[50px]"
                >
                  {/* Time */}
                  <span className="text-xs text-muted mb-2">
                    {isNow ? t('common.now') : format(hourTime, 'HH')}
                  </span>

                  {/* Weather Icon or Sunrise/Sunset */}
                  <div className="h-8 flex items-center justify-center mb-2">
                    {isSunrise ? (
                      <Sunrise size={24} className="text-yellow-500" />
                    ) : isSunset ? (
                      <Sunset size={24} className="text-orange-500" />
                    ) : (
                      getWeatherIcon(hour.weatherCode, hour.isDay, 24)
                    )}
                  </div>

                  {/* Temperature or Sunrise/Sunset time */}
                  <span className="text-sm font-semibold text-primary">
                    {isSunrise ? sunriseTime : isSunset ? sunsetTime : `${Math.round(hour.temperature)}°`}
                  </span>

                  {/* Precipitation probability if > 0 */}
                  {hour.precipitationProbability > 0 && !isSunrise && !isSunset && (
                    <span className="text-[10px] text-blue-400 mt-1">
                      {hour.precipitationProbability}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- 10-DAY FORECAST (Apple Weather Style) --- */}
      <div className="bg-card border border-app rounded-xl p-4">
        <h2 className="text-xs font-bold text-secondary uppercase mb-3 flex items-center gap-2">
          <Calendar size={14} className="text-accent" /> {t('atmosphere.dailyForecast')}
        </h2>

        <div className="space-y-3">
          {general.dailyForecast.map((day: DailyForecastItem, index: number) => {
            // Calculate bar position for temperature range
            const lowPercent = ((day.tempMin - minTempRange) / tempRangeSpan) * 100;
            const highPercent = ((day.tempMax - minTempRange) / tempRangeSpan) * 100;
            const barWidth = highPercent - lowPercent;

            // Determine bar gradient color based on temperature
            const getBarColor = () => {
              const avgTemp = (day.tempMin + day.tempMax) / 2;
              if (avgTemp < 10) return 'from-blue-400 to-cyan-400';
              if (avgTemp < 20) return 'from-cyan-400 to-green-400';
              if (avgTemp < 25) return 'from-green-400 to-yellow-400';
              if (avgTemp < 30) return 'from-yellow-400 to-orange-400';
              return 'from-orange-400 to-red-400';
            };

            return (
              <div
                key={day.time}
                className={`flex items-center gap-3 py-2 ${index < general.dailyForecast.length - 1 ? 'border-b border-app/50' : ''}`}
              >
                {/* Day Name */}
                <div className="w-12 text-sm text-primary font-medium">
                  {formatDayName(day.time)}
                </div>

                {/* Weather Icon */}
                <div className="w-8 flex justify-center">
                  {getWeatherIcon(day.code, true, 20)}
                </div>

                {/* Precipitation probability */}
                <div className="w-10 text-right">
                  {day.precipitationProbability > 0 ? (
                    <span className="text-xs text-blue-400 font-medium">
                      {day.precipitationProbability}%
                    </span>
                  ) : (
                    <span className="text-xs text-transparent">0%</span>
                  )}
                </div>

                {/* Low Temp */}
                <div className="w-8 text-right text-sm text-muted">
                  {Math.round(day.tempMin)}°
                </div>

                {/* Temperature Bar */}
                <div className="flex-1 h-1.5 bg-elevated rounded-full relative overflow-hidden mx-2">
                  <div
                    className={`absolute h-full rounded-full bg-gradient-to-r ${getBarColor()}`}
                    style={{
                      left: `${lowPercent}%`,
                      width: `${Math.max(barWidth, 5)}%`
                    }}
                  />
                  {/* Current temperature indicator for today */}
                  {index === 0 && (
                    <div
                      className="absolute w-1.5 h-1.5 bg-white rounded-full border border-app shadow-sm top-0"
                      style={{
                        left: `${((general.temperature - minTempRange) / tempRangeSpan) * 100}%`,
                        transform: 'translateX(-50%)'
                      }}
                    />
                  )}
                </div>

                {/* High Temp */}
                <div className="w-8 text-left text-sm text-primary font-medium">
                  {Math.round(day.tempMax)}°
                </div>
              </div>
            );
          })}
        </div>
      </div>

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

               {/* UV Index */}
               <div className="flex flex-col items-center p-4 bg-app-base rounded-xl border border-app col-span-2 md:col-span-1">
                   <Sun size={24} className="text-yellow-400 mb-2" />
                   <div className="text-xs text-muted uppercase">{t('weather.currentUV')}</div>
                   <div className="text-2xl font-bold text-primary mt-1">{general.uvIndex.toFixed(1)}</div>
                   <div className="w-full bg-elevated h-1.5 rounded-full mt-2 overflow-hidden">
                       <div
                         className={`h-full ${general.uvIndex < 3 ? 'bg-green-500' : general.uvIndex < 6 ? 'bg-yellow-500' : general.uvIndex < 8 ? 'bg-orange-500' : 'bg-red-500'}`}
                         style={{ width: `${Math.min(general.uvIndex / 11 * 100, 100)}%` }}
                       ></div>
                   </div>
                   <div className="text-[10px] mt-1 text-muted">
                     {general.uvIndex < 3 ? 'Low' : general.uvIndex < 6 ? 'Moderate' : general.uvIndex < 8 ? 'High' : general.uvIndex < 11 ? 'Very High' : 'Extreme'}
                   </div>
               </div>

           </div>
        </div>

      </div>
    </div>
  );
};

export default Atmosphere;
