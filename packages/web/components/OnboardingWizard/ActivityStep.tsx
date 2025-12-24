/**
 * Step 2: Select Primary Activity
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { OnboardingStepProps, ActivityType, ACTIVITY_CONFIG } from '../../src/types/onboarding';

export const ActivityStep: React.FC<OnboardingStepProps> = ({
  onNext,
  onSkip,
  onPrevious,
  preferences,
  updatePreferences,
}) => {
  const { t } = useTranslation();
  const selectedActivity = preferences.primaryActivity;

  const handleSelectActivity = (activity: ActivityType) => {
    updatePreferences({ primaryActivity: activity });
  };

  const canContinue = selectedActivity !== null;

  const getColorClasses = (activity: ActivityType) => {
    const config = ACTIVITY_CONFIG[activity];
    const isSelected = selectedActivity === activity;

    const colorMap = {
      blue: {
        border: isSelected ? 'border-blue-500 shadow-blue-500/50' : 'border-slate-700',
        bg: isSelected ? 'bg-blue-500/20' : 'bg-slate-800/50',
        text: 'text-blue-400',
        hover: 'hover:border-blue-500/50',
      },
      purple: {
        border: isSelected ? 'border-purple-500 shadow-purple-500/50' : 'border-slate-700',
        bg: isSelected ? 'bg-purple-500/20' : 'bg-slate-800/50',
        text: 'text-purple-400',
        hover: 'hover:border-purple-500/50',
      },
      cyan: {
        border: isSelected ? 'border-cyan-500 shadow-cyan-500/50' : 'border-slate-700',
        bg: isSelected ? 'bg-cyan-500/20' : 'bg-slate-800/50',
        text: 'text-cyan-400',
        hover: 'hover:border-cyan-500/50',
      },
      yellow: {
        border: isSelected ? 'border-yellow-500 shadow-yellow-500/50' : 'border-slate-700',
        bg: isSelected ? 'bg-yellow-500/20' : 'bg-slate-800/50',
        text: 'text-yellow-400',
        hover: 'hover:border-yellow-500/50',
      },
    };

    return colorMap[config.color];
  };

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
          {t('ui.what_brings_you_here')}
        </h2>
        <p className="text-slate-400">
          {t('ui.choose_primary_activity')}
        </p>
      </div>

      {/* Activity Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {(Object.keys(ACTIVITY_CONFIG) as ActivityType[]).map((activity) => {
          const config = ACTIVITY_CONFIG[activity];
          const colors = getColorClasses(activity);
          const isSelected = selectedActivity === activity;

          return (
            <button
              key={activity}
              onClick={() => handleSelectActivity(activity)}
              className={`
                relative p-6 rounded-xl border-2 transition-all
                ${colors.border} ${colors.bg} ${colors.hover}
                ${isSelected ? 'shadow-lg transform scale-105' : 'hover:scale-102'}
              `}
            >
              {/* Check icon for selected */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className={`${colors.bg} p-1 rounded-full`}>
                    <Check size={16} className={colors.text} />
                  </div>
                </div>
              )}

              {/* Icon */}
              <div className="text-5xl mb-3">{config.icon}</div>

              {/* Label */}
              <h3 className={`text-xl font-bold mb-2 ${colors.text}`}>
                {config.label}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-400">
                {config.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center gap-4">
        <button
          onClick={onPrevious}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          {t('common.close') /* using common.close as Back fallback; replace with ui.back if preferred */}
        </button>

        <div className="flex gap-4">
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            {t('ui.skip')}
          </button>
          <button
            onClick={onNext}
            disabled={!canContinue}
            className={`
              flex items-center gap-2 font-bold py-3 px-6 rounded-xl transition-all
              ${
                canContinue
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }
            `}
          >
            {t('ui.continue')}
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
