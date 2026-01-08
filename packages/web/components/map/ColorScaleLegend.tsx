import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface ColorScaleItem {
  value: number;
  color: string;
  label?: string;
}

export interface ColorScaleLegendProps {
  scale: ColorScaleItem[];
  unit: string;
  title: string;
  position?: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  className?: string;
}

const POSITION_CLASSES = {
  topleft: 'top-4 left-4',
  topright: 'top-4 right-4',
  bottomleft: 'bottom-4 left-4',
  bottomright: 'bottom-4 right-4',
} as const;

export const ColorScaleLegend: React.FC<ColorScaleLegendProps> = ({
  scale,
  unit,
  title,
  position = 'bottomright',
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  // Sort scale items by value in descending order (highest at top)
  const sortedScale = useMemo(() => {
    return [...scale].sort((a, b) => b.value - a.value);
  }, [scale]);

  // Generate CSS gradient from sorted scale
  const gradientStops = useMemo(() => {
    if (sortedScale.length === 0) return '';

    const totalRange = sortedScale[0].value - sortedScale[sortedScale.length - 1].value;
    if (totalRange === 0) return sortedScale[0].color;

    return sortedScale
      .map((item, index) => {
        const position = ((sortedScale[0].value - item.value) / totalRange) * 100;
        return `${item.color} ${position.toFixed(1)}%`;
      })
      .join(', ');
  }, [sortedScale]);

  if (scale.length === 0) {
    return null;
  }

  return (
    <div
      className={`absolute z-[350] ${POSITION_CLASSES[position]} ${className} pointer-events-none`}
      style={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
      <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl overflow-hidden w-[110px] animate-in fade-in slide-in-from-bottom-4 pointer-events-auto">
        {/* Header */}
        <div className="px-2 py-1.5 border-b border-slate-700/50 bg-slate-800/50">
          <h3 className="text-[10px] font-bold text-white uppercase tracking-wide truncate">
            {title}
          </h3>
        </div>

        {/* Gradient Bar & Labels */}
        <div className="p-2">
          <div className="flex gap-2">
            {/* Gradient Bar */}
            <div className="relative w-6 h-32 rounded overflow-hidden shadow-inner border border-slate-700/50">
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, ${gradientStops})`,
                }}
              />
            </div>

            {/* Value Labels */}
            <div className="flex-1 relative h-32 flex flex-col justify-between py-0.5">
              {sortedScale.map((item, index) => {
                const isFirst = index === 0;
                const isLast = index === sortedScale.length - 1;

                return (
                  <div
                    key={index}
                    className={`flex items-center ${
                      isFirst ? 'justify-start' : isLast ? 'justify-end' : 'justify-center'
                    } flex-col h-0 relative`}
                    style={{
                      top: isFirst ? '0%' : isLast ? '100%' : `${(index / (sortedScale.length - 1)) * 100}%`,
                    }}
                  >
                    {/* Tick Mark */}
                    <div
                      className="absolute h-px bg-slate-600/80"
                      style={{
                        width: '6px',
                        [isRTL ? 'right' : 'left']: '-8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                    />

                    {/* Value Text */}
                    <div
                      className={`text-[9px] font-bold text-white leading-none whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
                        isFirst ? 'mb-auto' : isLast ? 'mt-auto' : ''
                      }`}
                    >
                      {item.label || item.value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unit Label */}
          <div className="mt-1.5 text-center">
            <span className="text-[8px] font-semibold text-slate-300 uppercase tracking-widest px-1.5 py-0.5 bg-slate-800/60 rounded border border-slate-700/40">
              {unit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorScaleLegend;
