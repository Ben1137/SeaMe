# Tailwind CSS Theme Configuration Guide

This guide explains how the Deep Ocean (Light Mode) and Night Watch (Dark Mode) themes are configured using Tailwind CSS v4.

## Overview

The project uses a three-layer theming system:

1. **CSS Variables** (`src/index.css`) - Define base colors and semantic mappings
2. **Tailwind Config** (`tailwind.config.js`) - Expose colors as Tailwind utilities
3. **Theme Context** (React) - Dynamically switches between light/dark modes

## Architecture

### Layer 1: CSS Variables (src/index.css)

CSS variables are defined at the root level and change based on the `.light` or `.dark` class applied to the document element:

```css
:root {
  /* Base palette - Deep Ocean (Light Mode) */
  --color-ocean-dark: #031e3d;
  --color-ocean-base: #082d5d;
  --color-ocean-border: #01658d;
  --color-ocean-teal: #008d8d;
  --color-ocean-aqua: #54e0ca;

  /* Base palette - Night Watch (Dark Mode) */
  --color-night-950: #020617;
  --color-night-900: #0f172a;
  --color-night-800: #1e293b;
}

:root.dark {
  /* Ocean variables remap to Night Watch colors */
  --color-ocean-dark: #020617;  /* night-950 */
  --color-ocean-base: #0f172a;  /* night-900 */
  --color-ocean-border: #1e293b; /* night-800 */
  --color-ocean-teal: #2563eb;
  --color-ocean-aqua: #60a5fa;
}
```

### Layer 2: Tailwind Configuration (tailwind.config.js)

The Tailwind config exposes these CSS variables as utility classes:

```javascript
export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ocean: {
          dark: 'var(--color-ocean-dark)',
          base: 'var(--color-ocean-base)',
          border: 'var(--color-ocean-border)',
          teal: 'var(--color-ocean-teal)',
          aqua: 'var(--color-ocean-aqua)',
        },
        night: {
          950: 'var(--color-night-950)',
          900: 'var(--color-night-900)',
          800: 'var(--color-night-800)',
        },
      },
    },
  },
}
```

### Layer 3: Theme Context (React)

ThemeContext (or similar) toggles the `dark` class on `document.documentElement`, triggering CSS variable remapping.

## Available Tailwind Utilities

### Ocean Theme Colors (Theme-Aware)

These automatically switch between Deep Ocean and Night Watch:

| Class | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `bg-ocean-dark` | #031e3d | #020617 | Card backgrounds |
| `bg-ocean-base` | #082d5d | #0f172a | Main app background |
| `border-ocean-border` | #01658d | #1e293b | Borders |
| `bg-ocean-teal` | #008d8d | #2563eb | Buttons/accents |
| `text-ocean-aqua` | #54E0CA | #60a5fa | Text highlights/icons |

### Night Theme Colors (Static)

These are direct references and don't change:

| Class | Color | Usage |
|-------|-------|-------|
| `bg-night-950` | #020617 | Darkest background |
| `bg-night-900` | #0f172a | Dark background |
| `bg-night-800` | #1e293b | Medium dark background |

## Usage Examples

### Background Colors

```tsx
// Main app container with theme-aware background
<div className="min-h-screen bg-ocean-base">
  <div className="bg-ocean-dark rounded-lg p-6">
    Card content
  </div>
</div>
```

### Borders

```tsx
<div className="border-2 border-ocean-border rounded-lg p-4">
  Bordered content
</div>
```

### Buttons

```tsx
<button className="bg-ocean-teal hover:bg-ocean-aqua text-white px-6 py-2 rounded-lg transition-colors">
  Primary Action
</button>
```

### Text Colors

```tsx
<h1 className="text-ocean-aqua text-3xl font-bold">
  Highlighted Heading
</h1>
```

### Complete Component Example

```tsx
export function WeatherCard({ data }) {
  return (
    <div className="bg-ocean-dark border border-ocean-border rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-ocean-base px-6 py-4 border-b border-ocean-border">
        <h2 className="text-ocean-aqua text-2xl font-semibold">
          Marine Forecast
        </h2>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <p className="text-white">
          Current conditions for your location
        </p>

        {/* Action */}
        <button className="w-full bg-ocean-teal hover:bg-ocean-aqua text-white font-medium py-3 rounded-lg transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
}
```

