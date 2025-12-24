/**
 * Step 3: Set Location Preferences
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, MapPin, Search, Loader, Navigation as NavigationIcon } from 'lucide-react';
import { OnboardingStepProps } from '../../src/types/onboarding';
import { searchLocations, reverseGeocode } from '@seame/core';
import type { Location } from '@seame/core';

export const LocationStep: React.FC<OnboardingStepProps> = ({
  onNext,
  onSkip,
  onPrevious,
  preferences,
  updatePreferences,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const hasLocation = preferences.location !== null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchLocations(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = (location: Location) => {
    updatePreferences({
      location: {
        name: location.name,
        lat: location.lat,
        lng: location.lng,
        country: location.country,
      },
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert(t('ui.geolocation_not_supported'));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const resolvedLocation = await reverseGeocode(latitude, longitude);
          if (resolvedLocation) {
            updatePreferences({
              location: {
                name: resolvedLocation.name,
                lat: latitude,
                lng: longitude,
                country: resolvedLocation.country,
              },
            });
          } else {
            updatePreferences({
              location: {
                name: 'Current Location',
                lat: latitude,
                lng: longitude,
              },
            });
          }
        } catch (error) {
          console.error('Reverse geocode failed:', error);
          updatePreferences({
            location: {
              name: 'Current Location',
              lat: latitude,
              lng: longitude,
            },
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        if (error.code === 1) {
          alert('Location permission denied. Please enable location services.');
        } else if (error.code === 2) {
          alert('Location unavailable. Please check your device settings.');
        } else {
          alert('Location request timed out. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Where do you want to check conditions?
        </h2>
        <p className="text-slate-400">
          Set your preferred location for weather updates
        </p>
      </div>

      {/* Current Location Button */}
      <button
        onClick={handleUseCurrentLocation}
        disabled={isLocating}
        className="w-full mb-6 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-2 border-blue-600/50 rounded-xl p-4 flex items-center justify-center gap-3 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
            {isLocating ? (
            <>
            <Loader size={20} className="animate-spin" />
            {t('ui.detecting_location')}
          </>
        ) : (
          <>
            <NavigationIcon size={20} />
            {t('ui.use_my_current_location')}
          </>
        )}
      </button>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-700"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-slate-950 text-slate-500">{t('ui.or_search_for_a_location')}</span>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <input
          type="text"
          placeholder={t('ui.search_city_placeholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-800 border-2 border-slate-700 focus:border-blue-500 rounded-xl py-3 pl-12 pr-24 text-white placeholder-slate-500 focus:outline-none transition-colors"
        />
        <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
        <button
          type="submit"
          disabled={isSearching || !searchQuery.trim()}
          className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSearching ? t('ui.searching') : t('common.search')}
        </button>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="mb-6 bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-3 border-b border-slate-700 bg-slate-900/50">
            <h4 className="text-xs text-slate-400 uppercase font-bold">{t('ui.search_results')}</h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelectLocation(result)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-700/50 transition-colors border-b border-slate-800 last:border-b-0 text-left"
              >
                <div>
                      <div className="font-bold text-white">{result.name}</div>
                        <div className="text-xs text-slate-400">
                          {result.admin1} {result.country}
                        </div>
                </div>
                <MapPin size={16} className="text-blue-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Location Display */}
      {hasLocation && (
        <div className="mb-6 bg-green-500/10 border-2 border-green-500/50 rounded-xl p-4 flex items-center gap-3">
          <div className="bg-green-500/20 p-2 rounded-full">
            <MapPin size={20} className="text-green-400" />
          </div>
          <div className="flex-1">
            <div className="text-xs text-green-400 font-bold uppercase">{t('ui.selected_location')}</div>
            <div className="text-white font-bold">{preferences.location!.name}</div>
            {preferences.location!.country && (
              <div className="text-xs text-slate-400">{preferences.location!.country}</div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center gap-4 mt-8">
        <button
          onClick={onPrevious}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="flex gap-4">
          <button
            onClick={onSkip}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            Skip
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
          >
            Next
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
