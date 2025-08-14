# Stock Equity Simulation Webapp

A comprehensive single-page application for tracking and simulating stock equity compensation (RSUs and Stock Options). Built to replicate the functionality of the original Excel spreadsheet with enhanced user experience and real-time data integration.

## Features

### 🏠 **Overview Dashboard**
- Portfolio summary across all stock symbols
- Real-time stock price integration
- Vesting progress visualization
- Portfolio value calculations

### 📊 **Grants Management**
- Add and manage stock grants (RSUs and Options)
- Multi-stock symbol support
- Automatic price fetching for new symbols
- Quarterly vesting calculations (4-year standard)
- Complete CRUD operations

### 💰 **Exercise Tracking**
- Record stock option exercises and RSU sales
- Automatic tax calculations (Israeli tax rates)
- Before/after tax gain tracking
- USD/ILS currency conversion
- Exercise history with detailed breakdown

### 📈 **Portfolio Simulations**
- "What-if" scenarios with different growth rates (0%, 10%, 30%, 50%, 100%, 200%)
- Various exit date projections
- Interactive charts and visualizations
- Tax-adjusted net calculations
- Monthly income projections

## Technical Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand with persistence
- **Forms**: React Hook Form
- **Charts**: Recharts
- **Animations**: Framer Motion
- **API Integration**: Real-time stock prices (mock data for demo)
- **Data Persistence**: LocalStorage

## 🚀 Live Demo

**[View Live Demo](https://[your-username].github.io/stocks-simulation/)**

*The app runs entirely in your browser with no backend required. All data is stored locally.*

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd stocks-simulation
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npm run dev
```

4. Open http://localhost:5173 in your browser

### Building for Production
```bash
npm run build
```

### Deployment
This app is configured for GitHub Pages deployment. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Key Calculations

### Vesting Formula
Replicates Excel's quarterly vesting logic:
```typescript
const calculateVestedShares = (grantAmount, vestingStart, vestingYears, currentDate) => {
  const monthsVested = monthsDifference(vestingStart, currentDate);
  const quarterlyVested = Math.floor(monthsVested / 3);
  const totalQuarters = vestingYears * 4;
  return Math.min(grantAmount, (quarterlyVested * grantAmount) / totalQuarters);
};
```

### Tax Calculations (Israeli Tax System)
- **RSUs**: ~47% income tax rate
- **Options**: ~25% capital gains tax rate
- USD/ILS conversion with live exchange rates

### Portfolio Valuation
- **RSUs**: `availableShares × currentPrice`
- **Options**: `availableShares × (currentPrice - strikePrice)` if profitable

## Data Structure

The app uses the same data model as the original Excel file:

- **Grants**: Amount, vesting dates, grant price, stock symbol
- **Exercises**: Exercise amounts, dates, prices, tax calculations
- **Simulations**: Growth scenarios, projected values, tax estimates

## API Integration

Currently uses mock data for demonstration. To integrate with real stock prices:

1. Get an API key from Alpha Vantage or similar service
2. Set environment variable: `VITE_ALPHA_VANTAGE_API_KEY=your_key_here`
3. Real-time prices will be fetched automatically

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - feel free to use this for personal or commercial projects.

---

**Built to replicate Excel functionality with modern web technologies for better user experience and real-time data integration.**