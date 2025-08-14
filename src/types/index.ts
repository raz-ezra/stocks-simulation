export interface Grant {
  id: string;
  amount: number;
  vestingFrom: Date;
  grantDate: Date;
  vestingYears: number;
  price: number;
  type: 'RSUs' | 'Options';
  ticker: string;
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