### Responsive + Dark Mode Example

While the ocean colors automatically adapt, you can still use Tailwind's `dark:` prefix with other utilities:

```tsx
<div className="bg-ocean-base p-8 dark:shadow-2xl">
  <h1 className="text-ocean-aqua text-4xl md:text-6xl font-bold">
    SeaYou
  </h1>
  <p className="text-white opacity-90 dark:opacity-100 mt-4">
    Marine weather at your fingertips
  </p>
</div>
```

## Custom Semantic Utilities

The `index.css` file also defines semantic utility classes that are pre-configured for common use cases:

```css
.bg-app-base     /* Main application background */
.bg-card         /* Card backgrounds */
.bg-button       /* Primary button (with hover) */
.border-app      /* Primary borders */
.text-primary    /* High contrast text */
.text-accent     /* Accent text */
```

These can be used alongside Tailwind classes:

```tsx
<div className="bg-card border-app border rounded-lg p-4">
  <p className="text-primary">High contrast text</p>
  <span className="text-accent">Highlighted text</span>
</div>
```

## Color Palette Reference

### Deep Ocean (Light Mode)

- **Base Background**: #082d5d (Madison Blue)
- **Card Background**: #031e3d (Deep Navy)
- **Border**: #01658d (Ocean Blue)
- **Accent/Teal**: #008d8d (Teal)
- **Highlight/Aqua**: #54E0CA (Aqua)

### Night Watch (Dark Mode)

- **Base Background**: #020617 (Slate 950 - Darkest)
- **Card Background**: #0f172a (Slate 900 - Lighter for contrast)
- **Border**: #1e293b (Slate 800)
- **Accent**: #2563eb (Blue 600)
- **Highlight**: #60a5fa (Blue 400)

## Best Practices

### ✅ DO

- Use `ocean-*` colors for theme-aware components
- Combine with Tailwind's spacing, typography, and layout utilities
- Use semantic custom classes (`.bg-card`, `.text-primary`) for common patterns
- Test components in both light and dark modes

### ❌ DON'T

- Don't mix `ocean-*` with `dark:` prefixes (ocean colors already adapt)
- Don't hardcode hex values - use the configured colors
- Don't use `night-*` colors for theme-aware components (they're static)

## Tailwind v4 Compatibility

This configuration is compatible with Tailwind CSS v4.1.18 using the PostCSS plugin:

```javascript
// postcss.config.js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

The traditional `tailwind.config.js` format works seamlessly with Tailwind v4's PostCSS plugin, allowing CSS variable references to be exposed as utility classes.

## Testing the Configuration

You can verify the configuration is working by:

1. **Build the project**: `pnpm build`
2. **Inspect generated CSS**: Check that `bg-ocean-*` classes reference the correct CSS variables
3. **Toggle theme**: Switch between light/dark mode and verify colors change
4. **Check IntelliSense**: VS Code should show autocomplete for `ocean-*` and `night-*` colors

## Extending the Theme

To add new colors:

1. **Add CSS variable** to `src/index.css`:
   ```css
   :root {
     --color-ocean-mint: #7bed9f;
   }
   ```

2. **Map to Tailwind** in `tailwind.config.js`:
   ```javascript
   ocean: {
     // ... existing colors
     mint: 'var(--color-ocean-mint)',
   }
   ```

3. **Use in components**:
   ```tsx
   <div className="bg-ocean-mint">...</div>
   ```

## Troubleshooting

### Colors not applying
- Ensure `@import "tailwindcss"` is at the top of `index.css`
- Verify PostCSS config includes `@tailwindcss/postcss`
- Check that CSS variables are defined before use

### Dark mode not switching
- Verify ThemeContext is toggling the `dark` class on `document.documentElement`
- Check browser DevTools to see if `.dark` class is present
- Ensure CSS variable overrides are in `:root.dark` selector

### IntelliSense not working
- Restart TypeScript/ESLint server in VS Code
- Ensure `tailwind.config.js` is in the correct location
- Check that Tailwind CSS IntelliSense extension is installed

## Related Files

- **Tailwind Config**: `packages/web/tailwind.config.js`
- **CSS Variables**: `packages/web/src/index.css`
- **PostCSS Config**: `packages/web/postcss.config.js`
- **Usage Examples**: `packages/web/THEME_USAGE_EXAMPLES.md`
