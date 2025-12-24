/**
 * Types and interfaces for the onboarding wizard
 */

export type ActivityType = 'sailing' | 'surfing' | 'kite' | 'beach';

export interface LocationPreference {
  name: string;
  lat: number;
  lng: number;
  country?: string;
}

export interface AlertThresholds {
  waveHeight: number; // meters
  windSpeed: number; // km/h
  notifyWhenPerfect: boolean;
}

export interface OnboardingPreferences {
  completed: boolean;
  primaryActivity: ActivityType | null;
  location: LocationPreference | null;
  alerts: AlertThresholds;
  completedAt?: string;
}

export interface OnboardingStepProps {
  onNext: () => void;
  onSkip: () => void;
  onPrevious?: () => void;
  preferences: OnboardingPreferences;
  updatePreferences: (updates: Partial<OnboardingPreferences>) => void;
}

export const DEFAULT_PREFERENCES: OnboardingPreferences = {
  completed: false,
  primaryActivity: null,
  location: null,
  alerts: {
    waveHeight: 2.0,
    windSpeed: 40,
    notifyWhenPerfect: false,
  },
};

export const ACTIVITY_CONFIG = {
  sailing: {
    icon: '⛵',
    label: 'Sailing',
    description: 'Track winds, tides, and sea conditions',
    color: 'blue',
  },
  surfing: {
    icon: '🏄',
    label: 'Surfing',
    description: 'Monitor waves, swell, and surf forecasts',
    color: 'purple',
  },
  kite: {
    icon: '🪁',
    label: 'Kite Surfing',
    description: 'Optimize for wind speed and direction',
    color: 'cyan',
  },
  beach: {
    icon: '🏖️',
    label: 'Beach & Swimming',
    description: 'Check weather, UV, and water temperature',
    color: 'yellow',
  },
} as const;
