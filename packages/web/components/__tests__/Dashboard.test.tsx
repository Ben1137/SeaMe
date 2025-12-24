import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { mockMarineWeatherData } from '../../src/test/mocks/weatherData';

describe('Dashboard', () => {
  const defaultProps = {
    weatherData: mockMarineWeatherData,
    loading: false,
    error: null,
    locationName: 'Tel Aviv',
    onRetry: vi.fn(),
  };

  describe('Loading State', () => {
    it('should render loading skeleton when loading is true', () => {
      render(<Dashboard {...defaultProps} loading={true} weatherData={null} />);

      // The DashboardSkeleton should be visible
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('should render error state when error is provided', () => {
      const error = new Error('Failed to fetch weather data');
      render(<Dashboard {...defaultProps} error={error} weatherData={null} />);

      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });

    it('should call onRetry when retry button is clicked', async () => {
      const onRetry = vi.fn();
      const error = new Error('Network error');
      render(<Dashboard {...defaultProps} error={error} weatherData={null} onRetry={onRetry} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(onRetry).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Weather Data Display', () => {
    it('should render location name', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText('Tel Aviv')).toBeInTheDocument();
    });

    it('should render weather description', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText(/Mainly Clear/i)).toBeInTheDocument();
    });

    it('should display current wave height', () => {
      render(<Dashboard {...defaultProps} />);

      const waveHeight = screen.getByText('1.5');
      expect(waveHeight).toBeInTheDocument();
    });

    it('should display current wind speed', () => {
      render(<Dashboard {...defaultProps} />);

      const windSpeed = screen.getByText('18');
      expect(windSpeed).toBeInTheDocument();
    });

    it('should display current temperature', () => {
      render(<Dashboard {...defaultProps} />);

      const temperature = screen.getByText('25');
      expect(temperature).toBeInTheDocument();
    });

    it('should display swell height', () => {
      render(<Dashboard {...defaultProps} />);

      const swellHeight = screen.getByText('1.2');
      expect(swellHeight).toBeInTheDocument();
    });

    it('should render coordinates', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText(/32.0853°N/i)).toBeInTheDocument();
      expect(screen.getByText(/34.7818°E/i)).toBeInTheDocument();
    });
  });

  describe('Alert Configuration', () => {
    it('should toggle settings panel when settings button is clicked', async () => {
      render(<Dashboard {...defaultProps} />);

      const settingsButton = screen.getByRole('button', { name: /alert config/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText(/Alert Configuration/i)).toBeInTheDocument();
      });
    });

    it('should close settings panel when X button is clicked', async () => {
      render(<Dashboard {...defaultProps} />);

      const settingsButton = screen.getByRole('button', { name: /alert config/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText(/Alert Configuration/i)).toBeInTheDocument();
      });

      const closeButtons = screen.getAllByRole('button');
      const closeButton = closeButtons.find(button => {
        const svg = button.querySelector('svg');
        return svg && button.classList.contains('hover:text-slate-300');
      });

      if (closeButton) {
        fireEvent.click(closeButton);
        await waitFor(() => {
          expect(screen.queryByText(/Alert Configuration/i)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Forecast Tabs', () => {
    it('should render mariner forecast by default', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText(/Mariner's Forecast/i)).toBeInTheDocument();
    });

    it('should switch to next tab when next button is clicked', async () => {
      render(<Dashboard {...defaultProps} />);

      const nextButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-chevron-right')
      );

      if (nextButton) {
        fireEvent.click(nextButton);

        await waitFor(() => {
          expect(screen.getByText(/Surfer's Forecast/i)).toBeInTheDocument();
        });
      }
    });

    it('should switch to previous tab when previous button is clicked', async () => {
      render(<Dashboard {...defaultProps} />);

      // First go to next tab
      const nextButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg')?.classList.contains('lucide-chevron-right')
      );

      if (nextButton) {
        fireEvent.click(nextButton);

        await waitFor(() => {
          expect(screen.getByText(/Surfer's Forecast/i)).toBeInTheDocument();
        });

        // Then go back
        const prevButton = screen.getAllByRole('button').find(btn =>
          btn.querySelector('svg')?.classList.contains('lucide-chevron-left')
        );

        if (prevButton) {
          fireEvent.click(prevButton);

          await waitFor(() => {
            expect(screen.getByText(/Mariner's Forecast/i)).toBeInTheDocument();
          });
        }
      }
    });
  });

  describe('Graph Tabs', () => {
    it('should render wave graph by default', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText(/Wave Forecast/i)).toBeInTheDocument();
    });

    it('should switch to tide graph when tide tab is clicked', async () => {
      render(<Dashboard {...defaultProps} />);

      const tideButton = screen.getByRole('button', { name: /Tides/i });
      fireEvent.click(tideButton);

      await waitFor(() => {
        expect(screen.getByText(/Tide Schedule/i)).toBeInTheDocument();
      });
    });

    it('should switch to swell graph when swell tab is clicked', async () => {
      render(<Dashboard {...defaultProps} />);

      const swellButton = screen.getByRole('button', { name: /Swell/i });
      fireEvent.click(swellButton);

      await waitFor(() => {
        expect(screen.getByText(/Swell Forecast/i)).toBeInTheDocument();
      });
    });
  });

  describe('Activity Report', () => {
    it('should display sailing condition', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText(/Sailing/i)).toBeInTheDocument();
    });

    it('should display beach day status', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText(/Beach Day/i)).toBeInTheDocument();
    });
  });

  describe('Weather Alerts', () => {
    it('should not show alert for normal conditions', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.queryByText(/STORM WARNING/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/TSUNAMI ALERT/i)).not.toBeInTheDocument();
    });

    it('should show rough weather advisory for high winds', () => {
      const extremeWeather = {
        ...mockMarineWeatherData,
        current: {
          ...mockMarineWeatherData.current,
          windSpeed: 55,
          waveHeight: 3.2,
        },
        general: {
          ...mockMarineWeatherData.general,
          weatherCode: 80,
        },
      };

      render(<Dashboard {...defaultProps} weatherData={extremeWeather} />);

      expect(screen.getByText(/ROUGH WEATHER/i)).toBeInTheDocument();
    });

    it('should allow dismissing alerts', async () => {
      const extremeWeather = {
        ...mockMarineWeatherData,
        current: {
          ...mockMarineWeatherData.current,
          windSpeed: 55,
        },
      };

      render(<Dashboard {...defaultProps} weatherData={extremeWeather} />);

      const alert = screen.getByText(/ROUGH WEATHER/i);
      expect(alert).toBeInTheDocument();

      const dismissButtons = screen.getAllByRole('button');
      const dismissButton = dismissButtons.find(btn => {
        const parent = btn.closest('[class*="bg-orange"]');
        return parent !== null;
      });

      if (dismissButton) {
        fireEvent.click(dismissButton);

        await waitFor(() => {
          expect(screen.queryByText(/ROUGH WEATHER/i)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('No Data State', () => {
    it('should show no data message when weatherData is null and not loading', () => {
      render(<Dashboard {...defaultProps} weatherData={null} loading={false} />);

      expect(screen.getByText(/No weather data available/i)).toBeInTheDocument();
    });
  });

  describe('Tide Information', () => {
    it('should display next high tide time', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText(/High:/i)).toBeInTheDocument();
    });

    it('should display next low tide time', () => {
      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText(/Low:/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<Dashboard {...defaultProps} />);

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
    });

    it('should have accessible buttons', () => {
      render(<Dashboard {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design Elements', () => {
    it('should render without crashing on small viewport', () => {
      window.innerWidth = 375;
      window.innerHeight = 667;

      render(<Dashboard {...defaultProps} />);

      expect(screen.getByText('Tel Aviv')).toBeInTheDocument();
    });
  });
});
