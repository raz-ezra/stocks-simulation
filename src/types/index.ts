export interface Grant {
  id: string;
  amount: number;
  vestingFrom: Date;
  grantDate: Date;
  vestingYears: number;
  price: number;
  type: 'RSUs' | 'Options' | 'ESPP';
  ticker: string;
  isSection102?: boolean; // Whether this grant qualifies for Section 102 tax benefits
  section102Track?: 'capital-gains' | 'ordinary-income'; // Which Section 102 track applies
  esppDiscount?: number; // ESPP discount percentage (e.g., 0.15 for 15% discount)
  purchaseDate?: Date; // Date when ESPP shares were purchased
  esppPeriodStartPrice?: number; // Stock price at start of ESPP period (for lookback)
  esppWithTrustee?: boolean; // Whether ESPP uses trustee (Section 102) or immediate taxation
}

export interface Exercise {
  id: string;
  amount: number;
  grantAmount: number;
  grantId?: string; // Reference to the specific grant
  exerciseDate: Date;
  type: 'RSUs' | 'Options' | 'ESPP';
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
  totalESPP: number;
  vestedOptions: number;
  vestedRSUs: number;
  vestedESPP: number;
  todayWorth: number;
  todayNetWorth: number;
  stockPrices: StockPrice[];
}