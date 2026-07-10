export interface Material {
  id: string;
  name: string;
  category: string;
  unitPrice: number;
  currency: string;
  volume: number; // Annual or Quarterly quantity
  totalValue: number; // volume * unitPrice
  vendorName: string;
  vendorCountry: string;
  // Material composition weights (should sum up to <= 100%)
  commodityWeights: {
    copper: number; // e.g. 45 for 45%
    steel: number;
    aluminum: number;
    nickel: number;
    other: number;
  };
  // Flag indicating if mapped by AI or manually edited
  isAiMapped?: boolean;
  inventoryUsed?: number;
  inventoryOrdered?: number;
  inventoryBufferStock?: number;
}

export interface FoContract {
  symbol: string;
  exchange: string;
  contractType: "Futures" | "Options";
  strikePrice?: number;
  currentPrice: number;
  expiryDate: string;
  lotSize: string;
  openInterest: number;
  volume: number;
}

export interface CommodityMarket {
  id: string;
  name: string;
  symbol: string;
  currentPrice: number; // USD per Metric Ton or Lb
  unit: string; // e.g., "USD/MT" or "USD/lb"
  change24h: number; // percentage
  history: { date: string; price: number }[]; // 12 months history
  forecast: { period: string; price: number; change: number; signal: 'up' | 'down' | 'flat' }[]; // Next 4 quarters
  volatility: 'High' | 'Medium' | 'Low';
  weight?: number; // Calculated dynamic company weightage
  foContracts?: FoContract[];
}

export interface ProcurementAction {
  materialId: string;
  materialName: string;
  category: string;
  totalValue: number;
  primaryCommodity: string;
  primaryWeight: number;
  exposureValue: number; // totalValue * (primaryWeight / 100)
  forecastTrend: number; // predicted change of primary commodity over next Q
  recommendation: 'BUY_ADVANCE' | 'POSTPONE' | 'HOLD';
  confidence: number; // 0-100%
  reason: string;
  suggestedActionDate: string;
}

export interface GeopoliticalRisk {
  country: string;
  riskScore: number; // 1 to 5 (1: Low, 5: High)
  status: 'Stable' | 'Caution' | 'High Risk';
  description: string;
  vendorCount: number;
  materialShare: number; // Percentage of total spend
}

export interface DashboardState {
  materials: Material[];
  commodities: CommodityMarket[];
  recommendations: ProcurementAction[];
  geopoliticalRisks: GeopoliticalRisk[];
  selectedCommodity: string | null;
  selectedMaterial: string | null;
  isSimulating: boolean;
  simulationRates: {
    copper: number; // percentage change e.g. +15
    steel: number;
    aluminum: number;
    nickel: number;
  };
}
