/**
 * Wrapper component that adds Onboarding to the existing App
 */

import React from 'react';
import App from '../App';
import { OnboardingWizard } from './OnboardingWizard';

export const AppWithOnboarding: React.FC = () => {
  return (
    <>
      <App />
      <OnboardingWizard />
    </>
  );
};

export default AppWithOnboarding;
