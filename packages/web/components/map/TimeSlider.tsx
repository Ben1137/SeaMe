import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { format, addHours } from 'date-fns';
import { useTranslation } from 'react-i18next';

interface TimeSliderProps {
  currentHour: number;
  onHourChange: (hour: number) => void;
  maxHours?: number;
}

type PlaybackSpeed = 1 | 2 | 4;

const TimeSlider: React.FC<TimeSliderProps> = ({
  currentHour,
  onHourChange,
  maxHours = 48
}) => {
  const { t, i18n } = useTranslation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRTL = i18n.language === 'he';

  // Auto-play animation
  useEffect(() => {
    if (isPlaying) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Base interval is 1000ms, divided by speed
      const interval = 1000 / speed;

      intervalRef.current = setInterval(() => {
        onHourChange((prev) => {
          if (prev >= maxHours - 1) {
            setIsPlaying(false);
            return 0; // Loop back to start
          }
          return prev + 1;
        });
      }, interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, speed, maxHours, onHourChange]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleSpeedToggle = useCallback(() => {
    setSpeed((prev) => {
      if (prev === 1) return 2;
      if (prev === 2) return 4;
      return 1;
    });
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newHour = parseInt(e.target.value, 10);
    onHourChange(newHour);
    // Pause when manually changing
    if (isPlaying) {
      setIsPlaying(false);
    }
  }, [onHourChange, isPlaying]);

  const handleSkipBack = useCallback(() => {
    onHourChange(Math.max(0, currentHour - 6));
    if (isPlaying) setIsPlaying(false);
  }, [currentHour, onHourChange, isPlaying]);

  const handleSkipForward = useCallback(() => {
    onHourChange(Math.min(maxHours - 1, currentHour + 6));
    if (isPlaying) setIsPlaying(false);
  }, [currentHour, maxHours, onHourChange, isPlaying]);

  // Calculate current timestamp
  const currentTimestamp = addHours(new Date(), currentHour);
  const formattedDate = format(currentTimestamp, 'EEE, MMM d');
  const formattedTime = format(currentTimestamp, 'HH:mm');

  // Calculate progress percentage
  const progressPercent = (currentHour / (maxHours - 1)) * 100;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-30 pointer-events-none">
      <div className="max-w-4xl mx-auto px-4 pointer-events-auto">
        <div className="bg-card/95 backdrop-blur-md border border-app rounded-2xl shadow-2xl p-4">
          {/* Time Display */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <div className="text-xs text-secondary font-medium uppercase tracking-wide">
                {t('map.forecastTime', { defaultValue: 'Forecast Time' })}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {formattedTime}
                </span>
                <span className="text-sm text-secondary">
                  {formattedDate}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-secondary">
                {t('map.hoursAhead', { defaultValue: 'Hours Ahead' })}
              </div>
              <div className="text-xl font-bold text-accent tabular-nums">
                +{currentHour}h
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="relative mb-4">
            <div className="h-2 bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent/40 via-accent to-accent/40 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              type="range"
              min="0"
              max={maxHours - 1}
              value={currentHour}
              onChange={handleSliderChange}
              className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
              style={{ zIndex: 10 }}
              aria-label={t('map.timeSlider', { defaultValue: 'Time slider' })}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-accent rounded-full border-2 border-card shadow-lg pointer-events-none transition-all duration-300 ease-out"
              style={{ left: `calc(${progressPercent}% - 8px)` }}
            />
          </div>

          {/* Time markers */}
          <div className="flex justify-between text-xs text-muted mb-4 px-1">
            <span>{t('common.now', { defaultValue: 'Now' })}</span>
            <span>12h</span>
            <span>24h</span>
            <span>36h</span>
            <span>48h</span>
          </div>

          {/* Controls */}
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {/* Skip Back */}
            <button
              onClick={handleSkipBack}
              disabled={currentHour === 0}
              className="p-2 rounded-lg bg-elevated hover:bg-button-secondary border border-subtle transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={t('map.skipBack', { defaultValue: 'Skip back 6 hours' })}
            >
              <SkipBack size={18} className={`text-secondary ${isRTL ? 'rotate-180' : ''}`} />
            </button>

            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className={`flex-shrink-0 p-3 rounded-lg transition-all border-2 ${
                isPlaying
                  ? 'bg-accent/20 border-accent text-accent shadow-lg shadow-accent/20'
                  : 'bg-elevated border-subtle text-secondary hover:bg-button-secondary'
              }`}
              aria-label={isPlaying ? t('common.pause', { defaultValue: 'Pause' }) : t('common.play', { defaultValue: 'Play' })}
            >
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>

            {/* Skip Forward */}
            <button
              onClick={handleSkipForward}
              disabled={currentHour >= maxHours - 1}
              className="p-2 rounded-lg bg-elevated hover:bg-button-secondary border border-subtle transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label={t('map.skipForward', { defaultValue: 'Skip forward 6 hours' })}
            >
              <SkipForward size={18} className={`text-secondary ${isRTL ? 'rotate-180' : ''}`} />
            </button>

            {/* Speed Control */}
            <button
              onClick={handleSpeedToggle}
              className="px-4 py-2 rounded-lg bg-elevated hover:bg-button-secondary border border-subtle transition-all ml-auto"
              aria-label={t('map.playbackSpeed', { defaultValue: 'Playback speed' })}
            >
              <span className="text-sm font-bold text-primary">{speed}x</span>
            </button>

            {/* Speed indicator (visual only) */}
            <div className="hidden sm:flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full transition-all ${speed >= 1 ? 'bg-accent' : 'bg-subtle'}`} />
              <div className={`w-1.5 h-1.5 rounded-full transition-all ${speed >= 2 ? 'bg-accent' : 'bg-subtle'}`} />
              <div className={`w-1.5 h-1.5 rounded-full transition-all ${speed >= 4 ? 'bg-accent' : 'bg-subtle'}`} />
            </div>
          </div>

          {/* Status indicator */}
          {isPlaying && (
            <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-subtle">
              <div className="flex gap-1">
                <div className="w-1 h-3 bg-accent rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-3 bg-accent rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-3 bg-accent rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-accent font-medium">
                {t('map.animating', { defaultValue: 'Animating forecast' })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeSlider;
