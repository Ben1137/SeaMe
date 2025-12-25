# Theme Color Usage Examples

This document shows how to use the Deep Ocean (Light Mode) and Night Watch (Dark Mode) theme colors with Tailwind CSS.

## Theme-Aware Utility Classes (Recommended)

These semantic utility classes automatically adapt to the current theme and are the **preferred way** to style components. They eliminate the need for conditional logic and complex Tailwind class combinations.

### Background Utilities
- `.bg-app-base` - Main application background
- `.bg-card` - Card and container backgrounds
- `.bg-elevated` - Elevated surfaces (modals, popovers)
- `.bg-button` - Primary button backgrounds (with automatic hover state)
- `.bg-button-secondary` - Secondary button backgrounds (with automatic hover state)
- `.bg-hover` - Hover state backgrounds
- `.bg-active` - Active state backgrounds
- `.bg-selected` - Selected item backgrounds

### Border Utilities
- `.border-app` - Primary borders
- `.border-subtle` - Subtle borders and dividers

### Text Utilities
- `.text-primary` - Primary text (highest contrast)
- `.text-secondary` - Secondary text (medium contrast)
- `.text-muted` - Muted text (lower contrast)
- `.text-accent` - Accent/highlight text

### Chart Utilities
- `.chart-primary` - Primary chart color (stroke & fill)
- `.chart-secondary` - Secondary chart color (stroke & fill)
- `.chart-tertiary` - Tertiary chart color (stroke & fill)
- `.chart-grid` - Chart grid lines (stroke)
- `.chart-text` - Chart text labels (fill)

## Tailwind Color Classes (Alternative)

You can also use Tailwind's `bg-*`, `text-*`, and `border-*` classes with the theme colors:

