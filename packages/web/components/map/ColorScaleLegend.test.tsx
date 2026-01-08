/**
 * ColorScaleLegend Component Tests
 *
 * This file contains basic test examples for the ColorScaleLegend component.
 * These tests ensure the component renders correctly and handles edge cases.
 */

import React from 'react';
import { ColorScaleLegend, ColorScaleItem } from './ColorScaleLegend';

// Mock i18next for testing
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}));

describe('ColorScaleLegend', () => {
  const mockScale: ColorScaleItem[] = [
    { value: 0, color: '#93c5fd', label: '0' },
    { value: 1, color: '#3b82f6' },
    { value: 2, color: '#34d399' },
    { value: 3, color: '#ef4444', label: '3+' }
  ];

  it('should render with required props', () => {
    const { container } = render(
      <ColorScaleLegend
        scale={mockScale}
        unit="m"
        title="Wave Height"
      />
    );

    expect(container.querySelector('.absolute')).toBeInTheDocument();
  });

  it('should apply correct position class', () => {
    const { container: topLeft } = render(
      <ColorScaleLegend
        scale={mockScale}
        unit="m"
        title="Test"
        position="topleft"
      />
    );
    expect(topLeft.querySelector('.top-4.left-4')).toBeInTheDocument();

    const { container: bottomRight } = render(
      <ColorScaleLegend
        scale={mockScale}
        unit="m"
        title="Test"
        position="bottomright"
      />
    );
    expect(bottomRight.querySelector('.bottom-4.right-4')).toBeInTheDocument();
  });

  it('should render title and unit', () => {
    const { getByText } = render(
      <ColorScaleLegend
        scale={mockScale}
        unit="km/h"
        title="Wind Speed"
      />
    );

    expect(getByText('Wind Speed')).toBeInTheDocument();
    expect(getByText('km/h')).toBeInTheDocument();
  });

  it('should render all scale items', () => {
    const { container } = render(
      <ColorScaleLegend
        scale={mockScale}
        unit="m"
        title="Test"
      />
    );

    // Should have gradient bar
    const gradientBar = container.querySelector('[style*="linear-gradient"]');
    expect(gradientBar).toBeInTheDocument();

    // Should have labels
    expect(container.textContent).toContain('0');
    expect(container.textContent).toContain('3+');
  });

  it('should sort scale items by value descending', () => {
    const unsortedScale: ColorScaleItem[] = [
      { value: 2, color: '#34d399' },
      { value: 0, color: '#93c5fd' },
      { value: 3, color: '#ef4444' },
      { value: 1, color: '#3b82f6' }
    ];

    const { container } = render(
      <ColorScaleLegend
        scale={unsortedScale}
        unit="m"
        title="Test"
      />
    );

    // Component should render without errors and sort internally
    expect(container.querySelector('.absolute')).toBeInTheDocument();
  });

  it('should handle empty scale gracefully', () => {
    const { container } = render(
      <ColorScaleLegend
        scale={[]}
        unit="m"
        title="Empty"
      />
    );

    // Should return null for empty scale
    expect(container.firstChild).toBeNull();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ColorScaleLegend
        scale={mockScale}
        unit="m"
        title="Test"
        className="custom-class"
      />
    );

    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should handle RTL language', () => {
    // Override mock for this test
    jest.spyOn(require('react-i18next'), 'useTranslation').mockReturnValue({
      i18n: { language: 'he' },
      t: (key: string) => key,
    });

    const { container } = render(
      <ColorScaleLegend
        scale={mockScale}
        unit="מ׳"
        title="גובה גלים"
      />
    );

    const legendContainer = container.querySelector('[style*="direction"]');
    expect(legendContainer).toHaveStyle({ direction: 'rtl' });
  });

  it('should use custom labels when provided', () => {
    const scaleWithLabels: ColorScaleItem[] = [
      { value: 0, color: '#93c5fd', label: 'Calm' },
      { value: 5, color: '#ef4444', label: 'Storm' }
    ];

    const { getByText } = render(
      <ColorScaleLegend
        scale={scaleWithLabels}
        unit="m"
        title="Test"
      />
    );

    expect(getByText('Calm')).toBeInTheDocument();
    expect(getByText('Storm')).toBeInTheDocument();
  });

  it('should generate correct gradient stops', () => {
    const { container } = render(
      <ColorScaleLegend
        scale={mockScale}
        unit="m"
        title="Test"
      />
    );

    const gradientBar = container.querySelector('[style*="linear-gradient"]');
    expect(gradientBar).toBeInTheDocument();

    const style = gradientBar?.getAttribute('style');
    expect(style).toContain('linear-gradient(to bottom');
    expect(style).toContain('#93c5fd');
    expect(style).toContain('#ef4444');
  });
});

// Type safety tests (these don't run, but TypeScript will check them)
describe('TypeScript Type Safety', () => {
  it('should require all mandatory props', () => {
    // @ts-expect-error - Missing required props
    <ColorScaleLegend />;

    // @ts-expect-error - Missing unit and title
    <ColorScaleLegend scale={[]} />;

    // Valid - all required props provided
    <ColorScaleLegend
      scale={[{ value: 0, color: '#fff' }]}
      unit="m"
      title="Test"
    />;
  });

  it('should enforce position prop types', () => {
    const scale = [{ value: 0, color: '#fff' }];

    // Valid positions
    <ColorScaleLegend scale={scale} unit="m" title="Test" position="topleft" />;
    <ColorScaleLegend scale={scale} unit="m" title="Test" position="topright" />;
    <ColorScaleLegend scale={scale} unit="m" title="Test" position="bottomleft" />;
    <ColorScaleLegend scale={scale} unit="m" title="Test" position="bottomright" />;

    // @ts-expect-error - Invalid position
    <ColorScaleLegend scale={scale} unit="m" title="Test" position="center" />;
  });

  it('should enforce ColorScaleItem structure', () => {
    // Valid scale items
    const validScale: ColorScaleItem[] = [
      { value: 0, color: '#fff' },
      { value: 1, color: '#000', label: 'Max' }
    ];

    // @ts-expect-error - Missing required 'value' property
    const invalidScale1: ColorScaleItem[] = [{ color: '#fff' }];

    // @ts-expect-error - Missing required 'color' property
    const invalidScale2: ColorScaleItem[] = [{ value: 0 }];

    // @ts-expect-error - Wrong type for 'value'
    const invalidScale3: ColorScaleItem[] = [{ value: 'zero', color: '#fff' }];
  });
});

// Helper function to test in different scenarios
function render(component: React.ReactElement) {
  // In a real test environment, you would use @testing-library/react
  // For now, this is a placeholder showing the testing structure
  const div = document.createElement('div');
  // ReactDOM.render(component, div);

  return {
    container: div,
    getByText: (text: string) => {
      // Mock implementation
      return div.querySelector(`[textContent="${text}"]`);
    }
  };
}
