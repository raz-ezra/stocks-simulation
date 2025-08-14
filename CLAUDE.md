# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
npm run dev          # Start Vite dev server on http://localhost:5173
npm run build        # TypeScript compilation + production build
npm run preview      # Preview production build locally
npm run lint         # Run ESLint with TypeScript support

# Type checking
npx tsc --noEmit     # TypeScript type checking without emitting files
```

## Architecture Overview

This is a React 18 + TypeScript single-page application for stock equity simulation, replicating Excel spreadsheet functionality with modern web technologies.

### Core Data Flow
1. **Grants** → automatic **Stock Price** fetching → **Portfolio Calculations**
2. **Exercises** → **Tax Calculations** → **Portfolio Value Updates** 
3. **Simulations** → **Growth Scenarios** → **Future Value Projections**

### State Management Architecture
- **Zustand stores** with localStorage persistence for data management
- **useGrantsStore**: CRUD operations + ticker symbol management
- **useExercisesStore**: Exercise tracking with grant relationships  
- **useStockPricesStore**: Real-time price data with error handling
- **useCurrencyStore**: Live USD/ILS exchange rate with error handling
- All grant/exercise stores use `persist()` middleware for automatic localStorage sync

### Key Business Logic (src/utils/calculations.ts)
- **Quarterly Vesting**: `FLOOR(monthsSince/3) * grantAmount/(4*vestingYears)`
- **Portfolio Valuation**: 
  - RSUs: `availableShares × currentPrice`
  - Options: `availableShares × (currentPrice - strikePrice)` if profitable
- **Tax Calculations**: Israeli tax rates (RSUs: 47%, Options: 25%)

### Stock Price Integration (src/services/stockApi.ts)
- **Primary Method**: Finnhub REST API integration via `VITE_FINNHUB_API_KEY`
- **HTTP Polling**: Configurable intervals (10s-5min, default 30s) when auto-fetch enabled
- **Real-time Data**: Gets current trading price using `/quote` endpoint
- **Rate Limits**: 30 calls/second (generous for development needs)
- **Force Refresh**: Always bypasses cache for immediate fresh data
- **Error Handling**: Failed API calls preserve last successful price from localStorage, clear UI error indicators
- **No Mock Data**: Only real API calls - requires API key for functionality

### Currency Exchange Integration (src/services/currencyApi.ts)
- **Live USD/ILS rates**: Fetched from exchangerate-api.com (free tier)
- **Auto-fetch**: On app startup with fallback rate (3.65)
- **Error Handling**: Graceful fallback with user notification
- **Used in**: Simulations (read-only display) and Exercises (default values)

### Component Structure
```
App.tsx (main layout + stock price fetching)
├── Overview/ (always-visible portfolio dashboard)
├── Grants/ (collapsible: Grants.tsx → GrantForm.tsx + GrantsList.tsx)
├── Exercises/ (collapsible: Exercises.tsx → ExerciseForm.tsx + ExercisesList.tsx)  
├── Simulations/ (collapsible: Simulations.tsx → SimulationCalculator.tsx)
└── UI/CollapsiblePanel.tsx (Framer Motion animations)
```

### TypeScript Interfaces (src/types/index.ts)
- **Grant**: Core equity grant data (amount, vesting dates, ticker, type)
- **Exercise**: Exercise records with tax calculations  
- **SimulationScenario**: Growth projections with tax estimates
- **StockPrice**: Real-time price data with error states

### Form Handling Patterns
- **React Hook Form** throughout with TypeScript validation
- **Automatic price fetching** when stock symbols are entered
- **CRUD operations** follow consistent add/edit/delete patterns
- **Form + List components** paired in each feature section

### Chart & Visualization
- **Recharts** for simulation growth scenarios (LineChart)
- **Responsive design** with mobile-first Tailwind CSS
- **Interactive tooltips** with currency formatting

## Common Issues & Solutions

### localStorage Date Deserialization Error
**Problem**: "Uncaught RangeError: Invalid time value" when refreshing page
**Cause**: Zustand persist middleware doesn't handle Date object serialization automatically
**Solution**: Custom serialize/deserialize functions in stores with error handling

If this occurs:
1. Check browser console for "Error deserializing" warnings
2. App will auto-clear corrupted localStorage and reload
3. Manual fix: `localStorage.clear()` in browser console

## Key Development Patterns

### Adding New Grant Types
1. Update `type` union in `src/types/index.ts`
2. Modify calculation logic in `src/utils/calculations.ts`  
3. Update tax rates in form components as needed

### Adding New Stock APIs
1. Extend `fetchStockPrice()` in `src/services/stockApi.ts`
2. Add new mock data entries for development
3. Update environment variable documentation

### State Updates
- Always use Zustand store actions, never direct state mutation
- localStorage persistence is automatic via `persist()` middleware
- Stock price updates trigger portfolio recalculations automatically

## Environment Configuration

```bash
# Finnhub API Key for real-time stock prices
VITE_FINNHUB_API_KEY=your_finnhub_api_key_here
```

**Without API key**: App shows error messages requiring API key configuration
**API key setup**: Can be configured via Settings panel or environment variable

## Financial Calculations Context

This app replicates Excel spreadsheet calculations for Israeli stock compensation:
- **Quarterly vesting schedules** (standard 4-year vesting)
- **Israeli tax implications** (income tax for RSUs, capital gains for options)
- **USD/ILS currency conversion** with live exchange rates
- **Exercise timing optimization** through scenario modeling

The simulation engine models growth rates from 0% to 200% to help users plan optimal exercise timing and financial outcomes.