/**
 * Hook for managing onboarding wizard state and localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';
import { OnboardingPreferences, DEFAULT_PREFERENCES } from '../types/onboarding';

const STORAGE_KEY = 'seayou_onboarding_complete';

export function useOnboarding() {
  const [preferences, setPreferences] = useState<OnboardingPreferences>(DEFAULT_PREFERENCES);
  const [currentStep, setCurrentStep] = useState(1);
  const [isOpen, setIsOpen] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as OnboardingPreferences;
        setPreferences(parsed);
        setIsOpen(!parsed.completed);
      } else {
        // First time user - show onboarding
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Failed to load onboarding preferences:', error);
      setIsOpen(true);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((prefs: OnboardingPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to save onboarding preferences:', error);
    }
  }, []);

  // Update preferences
  const updatePreferences = useCallback(
    (updates: Partial<OnboardingPreferences>) => {
      const updated = { ...preferences, ...updates };
      setPreferences(updated);
      // Don't save to localStorage until completion
    },
    [preferences]
  );

  // Complete onboarding
  const completeOnboarding = useCallback(() => {
    const completed: OnboardingPreferences = {
      ...preferences,
      completed: true,
      completedAt: new Date().toISOString(),
    };
    savePreferences(completed);
    setIsOpen(false);
  }, [preferences, savePreferences]);

  // Skip onboarding
  const skipOnboarding = useCallback(() => {
    const skipped: OnboardingPreferences = {
      ...DEFAULT_PREFERENCES,
      completed: true,
      completedAt: new Date().toISOString(),
    };
    savePreferences(skipped);
    setIsOpen(false);
  }, [savePreferences]);

  // Reset onboarding (for testing)
  const resetOnboarding = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPreferences(DEFAULT_PREFERENCES);
    setCurrentStep(1);
    setIsOpen(true);
  }, []);

  // Navigate to next step
  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  }, []);

  // Navigate to previous step
  const previousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  // Close wizard (skip or complete)
  const closeWizard = useCallback(() => {
    if (currentStep === 4) {
      completeOnboarding();
    } else {
      skipOnboarding();
    }
  }, [currentStep, completeOnboarding, skipOnboarding]);

  return {
    preferences,
    updatePreferences,
    currentStep,
    nextStep,
    previousStep,
    completeOnboarding,
    skipOnboarding,
    closeWizard,
    resetOnboarding,
    isOpen,
    setIsOpen,
  };
}
