# SeaMe - Marine Weather Dashboard 🌊

SeaMe is a comprehensive, real-time marine weather dashboard designed for sailors, surfers, kite surfers, and beachgoers. It leverages the Open-Meteo API to provide high-resolution marine and atmospheric data, presented through a beautiful, interactive, and responsive UI.

## 🚀 Features

### 📊 Real-Time Marine Data

- **Activity Reports**: Dedicated summary cards for Sailing conditions, Surf ratings, Pole Surfing (Kite), and Beach comfort levels.
- **Dynamic Icons**: Visual indicators that update based on live conditions (e.g., Waves vs. Swell icons, detailed weather animations).
- **Live Metrics**: Real-time display of:
  - Wind Speed & Direction
  - Wave Height & Period
  - Swell Height, Direction & Period
  - Air & Sea Temperatures

### 📈 Interactive Graphs

- **Tabbed Interface**: Seamlessly switch between **Tide Schedules**, **Wave Forecasts**, and **Swell Forecasts**.
- **Advanced Visualization**:
  - Dual-axis charts combining height (Area) and period (Line).
  - Tide charts with clear High/Low event markers and Mean Sea Level indication.
  - Interactive tooltips for precise data analysis.

### 📅 Detailed Forecasts

- **Persona-Based Tables**: Tailored 24-hour forecast views for different users:
  - **Mariner**: Pressure, Sea State, Visibility, Wind, Swell.
  - **Surfer**: Detailed Wave vs. Swell analysis, Period, and experimental Surf Ratings.
  - **Kite Surfer**: Wind Speed vs. Gusts, Direction, and riding conditions.
  - **Beachgoer**: UV Index, "Sand Wind" factor, Temperature, and general comfort.

### ⚡ Alert System

- **Customizable Thresholds**: User-configurable settings for Wave Height and Wind Speed alerts.
- **Visual Warnings**:
  - **Storm Warning**: Severe weather conditions.
  - **Rough Weather Advisory**: High winds/seas.
  - **Tsunami Simulation**: Experimental alert mode for high-impact wave events.

## 🛠️ Tech Stack

- **Frontend Framework**: [React](https://react.dev/) with [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data Source**: [Open-Meteo API](https://open-meteo.com/) (Marine & Forecast APIs)
- **Date Handling**: [date-fns](https://date-fns.org/)

## 📦 Installation & Setup

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/Ben1137/SeaMe.git
    cd SeaMe
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Run the development server:**

    ```bash
    npm run dev
    ```

4.  **Open in Browser:**
    Navigate to `http://localhost:3000` (or the port shown in your terminal).

## 🌍 Configuration

No API keys are required for the default Open-Meteo integration.
To modify the location, update the coordinates in `App.tsx` or passed to the `Dashboard` component.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any enhancements or bug fixes.

---

_Powered by [Open-Meteo](https://open-meteo.com/) data._
