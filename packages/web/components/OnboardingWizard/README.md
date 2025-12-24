# Onboarding Wizard

A 4-step onboarding wizard for personalizing the SeaYou marine weather dashboard experience.

## Features

- **4-Step Flow**: Welcome → Activity Selection → Location Setup → Alert Configuration
- **First-time Only**: Shows only on first visit (uses localStorage)
- **Skip/Close Anytime**: Users can dismiss at any step
- **Progress Indicator**: Shows current step (1/4, 2/4, etc.)
- **Smooth Transitions**: Step animations and modal overlay
- **Mobile Responsive**: Works on all device sizes
- **Keyboard Navigation**: Full accessibility support
- **Persistent Storage**: Saves preferences to localStorage

## Architecture

### Components

1. **OnboardingWizard.tsx** - Main container component
2. **WelcomeStep.tsx** - Step 1: Introduction
3. **ActivityStep.tsx** - Step 2: Select primary activity
4. **LocationStep.tsx** - Step 3: Set location preferences
5. **AlertsStep.tsx** - Step 4: Configure alert thresholds

### Hook

**useOnboarding.ts** - Manages wizard state and localStorage persistence

### Types

**onboarding.ts** - TypeScript interfaces and types

## User Flow

### Step 1: Welcome
- SeaYou branding and introduction
- Feature highlights
- "Get Started" CTA

### Step 2: Activity Selection
Choose from:
- ⛵ Sailing - Track winds, tides, and sea conditions
- 🏄 Surfing - Monitor waves, swell, and surf forecasts
- 🪁 Kite Surfing - Optimize for wind speed and direction
- 🏖️ Beach & Swimming - Check weather, UV, and water temperature

### Step 3: Location
Options:
- Use GPS location (automatic)
- Manual search (city name)

### Step 4: Alerts (Optional)
Configure:
- Wave height threshold (0.5-5m)
- Wind speed threshold (0-80 km/h)
- Perfect conditions notifications

## LocalStorage Key

```
seayou_onboarding_complete
```

## Data Structure

```typescript
{
  completed: boolean;
  primaryActivity: 'sailing' | 'surfing' | 'kite' | 'beach' | null;
  location: {
    name: string;
    lat: number;
    lng: number;
    country?: string;
  } | null;
  alerts: {
    waveHeight: number;
    windSpeed: number;
    notifyWhenPerfect: boolean;
  };
  completedAt?: string; // ISO timestamp
}
```

## Usage

The wizard is automatically integrated via `AppWithOnboarding.tsx`:

```tsx
import { AppWithOnboarding } from './components/AppWithOnboarding';

// In index.tsx
root.render(
  <QueryClientProvider client={queryClient}>
    <AppWithOnboarding />
  </QueryClientProvider>
);
```

## Customization

### Colors
Activity cards use themed colors:
- Sailing: Blue
- Surfing: Purple
- Kite: Cyan
- Beach: Yellow

### Thresholds
Default alert thresholds can be modified in `src/types/onboarding.ts`:

```typescript
export const DEFAULT_PREFERENCES: OnboardingPreferences = {
  alerts: {
    waveHeight: 2.0,  // meters
    windSpeed: 40,    // km/h
    notifyWhenPerfect: false,
  },
};
```

## Testing

To reset onboarding (for testing):

```javascript
// In browser console
localStorage.removeItem('seayou_onboarding_complete');
location.reload();
```

## Accessibility

- ARIA labels on modal and buttons
- Keyboard navigation support
- Focus management
- Screen reader friendly

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Requires localStorage support
- Requires Geolocation API (optional)
