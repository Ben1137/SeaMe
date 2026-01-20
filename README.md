# SeaYou - Marine Weather Dashboard 🌊

[![Deploy to GitHub Pages](https://github.com/Ben1137/SeaYou/actions/workflows/deploy.yml/badge.svg)](https://github.com/Ben1137/SeaYou/actions/workflows/deploy.yml)

SeaYou is a comprehensive, real-time marine weather dashboard designed for sailors, surfers, kite surfers, and beachgoers. It leverages the Open-Meteo API to provide high-resolution marine and atmospheric data, presented through a beautiful, interactive, and responsive UI.

## 🌐 Live Demo

**Try it now:** [https://ben1137.github.io/SeaYou/](https://ben1137.github.io/SeaYou/)

The app is deployed on GitHub Pages and updates automatically with every push to the main branch.

## 🚀 Features

### 🗺️ Interactive Map Visualization

- **Real-Time Marine Layers**:
  - **Wave Heatmap**: Canvas-based particle animation showing wave height and direction with smooth land masking
  - **Rain Radar**: Live precipitation data from RainViewer with 16-frame animation (13 past + 3 forecast)
  - **Wind/Current Velocity**: Animated vector field visualization using leaflet-velocity
  - **Sea Temperature**: Color-coded surface temperature overlay
  - **Bathymetry**: Ocean depth contours and seafloor topology
  - **Ports & Reefs**: Marine navigation points of interest
- **Point Forecast**: Click anywhere on the map to get detailed marine forecasts for that location
- **Layer Controls**: Toggle multiple visualization layers simultaneously
- **Smooth Performance**: Optimized rendering with intelligent layer caching (max 3 concurrent tile layers)

### 📊 Real-Time Marine Data

- **Activity Reports**: Dedicated summary cards for Sailing conditions, Surf ratings, Pole Surfing (Kite), and Beach comfort levels
- **Dynamic Icons**: Visual indicators that update based on live conditions (e.g., Waves vs. Swell icons, detailed weather animations)
- **Live Metrics**: Real-time display of:
  - Wind Speed & Direction
  - Wave Height & Period
  - Swell Height, Direction & Period
  - Air & Sea Temperatures
- **Multi-Location Support**: Search and save multiple coastal locations, quick-switch between them
- **Geolocation**: Automatic detection of your current position with reverse geocoding

### 📈 Interactive Graphs

- **Tabbed Interface**: Seamlessly switch between **Tide Schedules**, **Wave Forecasts**, and **Swell Forecasts**
- **Advanced Visualization**:
  - Dual-axis charts combining height (Area) and period (Line)
  - Tide charts with clear High/Low event markers and Mean Sea Level indication
  - Interactive tooltips for precise data analysis

### 📅 Detailed Forecasts

- **Persona-Based Tables**: Tailored 24-hour forecast views for different users:
  - **Mariner**: Pressure, Sea State, Visibility, Wind, Swell
  - **Surfer**: Detailed Wave vs. Swell analysis, Period, and experimental Surf Ratings
  - **Kite Surfer**: Wind Speed vs. Gusts, Direction, and riding conditions
  - **Beachgoer**: UV Index, "Sand Wind" factor, Temperature, and general comfort

### ⚡ Alert System

- **Customizable Thresholds**: User-configurable settings for Wave Height and Wind Speed alerts
- **Visual Warnings**:
  - **Storm Warning**: Severe weather conditions
  - **Rough Weather Advisory**: High winds/seas
  - **Tsunami Simulation**: Experimental alert mode for high-impact wave events

### 🎨 User Experience

- **Theme Support**: Dark mode, Light mode, and Auto mode (based on sunrise/sunset)
- **Internationalization**: Multi-language support (i18n ready)
- **PWA Support**: Install as a Progressive Web App with offline capabilities
- **Responsive Design**: Optimized for mobile, tablet, and desktop
- **Smart Caching**: Stale-while-revalidate pattern with React Query for instant loading
- **Error Boundaries**: Graceful error handling with automatic recovery

## 🛠️ Architecture

This project is a **Monorepo** managed with `pnpm` workspaces and `TurboRepo`.

- **packages/core**: Shared business logic, services, utilities, and TypeScript interfaces.
- **packages/web**: The main React web application (Vite).
- **packages/mobile**: (Upcoming) React Native mobile app.
- **packages/watch**: (Upcoming) Smartwatch companion app.

## 🛠️ Tech Stack

- **Monorepo Tools**: [pnpm](https://pnpm.io/), [TurboRepo](https://turbo.build/)
- **Frontend Framework**: [React 19](https://react.dev/) with [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [TanStack Query (React Query)](https://tanstack.com/query) for server state caching
- **Maps**: [Leaflet.js](https://leafletjs.com/) with [React Leaflet](https://react-leaflet.js.org/)
  - [leaflet-velocity](https://github.com/onaci/leaflet-velocity) for wind/current visualization
- **Charts**: [Recharts](https://recharts.org/) for time-series graphs
- **Icons**: [Lucide React](https://lucide.dev/)
- **Color Manipulation**: [chroma-js](https://gka.github.io/chroma.js/) for heatmap gradients
- **Internationalization**: [i18next](https://www.i18next.com/) with [react-i18next](https://react.i18next.com/)
- **PWA**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) with [Workbox](https://developer.chrome.com/docs/workbox/)
- **Data Sources**:
  - [Open-Meteo API](https://open-meteo.com/) (Marine & Forecast APIs)
  - [RainViewer API](https://www.rainviewer.com/api.html) for precipitation radar
- **Date Handling**: [date-fns](https://date-fns.org/)
- **Error Handling**: [react-error-boundary](https://github.com/bvaughn/react-error-boundary)
- **Deployment**: GitHub Actions → GitHub Pages

## 📦 Local Development

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

### Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Ben1137/SeaYou.git
    cd SeaYou
    ```

2.  **Install dependencies:**

    ```bash
    pnpm install
    ```

3.  **Run the development server:**

    ```bash
    pnpm dev
    ```

4.  **Open in Browser:**
    Navigate to `http://localhost:5173/SeaYou/`

### Build for Production

```bash
pnpm build
```

The optimized production build will be in the `dist/` directory.

## 🚀 Deployment

This project uses **GitHub Actions** for automatic deployment to GitHub Pages.

### How It Works

1. Push changes to the `main` branch
2. GitHub Actions automatically builds the app
3. Deploys to GitHub Pages (usually takes 2-3 minutes)
4. Live site updates at: https://ben1137.github.io/SeaYou/

### Deployment Configuration

- **Workflow**: `.github/workflows/deploy.yml`
- **Build Tool**: Vite with base path `/SeaYou/`
- **Hosting**: GitHub Pages (free, HTTPS enabled)

### Manual Deployment

You can also trigger a deployment manually:

1. Go to the [Actions tab](https://github.com/Ben1137/SeaYou/actions)
2. Select "Deploy to GitHub Pages"
3. Click "Run workflow"

## 🌍 Configuration

### API Integration

No API keys are required. The app makes client-side requests to free, public APIs:

**Open-Meteo** (Marine & Weather Data):
- `https://marine-api.open-meteo.com/v1/marine` - Wave height, swell, sea temperature, currents
- `https://api.open-meteo.com/v1/forecast` - Atmospheric conditions, wind, precipitation
- `https://geocoding-api.open-meteo.com/v1/search` - Location search and reverse geocoding

**RainViewer** (Rain Radar):
- `https://api.rainviewer.com/public/weather-maps.json` - Live precipitation frames

### Default Location

The app attempts to use your browser's geolocation. If denied or unavailable, it defaults to Tel Aviv, Israel. You can:
- Search for any coastal location worldwide
- Save multiple locations for quick access
- Switch between saved locations instantly

### Customization

To change default behavior, modify constants in:
- `packages/core/constants.ts` - Default coordinates, refresh intervals
- `packages/web/App.tsx` - Location initialization logic

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available for personal and educational use.

## ⚡ Performance & Optimizations

Recent improvements to ensure smooth performance:

- **Rain Radar Memory Management**: Intelligent layer caching limits concurrent tile layers to 3 (current frame ±1), preventing memory overflow and network congestion during zoom operations
- **Wave Heatmap Enhancements**:
  - Smooth land masking with 4px blur radius to prevent particle overlap on coastlines
  - Optimized particle animation speed and trail duration for better visibility
  - Canvas-based rendering with WebGL fallback
- **Canvas Stability**: Patched Leaflet Canvas renderer to handle rapid initialization/cleanup cycles without errors
- **Smart Data Fetching**: React Query implementation with stale-while-revalidate pattern for instant loading and background updates
- **Error Boundaries**: Component-level error isolation prevents full app crashes

## 🙏 Acknowledgments

- Marine and weather data provided by [Open-Meteo](https://open-meteo.com/)
- Rain radar data by [RainViewer](https://www.rainviewer.com/)
- Icons by [Lucide](https://lucide.dev/)
- Charts powered by [Recharts](https://recharts.org/)
- Maps powered by [Leaflet](https://leafletjs.com/)

---

**Live Demo:** [https://ben1137.github.io/SeaYou/](https://ben1137.github.io/SeaYou/) 🌊⛵
