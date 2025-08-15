export interface Grant {
  id: string;
  amount: number;
  vestingFrom: Date;
  grantDate: Date;
  vestingYears: number;
  price: number;
  type: 'RSUs' | 'Options';
  ticker: string;
  isSection102?: boolean; // Whether this grant qualifies for Section 102 tax benefits
  section102Track?: 'capital-gains' | 'ordinary-income'; // Which Section 102 track applies
}

export interface Exercise {
  id: string;
  amount: number;
  grantAmount: number;
  exerciseDate: Date;
  type: 'RSUs' | 'Options';
  grantPrice: number;
  exercisePrice: number;
  usdIlsRate: number;
  beforeTax: number;
  calculatedNet: number;
  actualNet: number | null;
  actualNetCurrency?: 'USD' | 'ILS'; // Currency of the actual net amount
  isSimulation: boolean;
  includeInCalculations?: boolean; // For simulation exercises, whether to include in totals
}

export interface SimulationScenario {
  leaveDate: Date;
  growth: number;
  guessedPrice: number;
  expectedGross: number;
  grossIls: number;
  expectedTax: number;
  expectedNet: number;
  netIls: number;
  grossPerMonth: number;
  netPerMonth: number;
}

export interface StockPrice {
  ticker: string;
  price: number;
  lastUpdated: Date;
  error?: string;
  provider?: string;
}

export interface PortfolioSummary {
  totalOptions: number;
  totalRSUs: number;
  vestedOptions: number;
  vestedRSUs: number;
  todayWorth: number;
  todayNetWorth: number;
  stockPrices: StockPrice[];
}