### Ocean Theme (Primary - works in both modes via CSS variables)
- `bg-ocean-dark` - Card backgrounds (#031e3d in light, #020617 in dark)
- `bg-ocean-base` - Main app background (#082d5d in light, #0f172a in dark)
- `border-ocean-border` - Borders (#01658d in light, #1e293b in dark)
- `bg-ocean-teal` - Buttons/accents (#008d8d in light, #2563eb in dark)
- `text-ocean-aqua` - Text highlights/icons (#54E0CA in light, #60a5fa in dark)

### Night Theme (Direct references - static values)
- `bg-night-950` - Darkest shade (#020617)
- `bg-night-900` - Dark shade (#0f172a)
- `bg-night-800` - Medium dark shade (#1e293b)

## Usage Examples

### Using Theme-Aware Utility Classes (Recommended)

```tsx
// Simple card component - no conditional logic needed!
export const WeatherCard = ({ title, value }) => {
  return (
    <div className="bg-card border border-app rounded-lg p-6 shadow-lg">
      <h2 className="text-accent text-2xl font-bold mb-4">
        {title}
      </h2>
      <p className="text-primary text-3xl">
        {value}
      </p>
      <p className="text-muted text-sm mt-2">
        Updated just now
      </p>
      <button className="bg-button px-4 py-2 rounded mt-4">
        View Details
      </button>
    </div>
  );
};

// App layout with theme-aware backgrounds
export const AppLayout = ({ children }) => {
  return (
    <div className="bg-app-base min-h-screen">
      <nav className="bg-card border-b border-app p-4">
        <h1 className="text-primary text-xl font-bold">SeaYou</h1>
      </nav>
      <main className="p-4">
        {children}
      </main>
    </div>
  );
};

// Interactive list with hover and selected states
export const LocationList = ({ items, selectedId, onSelect }) => {
  return (
    <div className="space-y-2">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={`
            w-full p-3 rounded-lg border
            ${item.id === selectedId ? 'bg-selected border-app' : 'border-subtle bg-hover'}
          `}
        >
          <span className={item.id === selectedId ? 'text-primary' : 'text-secondary'}>
            {item.name}
          </span>
        </button>
      ))}
    </div>
  );
};

// Chart component using chart utilities
export const SeaLevelChart = ({ data }) => {
  return (
    <div className="bg-card border border-app rounded-lg p-4">
      <h3 className="text-primary font-bold mb-4">Sea Level Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid className="chart-grid" strokeDasharray="3 3" />
          <XAxis dataKey="time" className="chart-text" />
          <YAxis className="chart-text" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--app-bg-card)',
              border: '1px solid var(--app-border)',
              color: 'var(--text-primary)'
            }}
          />
          <Line
            type="monotone"
            dataKey="level"
            className="chart-primary"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

### Using Tailwind Color Classes (Alternative)

```tsx
// Card with ocean-dark background (adapts to theme)
<div className="bg-ocean-dark p-4 rounded-lg">
  Card content
</div>

// Main app background
<div className="bg-ocean-base min-h-screen">
  App content
</div>

// Border using ocean theme
<div className="border border-ocean-border rounded-lg">
  Bordered content
</div>

// Button with ocean-teal background
<button className="bg-ocean-teal hover:bg-ocean-aqua px-4 py-2 rounded">
  Click me
</button>

// Text with aqua highlight
<span className="text-ocean-aqua font-semibold">
  Highlighted text
</span>
```

## How It Works

### Theme-Aware Utility Classes

The utility classes in `src/index.css` use CSS custom properties (variables) that automatically change based on the theme:

```css
/* Utility class definition */
.bg-app-base {
  background-color: var(--app-bg-base);
}

/* Light mode (default) */
:root.light {
  --app-bg-base: #082d5d; /* Deep Ocean blue */
}

/* Dark mode */
:root.dark {
  --app-bg-base: #0f172a; /* Night Watch slate */
}
```

When the theme changes (via ThemeContext adding `.light` or `.dark` to `documentElement`), all elements using these utility classes automatically update with smooth transitions.

### Tailwind Color Classes

The Tailwind configuration in `tailwind.config.js` maps color utilities to CSS variables:

```javascript
ocean: {
  dark: 'var(--color-ocean-dark)',
  base: 'var(--color-ocean-base)',
  // etc.
}
```

These CSS variables are defined in `src/index.css` and change their values when the `dark` class is applied to the root element.

## Migration from Existing Code

### From Hardcoded Colors with dark: Prefix

**Before:**
```tsx
<div className="bg-slate-900 dark:bg-slate-950 border-slate-800 dark:border-slate-700">
  <h2 className="text-white">Title</h2>
  <p className="text-slate-300 dark:text-slate-400">Description</p>
</div>
```

**After (using utility classes):**
```tsx
<div className="bg-card border border-app">
  <h2 className="text-primary">Title</h2>
  <p className="text-secondary">Description</p>
</div>
```

### Benefits of Theme-Aware Utility Classes

1. **No Conditional Logic**: Classes automatically adapt without `dark:` prefixes or conditional class names
2. **Consistent Theming**: All components use the same semantic color system
3. **Easier Maintenance**: Update theme colors in one place (index.css) instead of throughout components
4. **Smooth Transitions**: All theme-dependent properties transition smoothly (0.2s)
5. **Better DX**: Self-documenting class names that describe purpose, not color values

### CSS Variable Reference

You can also use CSS variables directly in inline styles or custom CSS:

```tsx
// In React components
<div style={{ backgroundColor: 'var(--app-bg-card)' }}>
  Card content
</div>

// In custom CSS
.my-custom-element {
  background: var(--app-bg-base);
  color: var(--text-primary);
  border: 1px solid var(--app-border);
}
```

### Available CSS Variables

**Backgrounds:**
- `--app-bg-base` - Main app background
- `--app-bg-card` - Card backgrounds
- `--app-bg-elevated` - Elevated surfaces
- `--bg-button` - Primary buttons
- `--bg-button-hover` - Button hover state
- `--bg-button-secondary` - Secondary buttons
- `--bg-button-secondary-hover` - Secondary button hover
- `--bg-hover` - Hover states
- `--bg-active` - Active states
- `--bg-selected` - Selected states

**Borders:**
- `--app-border` - Primary borders
- `--app-border-subtle` - Subtle borders

**Text:**
- `--text-primary` - Primary text
- `--text-secondary` - Secondary text
- `--text-muted` - Muted text
- `--text-accent` - Accent/highlight text

**Charts:**
- `--chart-primary` - Primary chart color
- `--chart-secondary` - Secondary chart color
- `--chart-tertiary` - Tertiary chart color
- `--chart-grid` - Grid lines
- `--chart-text` - Chart labels
