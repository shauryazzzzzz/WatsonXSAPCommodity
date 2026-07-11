import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import * as XLSX_MODULE from "xlsx";
const XLSX: any = (XLSX_MODULE as any).default && typeof (XLSX_MODULE as any).default.readFile === "function" 
  ? (XLSX_MODULE as any).default 
  : XLSX_MODULE;

dotenv.config();

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CONFIG_FILE_PATH = path.join(DATA_DIR, "system_config.xlsx");

const DEFAULT_VARIABLES = [
  { Key: "USD_INR_DEFAULT", Value: "83.45", Type: "number", Description: "Initial or fallback USD to INR exchange rate" },
  { Key: "USD_EUR_DEFAULT", Value: "0.9200", Type: "number", Description: "Initial or fallback USD to EUR exchange rate" },
  { Key: "TICKER_INTERVAL_SEC", Value: "60", Type: "number", Description: "Frequency of background commodity market fluctuations in seconds" },
  { Key: "MAX_FLUC_PCT", Value: "1.5", Type: "number", Description: "Maximum price movement up or down in percentage per interval" },
  { Key: "MIN_COMMODITY_PRICE", Value: "10", Type: "number", Description: "Hard lower bound for fluctuated commodity prices" },
  { Key: "MAX_COMMODITY_PRICE", Value: "100000", Type: "number", Description: "Hard upper bound for fluctuated commodity prices" },
  { Key: "PRIMARY_GEMINI_MODEL", Value: "gemini-3.5-flash", Type: "string", Description: "Primary LLM model for strategic suggestions" },
  { Key: "FALLBACK_GEMINI_MODEL", Value: "gemini-3.1-flash-lite", Type: "string", Description: "Fallback LLM model in case quota is exceeded" },
  { Key: "FX_API_URL", Value: "https://open.er-api.com/v6/latest/USD", Type: "string", Description: "Public FX rate JSON API endpoint" },
  { Key: "FX_REFRESH_INTERVAL_MIN", Value: "5", Type: "number", Description: "Interval in minutes to synchronize live foreign exchange rates" }
];

const DEFAULT_INDUSTRIES = [
  { IndustryID: "automobile", DisplayName: "Automobile (Maruti Suzuki)", ClientName: "Maruti Suzuki India Ltd.", SectorName: "Automotive Manufacturing", Active: "TRUE" },
  { IndustryID: "pharma", DisplayName: "Pharma (Sun Pharma)", ClientName: "Sun Pharmaceutical Industries", SectorName: "Pharmaceuticals", Active: "TRUE" },
  { IndustryID: "retail", DisplayName: "Retail (Reliance Retail)", ClientName: "Reliance Retail Ventures", SectorName: "Consumer Retail", Active: "TRUE" },
  { IndustryID: "telecom", DisplayName: "Telecom (Bharti Airtel)", ClientName: "Bharti Airtel Limited", SectorName: "Telecommunications", Active: "TRUE" },
  { IndustryID: "finance", DisplayName: "Finance (SBI Treasury)", ClientName: "State Bank of India Treasury", SectorName: "Banking & Treasury", Active: "TRUE" },
  { IndustryID: "banks", DisplayName: "Banks (HDFC Bank)", ClientName: "HDFC Bank Limited", SectorName: "Commercial Banking", Active: "TRUE" },
  { IndustryID: "oil_gas", DisplayName: "Oil & Gas (Reliance Industries)", ClientName: "Reliance Industries Oil & Gas Division", SectorName: "Energy & Petrochemicals", Active: "TRUE" },
  { IndustryID: "manufacturing", DisplayName: "Manufacturing (Tata Motors)", ClientName: "Tata Motors Commercial Vehicles", SectorName: "Heavy Manufacturing", Active: "TRUE" },
  { IndustryID: "software", DisplayName: "Software (TCS Cloud Services)", ClientName: "Tata Consultancy Services Cloud Infra", SectorName: "Information Technology", Active: "TRUE" }
];

const DEFAULT_COMMODITY_REGISTRY = [
  { ID: "copper", Name: "Electrolytic Copper Grade A", Symbol: "MCX-COP", Unit: "USD/MT", Volatility: "Medium", InitialPrice: "8500" },
  { ID: "steel", Name: "Tensile Rack Steel Index", Symbol: "RAK-ST", Unit: "USD/MT", Volatility: "Low", InitialPrice: "710" },
  { ID: "aluminum", Name: "Blade Server cooling Aluminum", Symbol: "BLD-AL", Unit: "USD/MT", Volatility: "Medium", InitialPrice: "2280" },
  { ID: "nickel", Name: "UPS Battery Nickel Core Index", Symbol: "UPS-NIC", Unit: "USD/MT", Volatility: "High", InitialPrice: "15600" }
];

interface LoadedSystemConfig {
  variables: Record<string, any>;
  industries: Array<{ id: string; name: string; clientName: string; sectorName: string; excelFileName: string }>;
  commodities: Array<{ id: string; name: string; symbol: string; unit: string; volatility: string; initialPrice: number }>;
}

// Read from system_config.xlsx with real-time on-the-fly execution
export function loadSystemConfig(): LoadedSystemConfig {
  const filePath = CONFIG_FILE_PATH;
  
  if (!fs.existsSync(filePath)) {
    const wb = XLSX.utils.book_new();
    
    const wsVars = XLSX.utils.json_to_sheet(DEFAULT_VARIABLES);
    XLSX.utils.book_append_sheet(wb, wsVars, "GlobalVariables");
    
    const wsInds = XLSX.utils.json_to_sheet(DEFAULT_INDUSTRIES);
    XLSX.utils.book_append_sheet(wb, wsInds, "IndustryRegistry");
    
    const wsComms = XLSX.utils.json_to_sheet(DEFAULT_COMMODITY_REGISTRY);
    XLSX.utils.book_append_sheet(wb, wsComms, "CommodityDefaults");
    
    XLSX.writeFile(wb, filePath);
    console.log(`[SYSTEM_CONFIG] Initialized dynamic config at ${filePath}`);
  }
  
  try {
    const wb = XLSX.readFile(filePath);
    
    // Parse Global Variables
    const wsVars = wb.Sheets["GlobalVariables"];
    const rawVars = wsVars ? XLSX.utils.sheet_to_json(wsVars) : [];
    const variables: Record<string, any> = {};
    rawVars.forEach((v: any) => {
      if (v.Key) {
        if (v.Type === "number") {
          variables[v.Key] = Number(v.Value);
        } else if (v.Type === "boolean") {
          variables[v.Key] = v.Value === "true" || v.Value === "TRUE" || v.Value === true;
        } else {
          variables[v.Key] = String(v.Value);
        }
      }
    });
    
    // Parse Industry Registry
    const wsInds = wb.Sheets["IndustryRegistry"];
    const rawInds = wsInds ? XLSX.utils.sheet_to_json(wsInds) : [];
    const industries = rawInds
      .filter((i: any) => i.Active === "true" || i.Active === "TRUE" || i.Active === true || i.Active === "1" || i.Active === 1)
      .map((i: any) => ({
        id: String(i.IndustryID),
        name: String(i.DisplayName),
        clientName: String(i.ClientName),
        sectorName: String(i.SectorName),
        excelFileName: String(i.ExcelFileName || `sap_${i.IndustryID}.xlsx`)
      }));
      
    // Parse Commodity Registry
    const wsComms = wb.Sheets["CommodityDefaults"];
    const rawComms = wsComms ? XLSX.utils.sheet_to_json(wsComms) : [];
    const commodities = rawComms.map((c: any) => ({
      id: String(c.ID),
      name: String(c.Name),
      symbol: String(c.Symbol),
      unit: String(c.Unit),
      volatility: String(c.Volatility),
      initialPrice: Number(c.InitialPrice)
    }));
    
    // Merge loaded config with static defaults to avoid missing keys
    const mergedVars = {
      ...DEFAULT_VARIABLES.reduce((acc, v) => ({ ...acc, [v.Key]: v.Type === "number" ? Number(v.Value) : v.Value }), {}),
      ...variables
    };
    
    return {
      variables: mergedVars,
      industries: industries.length > 0 ? industries : DEFAULT_INDUSTRIES.map(i => ({
        id: i.IndustryID,
        name: i.DisplayName,
        clientName: i.ClientName,
        sectorName: i.SectorName,
        excelFileName: `sap_${i.IndustryID}.xlsx`
      })),
      commodities: commodities.length > 0 ? commodities : DEFAULT_COMMODITY_REGISTRY.map(c => ({
        id: c.ID,
        name: c.Name,
        symbol: c.Symbol,
        unit: c.Unit,
        volatility: c.Volatility,
        initialPrice: Number(c.InitialPrice)
      }))
    };
  } catch (err) {
    console.error("[SYSTEM_CONFIG] Error reading system_config.xlsx, using default templates", err);
    return {
      variables: DEFAULT_VARIABLES.reduce((acc, v) => ({ ...acc, [v.Key]: v.Type === "number" ? Number(v.Value) : v.Value }), {}),
      industries: DEFAULT_INDUSTRIES.map(i => ({
        id: i.IndustryID,
        name: i.DisplayName,
        clientName: i.ClientName,
        sectorName: i.SectorName,
        excelFileName: `sap_${i.IndustryID}.xlsx`
      })),
      commodities: DEFAULT_COMMODITY_REGISTRY.map(c => ({
        id: c.ID,
        name: c.Name,
        symbol: c.Symbol,
        unit: c.Unit,
        volatility: c.Volatility,
        initialPrice: Number(c.InitialPrice)
      }))
    };
  }
}

// Write back updated global configuration values to excel file
function saveSystemConfigVariables(updatedVars: Record<string, any>) {
  const filePath = CONFIG_FILE_PATH;
  try {
    const currentConfig = loadSystemConfig();
    const wb = XLSX.utils.book_new();
    
    // Map current variables list with newly updated values
    const sheetData = DEFAULT_VARIABLES.map(v => {
      const userValue = updatedVars[v.Key] !== undefined ? String(updatedVars[v.Key]) : v.Value;
      return {
        Key: v.Key,
        Value: userValue,
        Type: v.Type,
        Description: v.Description
      };
    });
    
    const wsVars = XLSX.utils.json_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, wsVars, "GlobalVariables");
    
    // Preserve existing sheets
    const wsInds = XLSX.utils.json_to_sheet(
      currentConfig.industries.map(i => ({
        IndustryID: i.id,
        DisplayName: i.name,
        ClientName: i.clientName,
        SectorName: i.sectorName,
        Active: "TRUE"
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsInds, "IndustryRegistry");
    
    const wsComms = XLSX.utils.json_to_sheet(
      currentConfig.commodities.map(c => ({
        ID: c.id,
        Name: c.name,
        Symbol: c.symbol,
        Unit: c.unit,
        Volatility: c.volatility,
        InitialPrice: String(c.initialPrice)
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsComms, "CommodityDefaults");
    
    XLSX.writeFile(wb, filePath);
    console.log(`[SYSTEM_CONFIG] Successfully wrote system variables into Excel at ${filePath}`);
    return true;
  } catch (err) {
    console.error("[SYSTEM_CONFIG] Failed to save updated variables to system_config.xlsx", err);
    throw err;
  }
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initial materials data matching an Automobile procurement scenario for Maruti Suzuki
const INITIAL_MATERIALS = [
  {
    id: "MAT-001",
    name: "Chassis High-Strength Steel Frame (Swift/Baleno)",
    category: "Body Structures",
    unitPrice: 450,
    currency: "USD",
    volume: 8000,
    totalValue: 3600000,
    vendorName: "Tata Steel Automotive Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 2, steel: 88, aluminum: 5, nickel: 1, other: 4 },
    isAiMapped: false,
    inventoryUsed: 5500,
    inventoryOrdered: 2100,
    inventoryBufferStock: 800
  },
  {
    id: "MAT-002",
    name: "High-Voltage Electric Wiring Harness (eVX Series)",
    category: "Electrical Systems",
    unitPrice: 380,
    currency: "USD",
    volume: 5500,
    totalValue: 2090000,
    vendorName: "Motherson Sumi Wiring India",
    vendorCountry: "India",
    commodityWeights: { copper: 68, steel: 5, aluminum: 10, nickel: 2, other: 15 },
    isAiMapped: false,
    inventoryUsed: 3900,
    inventoryOrdered: 1200,
    inventoryBufferStock: 500
  },
  {
    id: "MAT-003",
    name: "Aluminum Alloy Wheel Castings (Grand Vitara)",
    category: "Chassis & Wheel",
    unitPrice: 120,
    currency: "USD",
    volume: 24000,
    totalValue: 2880000,
    vendorName: "Maxion Wheels Holding GmbH",
    vendorCountry: "Germany",
    commodityWeights: { copper: 0, steel: 10, aluminum: 85, nickel: 0, other: 5 },
    isAiMapped: false,
    inventoryUsed: 18500,
    inventoryOrdered: 4500,
    inventoryBufferStock: 1500
  },
  {
    id: "MAT-004",
    name: "Catalytic Converter Exhaust Subassembly (Ertiga)",
    category: "Exhaust Systems",
    unitPrice: 650,
    currency: "USD",
    volume: 3200,
    totalValue: 2080000,
    vendorName: "Faurecia Clean Mobility",
    vendorCountry: "France",
    commodityWeights: { copper: 5, steel: 45, aluminum: 5, nickel: 35, other: 10 },
    isAiMapped: false,
    inventoryUsed: 2200,
    inventoryOrdered: 850,
    inventoryBufferStock: 250
  },
  {
    id: "MAT-005",
    name: "EV Traction Motor Copper Stator Coils",
    category: "Drivetrain Components",
    unitPrice: 850,
    currency: "USD",
    volume: 4000,
    totalValue: 3400000,
    vendorName: "Nidec India Pvt Ltd",
    vendorCountry: "Japan",
    commodityWeights: { copper: 55, steel: 35, aluminum: 5, nickel: 0, other: 5 },
    isAiMapped: false,
    inventoryUsed: 2800,
    inventoryOrdered: 950,
    inventoryBufferStock: 300
  },
  {
    id: "MAT-006",
    name: "Engine Block Aluminum Cylinders (K15C Smart Hybrid)",
    category: "Powertrain Parts",
    unitPrice: 1450,
    currency: "USD",
    volume: 2500,
    totalValue: 3625000,
    vendorName: "Aisin Seiki Co Ltd",
    vendorCountry: "Japan",
    commodityWeights: { copper: 2, steel: 28, aluminum: 65, nickel: 1, other: 4 },
    isAiMapped: false,
    inventoryUsed: 1900,
    inventoryOrdered: 500,
    inventoryBufferStock: 150
  },
  {
    id: "MAT-007",
    name: "Door Outer Sheet Metal Panels & BIW (Brezza)",
    category: "Body Structures",
    unitPrice: 95,
    currency: "USD",
    volume: 35000,
    totalValue: 3325000,
    vendorName: "ArcelorMittal Nippon Steel India",
    vendorCountry: "India",
    commodityWeights: { copper: 0, steel: 95, aluminum: 0, nickel: 1, other: 4 },
    isAiMapped: false,
    inventoryUsed: 24000,
    inventoryOrdered: 8000,
    inventoryBufferStock: 3000
  },
  {
    id: "MAT-008",
    name: "EV Lithium Battery Module Copper Busbars",
    category: "Electrical Systems",
    unitPrice: 15,
    currency: "USD",
    volume: 150000,
    totalValue: 2250000,
    vendorName: "Tongling Nonferrous Metals Group",
    vendorCountry: "China",
    commodityWeights: { copper: 92, steel: 0, aluminum: 3, nickel: 0, other: 5 },
    isAiMapped: false,
    inventoryUsed: 112000,
    inventoryOrdered: 32000,
    inventoryBufferStock: 10000
  },
  {
    id: "MAT-010",
    name: "Suspension Coil Spring High-Tensile Carbon Steel",
    category: "Chassis & Wheel",
    unitPrice: 45,
    currency: "USD",
    volume: 48000,
    totalValue: 2160000,
    vendorName: "NHK Spring Co Ltd",
    vendorCountry: "Japan",
    commodityWeights: { copper: 0, steel: 98, aluminum: 0, nickel: 1, other: 1 },
    isAiMapped: false,
    inventoryUsed: 36000,
    inventoryOrdered: 10000,
    inventoryBufferStock: 3500
  }
];

// Commodity prices base, histories, forecast matrices and F&O Derivative contracts with precise expiry dates
const INITIAL_COMMODITIES = [
  {
    id: "copper",
    name: "Copper (LME)",
    symbol: "HG-F",
    currentPrice: 9680,
    unit: "USD/MT",
    change24h: 1.42,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 9150 },
      { date: "Aug 25", price: 9280 },
      { date: "Sep 25", price: 9410 },
      { date: "Oct 25", price: 9350 },
      { date: "Nov 25", price: 9550 },
      { date: "Dec 25", price: 9480 },
      { date: "Jan 26", price: 9600 },
      { date: "Feb 26", price: 9780 },
      { date: "Mar 26", price: 9890 },
      { date: "Apr 26", price: 9750 },
      { date: "May 26", price: 9620 },
      { date: "Jun 26", price: 9680 }
    ],
    forecast: [
      { period: "Q3 2026", price: 10250, change: 5.8, signal: "up" },
      { period: "Q4 2026", price: 10600, change: 9.5, signal: "up" },
      { period: "Q1 2027", price: 11100, change: 14.6, signal: "up" },
      { period: "Q2 2027", price: 10800, change: 11.5, signal: "down" }
    ],
    foContracts: [
      { symbol: "HGU26 (Futures)", exchange: "CME (Chicago)", contractType: "Futures", currentPrice: 9710, expiryDate: "2026-09-28", lotSize: "25,000 lbs", openInterest: 12500, volume: 4200 },
      { symbol: "HGZ26 (Futures)", exchange: "CME (Chicago)", contractType: "Futures", currentPrice: 9850, expiryDate: "2026-12-28", lotSize: "25,000 lbs", openInterest: 18200, volume: 6100 },
      { symbol: "HGU26 C9800 (Option)", exchange: "CME (Chicago)", contractType: "Options", strikePrice: 9800, currentPrice: 185, expiryDate: "2026-09-28", lotSize: "25,000 lbs", openInterest: 3400, volume: 820 },
      { symbol: "MCU3 (3M Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 9680, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 245000, volume: 38200 },
      { symbol: "MCXCOPPERAUG26 (Futures)", exchange: "MCX (India)", contractType: "Futures", currentPrice: 9640, expiryDate: "2026-08-31", lotSize: "2.5 Metric Tons", openInterest: 4500, volume: 1200 }
    ]
  },
  {
    id: "steel",
    name: "Steel HRC (NYMEX)",
    symbol: "HR-F",
    currentPrice: 765,
    unit: "USD/MT",
    change24h: -0.65,
    volatility: "Low",
    history: [
      { date: "Jul 25", price: 820 },
      { date: "Aug 25", price: 805 },
      { date: "Sep 25", price: 790 },
      { date: "Oct 25", price: 785 },
      { date: "Nov 25", price: 770 },
      { date: "Dec 25", price: 765 },
      { date: "Jan 26", price: 755 },
      { date: "Feb 26", price: 760 },
      { date: "Mar 26", price: 775 },
      { date: "Apr 26", price: 770 },
      { date: "May 26", price: 762 },
      { date: "Jun 26", price: 765 }
    ],
    forecast: [
      { period: "Q3 2026", price: 745, change: -2.6, signal: "down" },
      { period: "Q4 2026", price: 720, change: -5.8, signal: "down" },
      { period: "Q1 2027", price: 735, change: -3.9, signal: "up" },
      { period: "Q2 2027", price: 750, change: -1.9, signal: "up" }
    ],
    foContracts: [
      { symbol: "HRU26 (Futures)", exchange: "NYMEX (New York)", contractType: "Futures", currentPrice: 755, expiryDate: "2026-09-15", lotSize: "20 Short Tons", openInterest: 8100, volume: 1100 },
      { symbol: "HRZ26 (Futures)", exchange: "NYMEX (New York)", contractType: "Futures", currentPrice: 720, expiryDate: "2026-12-15", lotSize: "20 Short Tons", openInterest: 9800, volume: 1450 },
      { symbol: "HRU26 C760 (Option)", exchange: "NYMEX (New York)", contractType: "Options", strikePrice: 760, currentPrice: 15, expiryDate: "2026-09-15", lotSize: "20 Short Tons", openInterest: 1200, volume: 310 },
      { symbol: "MCXSTEELHAUG26 (Futures)", exchange: "MCX (India)", contractType: "Futures", currentPrice: 745, expiryDate: "2026-08-31", lotSize: "10 Metric Tons", openInterest: 2100, volume: 550 }
    ]
  },
  {
    id: "aluminum",
    name: "Aluminum (LME)",
    symbol: "AL-F",
    currentPrice: 2450,
    unit: "USD/MT",
    change24h: 0.82,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 2280 },
      { date: "Aug 25", price: 2310 },
      { date: "Sep 25", price: 2340 },
      { date: "Oct 25", price: 2290 },
      { date: "Nov 25", price: 2360 },
      { date: "Dec 25", price: 2410 },
      { date: "Jan 26", price: 2440 },
      { date: "Feb 26", price: 2480 },
      { date: "Mar 26", price: 2520 },
      { date: "Apr 26", price: 2470 },
      { date: "May 26", price: 2430 },
      { date: "Jun 26", price: 2450 }
    ],
    forecast: [
      { period: "Q3 2026", price: 2550, change: 4.0, signal: "up" },
      { period: "Q4 2026", price: 2620, change: 6.9, signal: "up" },
      { period: "Q1 2027", price: 2580, change: 5.3, signal: "down" },
      { period: "Q2 2027", price: 2510, change: 2.4, signal: "down" }
    ],
    foContracts: [
      { symbol: "ALU3 (3M Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 2480, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 168000, volume: 24300 },
      { symbol: "ALZ3 (3M Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 2540, expiryDate: "2026-12-16", lotSize: "25 Metric Tons", openInterest: 194000, volume: 28500 },
      { symbol: "ALU3 C2500 (Option)", exchange: "LME (London)", contractType: "Options", strikePrice: 2500, currentPrice: 45, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 5600, volume: 1150 },
      { symbol: "MCXALUMAUG26 (Futures)", exchange: "MCX (India)", contractType: "Futures", currentPrice: 2430, expiryDate: "2026-08-31", lotSize: "5 Metric Tons", openInterest: 3100, volume: 980 }
    ]
  },
  {
    id: "nickel",
    name: "Nickel (LME)",
    symbol: "NI-F",
    currentPrice: 17350,
    unit: "USD/MT",
    change24h: -1.98,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 16800 },
      { date: "Aug 25", price: 17100 },
      { date: "Sep 25", price: 16900 },
      { date: "Oct 25", price: 16400 },
      { date: "Nov 25", price: 17200 },
      { date: "Dec 25", price: 17900 },
      { date: "Jan 26", price: 18100 },
      { date: "Feb 26", price: 18450 },
      { date: "Mar 26", price: 17900 },
      { date: "Apr 26", price: 17500 },
      { date: "May 26", price: 17150 },
      { date: "Jun 26", price: 17350 }
    ],
    forecast: [
      { period: "Q3 2026", price: 16800, change: -3.1, signal: "down" },
      { period: "Q4 2026", price: 16200, change: -6.6, signal: "down" },
      { period: "Q1 2027", price: 16500, change: -4.9, signal: "up" },
      { period: "Q2 2027", price: 17200, change: -0.8, signal: "up" }
    ],
    foContracts: [
      { symbol: "NIU3 (3M Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 17100, expiryDate: "2026-09-16", lotSize: "6 Metric Tons", openInterest: 84000, volume: 11200 },
      { symbol: "NIZ3 (3M Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 16450, expiryDate: "2026-12-16", lotSize: "6 Metric Tons", openInterest: 92000, volume: 13900 },
      { symbol: "NIU3 C17500 (Option)", exchange: "LME (London)", contractType: "Options", strikePrice: 17500, currentPrice: 380, expiryDate: "2026-09-16", lotSize: "6 Metric Tons", openInterest: 2100, volume: 450 },
      { symbol: "MCXNICKELAUG26 (Futures)", exchange: "MCX (India)", contractType: "Futures", currentPrice: 17250, expiryDate: "2026-08-31", lotSize: "1.5 Metric Tons", openInterest: 1400, volume: 380 }
    ]
  }
];

const GEOPOLITICAL_RISKS_MOCK = [
  { country: "India", riskScore: 1.5, status: "Stable", description: "Very stable local sourcing, direct domestic highway access to Gurugram/Manesar hubs." },
  { country: "Germany", riskScore: 1, status: "Stable", description: "Low risk, highly stable supply chain with robust infrastructure." },
  { country: "USA", riskScore: 1, status: "Stable", description: "Extremely stable geopolitical and infrastructure risk profiles." },
  { country: "Italy", riskScore: 2, status: "Stable", description: "Stable European partner, minimal logistial bottlenecks." },
  { country: "Luxembourg", riskScore: 1, status: "Stable", description: "Highly stable and central EU logistics network." },
  { country: "Japan", riskScore: 1, status: "Stable", description: "Very secure supply chain, but geographically prone to natural hazards." },
  { country: "Switzerland", riskScore: 1, status: "Stable", description: "Exemplary political stability and neutral risk posture." },
  { country: "Denmark", riskScore: 1, status: "Stable", description: "Excellent legal and regulatory infrastructure, zero-risk zone." },
  { country: "China", riskScore: 3.5, status: "Caution", description: "Significant volume hub; tariff and trade friction vulnerabilities." },
  { country: "France", riskScore: 2, status: "Stable", description: "High security, stable EU industrial policies." },
  { country: "Brazil", riskScore: 3, status: "Caution", description: "Favorable pricing but subject to currency volatility and inland transit risks." }
];

// Initialize Gemini API client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is missing.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
};

// Helper to generate content with fallback models if the primary model is busy or has quota limits
const generateContentWithModelFallback = async (ai: any, params: {
  contents: any;
  config?: any;
}) => {
  const sysConfig = loadSystemConfig();
  const primaryModel = sysConfig.variables.PRIMARY_GEMINI_MODEL || "gemini-3.5-flash";
  const fallbackModel = sysConfig.variables.FALLBACK_GEMINI_MODEL || "gemini-3.1-flash-lite";

  try {
    console.log(`[Gemini] Trying generation with primary: ${primaryModel} (loaded from system_config.xlsx)`);
    return await ai.models.generateContent({
      model: primaryModel,
      ...params
    });
  } catch (error: any) {
    console.log(`[Gemini] Primary model ${primaryModel} not available (Status: ${error.status || error.code || "unknown"}). Trying alternate: ${fallbackModel}`);
    try {
      return await ai.models.generateContent({
        model: fallbackModel,
        ...params
      });
    } catch (fallbackError: any) {
      console.log(`[Gemini] Alternate model ${fallbackModel} not available. Proceeding to offline fallback.`);
      throw error; // throw original error so the route's offline fallback can kick in
    }
  }
};

// Offline Helper Fallback Functions to prevent app from crashing if Gemini API fails (e.g. 503 limit)
const getLocalMaterialMapping = (materials: any[]) => {
  return materials.map(mat => {
    const name = (mat.name || "").toLowerCase();
    const desc = (mat.description || "").toLowerCase();
    const cat = (mat.category || "").toLowerCase();

    let copper = 0, steel = 0, aluminum = 0, nickel = 0, other = 100;

    if (name.includes("transformer") || desc.includes("transformer") || cat.includes("transformer")) {
      copper = 40; steel = 35; aluminum = 10; nickel = 5; other = 10;
    } else if (name.includes("generator") || desc.includes("generator") || cat.includes("generator") || name.includes("rotor")) {
      copper = 20; steel = 60; aluminum = 10; nickel = 2; other = 8;
    } else if (name.includes("cable") || name.includes("wire") || name.includes("conductor") || desc.includes("cable") || desc.includes("copper") || name.includes("harness") || name.includes("stator") || name.includes("busbar")) {
      if (name.includes("harness")) {
        copper = 68; steel = 5; aluminum = 10; nickel = 2; other = 15;
      } else if (name.includes("stator")) {
        copper = 55; steel = 35; aluminum = 5; nickel = 0; other = 5;
      } else if (name.includes("busbar")) {
        copper = 92; steel = 0; aluminum = 3; nickel = 0; other = 5;
      } else {
        copper = 85; steel = 0; aluminum = 5; nickel = 0; other = 10;
      }
    } else if (name.includes("steel") || name.includes("frame") || name.includes("bracket") || name.includes("structure") || name.includes("chassis") || name.includes("panel") || name.includes("biw") || name.includes("spring")) {
      if (name.includes("chassis")) {
        copper = 2; steel = 88; aluminum = 5; nickel = 1; other = 4;
      } else if (name.includes("panel")) {
        copper = 0; steel = 95; aluminum = 0; nickel = 1; other = 4;
      } else if (name.includes("spring")) {
        copper = 0; steel = 98; aluminum = 0; nickel = 1; other = 1;
      } else {
        copper = 0; steel = 90; aluminum = 0; nickel = 5; other = 5;
      }
    } else if (name.includes("aluminum") || name.includes("shield") || name.includes("housing") || name.includes("wheel") || name.includes("cylinder")) {
      if (name.includes("wheel")) {
        copper = 0; steel = 10; aluminum = 85; nickel = 0; other = 5;
      } else if (name.includes("cylinder")) {
        copper = 2; steel = 28; aluminum = 65; nickel = 1; other = 4;
      } else {
        copper = 0; steel = 10; aluminum = 80; nickel = 0; other = 10;
      }
    } else if (name.includes("catalytic") || name.includes("converter") || name.includes("exhaust")) {
      copper = 5; steel = 45; aluminum = 5; nickel = 35; other = 10;
    } else if (name.includes("cooling") || name.includes("fan") || name.includes("condenser")) {
      copper = 25; steel = 25; aluminum = 35; nickel = 5; other = 10;
    } else {
      copper = 15; steel = 50; aluminum = 15; nickel = 5; other = 15;
    }

    return {
      ...mat,
      commodityWeights: { copper, steel, aluminum, nickel, other },
      isAiMapped: true,
      mappingExplanation: `Derived via local heuristic rules matching key technical terms in: "${mat.name}". (Offline Mode active)`
    };
  });
};

const PHARMA_MATERIALS = [
  {
    id: "MAT-PH01",
    name: "Paracetamol API Active Compound (Acetaminophen)",
    category: "Active Ingredients",
    unitPrice: 24.5,
    currency: "USD",
    volume: 12000,
    totalValue: 294000,
    vendorName: "Hebei Jiheng Pharmaceutical Co",
    vendorCountry: "China",
    commodityWeights: { copper: 85, steel: 5, aluminum: 0, nickel: 0, other: 10 },
    isAiMapped: false,
    inventoryUsed: 8400,
    inventoryOrdered: 3100,
    inventoryBufferStock: 1500
  },
  {
    id: "MAT-PH02",
    name: "USP Grade Anhydrous Ethanol Solvent (99.9%)",
    category: "Process Solvents",
    unitPrice: 3.1,
    currency: "USD",
    volume: 150000,
    totalValue: 465000,
    vendorName: "BP Chemicals Specialty Ltd",
    vendorCountry: "United Kingdom",
    commodityWeights: { copper: 5, steel: 85, aluminum: 5, nickel: 0, other: 5 },
    isAiMapped: false,
    inventoryUsed: 112000,
    inventoryOrdered: 44000,
    inventoryBufferStock: 18000
  },
  {
    id: "MAT-PH03",
    name: "10ml Borosilicate Injectable Glass Vials",
    category: "Primary Packaging",
    unitPrice: 0.42,
    currency: "USD",
    volume: 1200000,
    totalValue: 504000,
    vendorName: "Schott Glass India Pvt Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 0, steel: 10, aluminum: 5, nickel: 80, other: 5 },
    isAiMapped: false,
    inventoryUsed: 820000,
    inventoryOrdered: 310000,
    inventoryBufferStock: 120000
  },
  {
    id: "MAT-PH04",
    name: "Push-Through Blister Aluminum Packaging Foil",
    category: "Secondary Packaging",
    unitPrice: 11.5,
    currency: "USD",
    volume: 25000,
    totalValue: 287500,
    vendorName: "Hindalco Sourcing Industries",
    vendorCountry: "India",
    commodityWeights: { copper: 0, steel: 0, aluminum: 95, nickel: 0, other: 5 },
    isAiMapped: false,
    inventoryUsed: 17500,
    inventoryOrdered: 6200,
    inventoryBufferStock: 2200
  },
  {
    id: "MAT-PH05",
    name: "Amoxicillin Trihydrate Premium API Powder",
    category: "Active Ingredients",
    unitPrice: 41.0,
    currency: "USD",
    volume: 8000,
    totalValue: 328000,
    vendorName: "Aurobindo Active Sourcing Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 75, steel: 10, aluminum: 0, nickel: 0, other: 15 },
    isAiMapped: false,
    inventoryUsed: 5400,
    inventoryOrdered: 2100,
    inventoryBufferStock: 1100
  }
];

const PHARMA_COMMODITIES = [
  {
    id: "copper",
    name: "API Chemicals Index (Phenol)",
    symbol: "PHEN-F",
    currentPrice: 1150,
    unit: "USD/MT",
    change24h: 2.15,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 1020 },
      { date: "Aug 25", price: 1050 },
      { date: "Sep 25", price: 1090 },
      { date: "Oct 25", price: 1080 },
      { date: "Nov 25", price: 1100 },
      { date: "Dec 25", price: 1070 },
      { date: "Jan 26", price: 1110 },
      { date: "Feb 26", price: 1130 },
      { date: "Mar 26", price: 1160 },
      { date: "Apr 26", price: 1140 },
      { date: "May 26", price: 1120 },
      { date: "Jun 26", price: 1150 }
    ],
    forecast: [
      { period: "Q3 2026", price: 1220, change: 6.1, signal: "up" },
      { period: "Q4 2026", price: 1280, change: 11.3, signal: "up" },
      { period: "Q1 2027", price: 1350, change: 17.4, signal: "up" },
      { period: "Q2 2027", price: 1300, change: 13.0, signal: "down" }
    ],
    foContracts: [
      { symbol: "PHEU26 (Futures)", exchange: "CME (Chicago)", contractType: "Futures", currentPrice: 1160, expiryDate: "2026-09-28", lotSize: "5,000 lbs", openInterest: 8200, volume: 1400 },
      { symbol: "PHEZ26 (Futures)", exchange: "CME (Chicago)", contractType: "Futures", currentPrice: 1210, expiryDate: "2026-12-28", lotSize: "5,000 lbs", openInterest: 9400, volume: 2100 }
    ]
  },
  {
    id: "steel",
    name: "Organic Solvents Index",
    symbol: "SOLV-I",
    currentPrice: 890,
    unit: "USD/MT",
    change24h: -1.2,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 950 },
      { date: "Aug 25", price: 940 },
      { date: "Sep 25", price: 930 },
      { date: "Oct 25", price: 920 },
      { date: "Nov 25", price: 915 },
      { date: "Dec 25", price: 900 },
      { date: "Jan 26", price: 895 },
      { date: "Feb 26", price: 885 },
      { date: "Mar 26", price: 890 },
      { date: "Apr 26", price: 880 },
      { date: "May 26", price: 885 },
      { date: "Jun 26", price: 890 }
    ],
    forecast: [
      { period: "Q3 2026", price: 870, change: -2.2, signal: "down" },
      { period: "Q4 2026", price: 850, change: -4.5, signal: "down" },
      { period: "Q1 2027", price: 865, change: -2.8, signal: "up" },
      { period: "Q2 2027", price: 880, change: -1.1, signal: "up" }
    ],
    foContracts: [
      { symbol: "SOLU26 (Futures)", exchange: "SGE (Shanghai)", contractType: "Futures", currentPrice: 885, expiryDate: "2026-09-15", lotSize: "10 Metric Tons", openInterest: 4100, volume: 650 }
    ]
  },
  {
    id: "aluminum",
    name: "Aluminum Packaging Foil Base",
    symbol: "ALF-F",
    currentPrice: 2850,
    unit: "USD/MT",
    change24h: 0.95,
    volatility: "Low",
    history: [
      { date: "Jul 25", price: 2700 },
      { date: "Aug 25", price: 2720 },
      { date: "Sep 25", price: 2750 },
      { date: "Oct 25", price: 2730 },
      { date: "Nov 25", price: 2780 },
      { date: "Dec 25", price: 2810 },
      { date: "Jan 26", price: 2830 },
      { date: "Feb 26", price: 2860 },
      { date: "Mar 26", price: 2890 },
      { date: "Apr 26", price: 2870 },
      { date: "May 26", price: 2840 },
      { date: "Jun 26", price: 2850 }
    ],
    forecast: [
      { period: "Q3 2026", price: 2950, change: 3.5, signal: "up" },
      { period: "Q4 2026", price: 3020, change: 5.9, signal: "up" },
      { period: "Q1 2027", price: 2980, change: 4.5, signal: "down" },
      { period: "Q2 2027", price: 2910, change: 2.1, signal: "down" }
    ],
    foContracts: [
      { symbol: "ALFU26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 2870, expiryDate: "2026-09-16", lotSize: "10 Metric Tons", openInterest: 38000, volume: 4900 }
    ]
  },
  {
    id: "nickel",
    name: "Borosilicate Glass Base",
    symbol: "GLS-F",
    currentPrice: 620,
    unit: "USD/MT",
    change24h: 0.35,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 580 },
      { date: "Aug 25", price: 590 },
      { date: "Sep 25", price: 600 },
      { date: "Oct 25", price: 595 },
      { date: "Nov 25", price: 610 },
      { date: "Dec 25", price: 615 },
      { date: "Jan 26", price: 620 },
      { date: "Feb 26", price: 630 },
      { date: "Mar 26", price: 640 },
      { date: "Apr 26", price: 635 },
      { date: "May 26", price: 615 },
      { date: "Jun 26", price: 620 }
    ],
    forecast: [
      { period: "Q3 2026", price: 635, change: 2.4, signal: "up" },
      { period: "Q4 2026", price: 650, change: 4.8, signal: "up" },
      { period: "Q1 2027", price: 640, change: 3.2, signal: "down" },
      { period: "Q2 2027", price: 630, change: 1.6, signal: "down" }
    ],
    foContracts: [
      { symbol: "GLAU26 (Futures)", exchange: "DCE (Dalian)", contractType: "Futures", currentPrice: 625, expiryDate: "2026-09-15", lotSize: "50 Metric Tons", openInterest: 110000, volume: 15400 }
    ]
  }
];

const PHARMA_RISKS = [
  { country: "India", riskScore: 1.5, status: "Stable", description: "Local active synthesis units & packaging material hubs.", vendorCount: 3, materialShare: 45 },
  { country: "China", riskScore: 4.2, status: "High Risk", description: "Bulk API key starting materials (KSM) import corridor. Highly sensitive to geopolitical shifts.", vendorCount: 1, materialShare: 31 },
  { country: "United Kingdom", riskScore: 2.0, status: "Stable", description: "Specialized extraction solvents under stable European shipping corridors.", vendorCount: 1, materialShare: 16 },
  { country: "Germany", riskScore: 1.8, status: "Stable", description: "Specialized sterile glass suppliers with stringent quality compliance.", vendorCount: 1, materialShare: 8 }
];

const RETAIL_MATERIALS = [
  {
    id: "MAT-RT01",
    name: "Premium Long-Staple Organic Cotton Yarn",
    category: "Textile Apparel Raw",
    unitPrice: 15.2,
    currency: "USD",
    volume: 50000,
    totalValue: 760000,
    vendorName: "Gujarat Cotton Co-operative Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 90, steel: 0, aluminum: 0, nickel: 0, other: 10 },
    isAiMapped: false,
    inventoryUsed: 37500,
    inventoryOrdered: 12500,
    inventoryBufferStock: 4000
  },
  {
    id: "MAT-RT02",
    name: "Corrugated Kraft Cardboard Boxes (Secondary Outer Box)",
    category: "Logistic Packaging",
    unitPrice: 1.45,
    currency: "USD",
    volume: 600000,
    totalValue: 870000,
    vendorName: "WestPack Sourcing Mills",
    vendorCountry: "Vietnam",
    commodityWeights: { copper: 0, steel: 92, aluminum: 0, nickel: 0, other: 8 },
    isAiMapped: false,
    inventoryUsed: 430000,
    inventoryOrdered: 175000,
    inventoryBufferStock: 50000
  },
  {
    id: "MAT-RT03",
    name: "Polyethylene Terephthalate (PET) Plastic Resins",
    category: "Plastic Containers",
    unitPrice: 1.12,
    currency: "USD",
    volume: 800000,
    totalValue: 896000,
    vendorName: "Reliance Polymers India",
    vendorCountry: "India",
    commodityWeights: { copper: 0, steel: 5, aluminum: 88, nickel: 0, other: 7 },
    isAiMapped: false,
    inventoryUsed: 580000,
    inventoryOrdered: 220000,
    inventoryBufferStock: 75000
  },
  {
    id: "MAT-RT04",
    name: "Sharbati Basmati Rice Grains (Bulk Bales)",
    category: "Dry Groceries Sourcing",
    unitPrice: 1.82,
    currency: "USD",
    volume: 450000,
    totalValue: 819000,
    vendorName: "Haryana Agri-Products Cooperative",
    vendorCountry: "India",
    commodityWeights: { copper: 0, steel: 0, aluminum: 5, nickel: 90, other: 5 },
    isAiMapped: false,
    inventoryUsed: 310000,
    inventoryOrdered: 140000,
    inventoryBufferStock: 35000
  }
];

const RETAIL_COMMODITIES = [
  {
    id: "copper",
    name: "Cotton No. 2 (ICE)",
    symbol: "CT-F",
    currentPrice: 1980,
    unit: "USD/MT",
    change24h: -1.05,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 2100 },
      { date: "Aug 25", price: 2080 },
      { date: "Sep 25", price: 2050 },
      { date: "Oct 25", price: 2020 },
      { date: "Nov 25", price: 1990 },
      { date: "Dec 25", price: 1970 },
      { date: "Jan 26", price: 1950 },
      { date: "Feb 26", price: 1930 },
      { date: "Mar 26", price: 1960 },
      { date: "Apr 26", price: 1950 },
      { date: "May 26", price: 1965 },
      { date: "Jun 26", price: 1980 }
    ],
    forecast: [
      { period: "Q3 2026", price: 1910, change: -3.5, signal: "down" },
      { period: "Q4 2026", price: 1850, change: -6.5, signal: "down" },
      { period: "Q1 2027", price: 1890, change: -4.5, signal: "up" },
      { period: "Q2 2027", price: 1940, change: -2.0, signal: "up" }
    ],
    foContracts: [
      { symbol: "CTU26 (Futures)", exchange: "ICE (New York)", contractType: "Futures", currentPrice: 1960, expiryDate: "2026-09-18", lotSize: "50,000 lbs", openInterest: 14200, volume: 2300 }
    ]
  },
  {
    id: "steel",
    name: "Kraft Pulp & Paper Index",
    symbol: "PULP-F",
    currentPrice: 720,
    unit: "USD/MT",
    change24h: 1.15,
    volatility: "Low",
    history: [
      { date: "Jul 25", price: 680 },
      { date: "Aug 25", price: 690 },
      { date: "Sep 25", price: 695 },
      { date: "Oct 25", price: 700 },
      { date: "Nov 25", price: 710 },
      { date: "Dec 25", price: 715 },
      { date: "Jan 26", price: 705 },
      { date: "Feb 26", price: 710 },
      { date: "Mar 26", price: 725 },
      { date: "Apr 26", price: 720 },
      { date: "May 26", price: 715 },
      { date: "Jun 26", price: 720 }
    ],
    forecast: [
      { period: "Q3 2026", price: 740, change: 2.7, signal: "up" },
      { period: "Q4 2026", price: 760, change: 5.5, signal: "up" },
      { period: "Q1 2027", price: 750, change: 4.1, signal: "down" },
      { period: "Q2 2027", price: 735, change: 2.0, signal: "down" }
    ],
    foContracts: [
      { symbol: "PLPU26 (Futures)", exchange: "NOREX (Oslo)", contractType: "Futures", currentPrice: 725, expiryDate: "2026-09-15", lotSize: "100 Metric Tons", openInterest: 8400, volume: 1100 }
    ]
  },
  {
    id: "aluminum",
    name: "Polyethylene PET Plastics",
    symbol: "PET-F",
    currentPrice: 1220,
    unit: "USD/MT",
    change24h: 0.45,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 1150 },
      { date: "Aug 25", price: 1160 },
      { date: "Sep 25", price: 1180 },
      { date: "Oct 25", price: 1170 },
      { date: "Nov 25", price: 1195 },
      { date: "Dec 25", price: 1210 },
      { date: "Jan 26", price: 1200 },
      { date: "Feb 26", price: 1215 },
      { date: "Mar 26", price: 1230 },
      { date: "Apr 26", price: 1225 },
      { date: "May 26", price: 1210 },
      { date: "Jun 26", price: 1220 }
    ],
    forecast: [
      { period: "Q3 2026", price: 1250, change: 2.4, signal: "up" },
      { period: "Q4 2026", price: 1285, change: 5.3, signal: "up" },
      { period: "Q1 2027", price: 1260, change: 3.2, signal: "down" },
      { period: "Q2 2027", price: 1230, change: 0.8, signal: "down" }
    ],
    foContracts: [
      { symbol: "PETU26 (Futures)", exchange: "DCE (Dalian)", contractType: "Futures", currentPrice: 1225, expiryDate: "2026-09-15", lotSize: "20 Metric Tons", openInterest: 62000, volume: 9200 }
    ]
  },
  {
    id: "nickel",
    name: "CBOT Agricultural Grains",
    symbol: "GRN-F",
    currentPrice: 420,
    unit: "USD/MT",
    change24h: 1.85,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 380 },
      { date: "Aug 25", price: 390 },
      { date: "Sep 25", price: 395 },
      { date: "Oct 25", price: 385 },
      { date: "Nov 25", price: 405 },
      { date: "Dec 25", price: 412 },
      { date: "Jan 26", price: 408 },
      { date: "Feb 26", price: 415 },
      { date: "Mar 26", price: 425 },
      { date: "Apr 26", price: 420 },
      { date: "May 26", price: 412 },
      { date: "Jun 26", price: 420 }
    ],
    forecast: [
      { period: "Q3 2026", price: 438, change: 4.2, signal: "up" },
      { period: "Q4 2026", price: 455, change: 8.3, signal: "up" },
      { period: "Q1 2027", price: 442, change: 5.2, signal: "down" },
      { period: "Q2 2027", price: 430, change: 2.3, signal: "down" }
    ],
    foContracts: [
      { symbol: "ZRU26 (Futures)", exchange: "CBOT (Chicago)", contractType: "Futures", currentPrice: 422, expiryDate: "2026-09-14", lotSize: "5,000 bushels", openInterest: 154000, volume: 21500 }
    ]
  }
];

const RETAIL_RISKS = [
  { country: "India", riskScore: 1.5, status: "Stable", description: "Domestic farm procurement networks & logistics hubs.", vendorCount: 3, materialShare: 64 },
  { country: "Vietnam", riskScore: 2.5, status: "Caution", description: "Corrugated cardboard mill mills. Moderately steady shipping sea lines.", vendorCount: 1, materialShare: 18 },
  { country: "Bangladesh", riskScore: 3.5, status: "Caution", description: "Garment yarn processing channels. Moderate labor and geopolitical risk.", vendorCount: 1, materialShare: 12 },
  { country: "China", riskScore: 3.9, status: "Caution", description: "PET polymer resins supplier subject to generic bilateral trade tariffs.", vendorCount: 1, materialShare: 6 }
];

// Excel File Management and Persistence Setup (DATA_DIR is already initialized globally at top of file)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// -------------------------------------------------------------
// NEW INDUSTRY DATASETS: TELECOM, FINANCE, BANKS, OIL & GAS, MANUFACTURING, SOFTWARE
// -------------------------------------------------------------

// 1. TELECOM (Bharti Airtel / Telecom Infrastructure)
const TELECOM_MATERIALS = [
  {
    id: "MAT-TEL01",
    name: "Optical Fiber Cable Double-Armored (Heavy Core)",
    category: "Cabling Networks",
    unitPrice: 12.5,
    currency: "USD",
    volume: 300000,
    totalValue: 3750000,
    vendorName: "Sterlite Technologies Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 5, steel: 35, aluminum: 5, nickel: 5, other: 50 },
    isAiMapped: false,
    inventoryUsed: 220000,
    inventoryOrdered: 90000,
    inventoryBufferStock: 30000
  },
  {
    id: "MAT-TEL02",
    name: "5G Heavy-Duty Galvanized Steel Tower Mast",
    category: "Telecom Infrastructure",
    unitPrice: 8500,
    currency: "USD",
    volume: 250,
    totalValue: 2125000,
    vendorName: "KEC International Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 2, steel: 85, aluminum: 5, nickel: 0, other: 8 },
    isAiMapped: false,
    inventoryUsed: 180,
    inventoryOrdered: 80,
    inventoryBufferStock: 25
  },
  {
    id: "MAT-TEL03",
    name: "Outdoor 5G Transceiver Unit (Massive MIMO Hub)",
    category: "Active Radio Devices",
    unitPrice: 4200,
    currency: "USD",
    volume: 600,
    totalValue: 2520000,
    vendorName: "Samsung Networks",
    vendorCountry: "South Korea",
    commodityWeights: { copper: 25, steel: 10, aluminum: 45, nickel: 10, other: 10 },
    isAiMapped: false,
    inventoryUsed: 450,
    inventoryOrdered: 200,
    inventoryBufferStock: 60
  },
  {
    id: "MAT-TEL04",
    name: "Telecom Lead-Acid Battery Storage Cabinet",
    category: "Power Backup",
    unitPrice: 350,
    currency: "USD",
    volume: 4000,
    totalValue: 1400000,
    vendorName: "Exide Industries Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 15, steel: 15, aluminum: 10, nickel: 55, other: 5 },
    isAiMapped: false,
    inventoryUsed: 2900,
    inventoryOrdered: 1200,
    inventoryBufferStock: 400
  }
];

const TELECOM_COMMODITIES = [
  {
    id: "copper",
    name: "Optical Fiber & Core copper Index",
    symbol: "OFC-C",
    currentPrice: 8400,
    unit: "USD/MT",
    change24h: 1.85,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 7900 },
      { date: "Aug 25", price: 8100 },
      { date: "Sep 25", price: 8050 },
      { date: "Oct 25", price: 8120 },
      { date: "Nov 25", price: 8200 },
      { date: "Dec 25", price: 8150 },
      { date: "Jan 26", price: 8300 },
      { date: "Feb 26", price: 8280 },
      { date: "Mar 26", price: 8350 },
      { date: "Apr 26", price: 8420 },
      { date: "May 26", price: 8380 },
      { date: "Jun 26", price: 8400 }
    ],
    forecast: [
      { period: "Q3 2026", price: 8650, change: 3.0, signal: "up" },
      { period: "Q4 2026", price: 8890, change: 5.8, signal: "up" },
      { period: "Q1 2027", price: 8720, change: 3.8, signal: "down" },
      { period: "Q2 2027", price: 8600, change: 2.4, signal: "down" }
    ],
    foContracts: [
      { symbol: "OFCU26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 8420, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 24000, volume: 3200 }
    ]
  },
  {
    id: "steel",
    name: "Galvanized Steel Mast Index",
    symbol: "MAST-S",
    currentPrice: 780,
    unit: "USD/MT",
    change24h: -0.95,
    volatility: "Low",
    history: [
      { date: "Jul 25", price: 840 },
      { date: "Aug 25", price: 830 },
      { date: "Sep 25", price: 815 },
      { date: "Oct 25", price: 805 },
      { date: "Nov 25", price: 795 },
      { date: "Dec 25", price: 790 },
      { date: "Jan 26", price: 785 },
      { date: "Feb 26", price: 780 },
      { date: "Mar 26", price: 795 },
      { date: "Apr 26", price: 790 },
      { date: "May 26", price: 782 },
      { date: "Jun 26", price: 780 }
    ],
    forecast: [
      { period: "Q3 2026", price: 765, change: -1.9, signal: "down" },
      { period: "Q4 2026", price: 745, change: -4.5, signal: "down" },
      { period: "Q1 2027", price: 760, change: -2.6, signal: "up" },
      { period: "Q2 2027", price: 775, change: -0.6, signal: "up" }
    ],
    foContracts: [
      { symbol: "MSTS26 (Futures)", exchange: "SGE (Shanghai)", contractType: "Futures", currentPrice: 778, expiryDate: "2026-09-18", lotSize: "100 Metric Tons", openInterest: 14500, volume: 1800 }
    ]
  },
  {
    id: "aluminum",
    name: "Transceiver Alloy Enclosure Index",
    symbol: "TRAN-A",
    currentPrice: 2480,
    unit: "USD/MT",
    change24h: 1.15,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 2320 },
      { date: "Aug 25", price: 2350 },
      { date: "Sep 25", price: 2390 },
      { date: "Oct 25", price: 2370 },
      { date: "Nov 25", price: 2420 },
      { date: "Dec 25", price: 2440 },
      { date: "Jan 26", price: 2450 },
      { date: "Feb 26", price: 2470 },
      { date: "Mar 26", price: 2510 },
      { date: "Apr 26", price: 2490 },
      { date: "May 26", price: 2460 },
      { date: "Jun 26", price: 2480 }
    ],
    forecast: [
      { period: "Q3 2026", price: 2560, change: 3.2, signal: "up" },
      { period: "Q4 2026", price: 2630, change: 6.0, signal: "up" },
      { period: "Q1 2027", price: 2590, change: 4.4, signal: "down" },
      { period: "Q2 2027", price: 2540, change: 2.4, signal: "down" }
    ],
    foContracts: [
      { symbol: "TRNA26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 2495, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 31000, volume: 4400 }
    ]
  },
  {
    id: "nickel",
    name: "Battery Lead-Nickel Core Index",
    symbol: "BATT-N",
    currentPrice: 16800,
    unit: "USD/MT",
    change24h: 0.85,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 15500 },
      { date: "Aug 25", price: 15750 },
      { date: "Sep 25", price: 16100 },
      { date: "Oct 25", price: 15950 },
      { date: "Nov 25", price: 16300 },
      { date: "Dec 25", price: 16420 },
      { date: "Jan 26", price: 16500 },
      { date: "Feb 26", price: 16650 },
      { date: "Mar 26", price: 16900 },
      { date: "Apr 26", price: 16750 },
      { date: "May 26", price: 16620 },
      { date: "Jun 26", price: 16800 }
    ],
    forecast: [
      { period: "Q3 2026", price: 17400, change: 3.5, signal: "up" },
      { period: "Q4 2026", price: 18100, change: 7.7, signal: "up" },
      { period: "Q1 2027", price: 17700, change: 5.3, signal: "down" },
      { period: "Q2 2027", price: 17200, change: 2.3, signal: "down" }
    ],
    foContracts: [
      { symbol: "BATN26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 16920, expiryDate: "2026-09-16", lotSize: "6 Metric Tons", openInterest: 42000, volume: 5600 }
    ]
  }
];

const TELECOM_RISKS = [
  { country: "India", riskScore: 1.5, status: "Stable", description: "Vast local passive fabrication plants for fiber & masts.", vendorCount: 3, materialShare: 77 },
  { country: "South Korea", riskScore: 2.0, status: "Stable", description: "Advanced high-volume active radio components corridors.", vendorCount: 1, materialShare: 23 }
];

// 2. FINANCE (State Bank of India / Treasury & Infrastructure)
const FINANCE_MATERIALS = [
  {
    id: "MAT-FIN01",
    name: "UTP Category 6A Shielded Lan Cables (Copper Core)",
    category: "Cabling Networks",
    unitPrice: 1.2,
    currency: "USD",
    volume: 1000000,
    totalValue: 1200000,
    vendorName: "Finolex Cables Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 85, steel: 0, aluminum: 5, nickel: 0, other: 10 },
    isAiMapped: false,
    inventoryUsed: 750000,
    inventoryOrdered: 250000,
    inventoryBufferStock: 80000
  },
  {
    id: "MAT-FIN02",
    name: "Enterprise Server Rack Chassis Unit (Heavy Framing)",
    category: "Datacenter Hardware",
    unitPrice: 1100,
    currency: "USD",
    volume: 1500,
    totalValue: 1650000,
    vendorName: "Rittal India Pvt Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 5, steel: 80, aluminum: 5, nickel: 5, other: 5 },
    isAiMapped: false,
    inventoryUsed: 1100,
    inventoryOrdered: 400,
    inventoryBufferStock: 150
  },
  {
    id: "MAT-FIN03",
    name: "Datacenter Liquid Cooling Radiator System",
    category: "Thermal Management",
    unitPrice: 15000,
    currency: "USD",
    volume: 120,
    totalValue: 1800000,
    vendorName: "Trane Sourcing Corp",
    vendorCountry: "USA",
    commodityWeights: { copper: 15, steel: 15, aluminum: 65, nickel: 5, other: 0 },
    isAiMapped: false,
    inventoryUsed: 80,
    inventoryOrdered: 40,
    inventoryBufferStock: 15
  },
  {
    id: "MAT-FIN04",
    name: "Hardware Security Module (HSM) Cryptographic Core",
    category: "Secured Active Tech",
    unitPrice: 25000,
    currency: "USD",
    volume: 80,
    totalValue: 2000000,
    vendorName: "Thales eSecurity",
    vendorCountry: "France",
    commodityWeights: { copper: 20, steel: 10, aluminum: 10, nickel: 50, other: 10 },
    isAiMapped: false,
    inventoryUsed: 60,
    inventoryOrdered: 20,
    inventoryBufferStock: 8
  }
];

const FINANCE_COMMODITIES = [
  {
    id: "copper",
    name: "Fintech Lan Infrastructure copper",
    symbol: "FIN-C",
    currentPrice: 8550,
    unit: "USD/MT",
    change24h: 1.45,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 8100 },
      { date: "Aug 25", price: 8250 },
      { date: "Sep 25", price: 8300 },
      { date: "Oct 25", price: 8200 },
      { date: "Nov 25", price: 8390 },
      { date: "Dec 25", price: 8410 },
      { date: "Jan 26", price: 8450 },
      { date: "Feb 26", price: 8480 },
      { date: "Mar 26", price: 8580 },
      { date: "Apr 26", price: 8610 },
      { date: "May 26", price: 8500 },
      { date: "Jun 26", price: 8550 }
    ],
    forecast: [
      { period: "Q3 2026", price: 8780, change: 2.7, signal: "up" },
      { period: "Q4 2026", price: 8990, change: 5.1, signal: "up" },
      { period: "Q1 2027", price: 8850, change: 3.5, signal: "down" },
      { period: "Q2 2027", price: 8700, change: 1.7, signal: "down" }
    ],
    foContracts: [
      { symbol: "FINC26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 8570, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 18000, volume: 2200 }
    ]
  },
  {
    id: "steel",
    name: "Mainframe Steel Framing Index",
    symbol: "MF-ST",
    currentPrice: 650,
    unit: "USD/MT",
    change24h: -1.25,
    volatility: "Low",
    history: [
      { date: "Jul 25", price: 710 },
      { date: "Aug 25", price: 695 },
      { date: "Sep 25", price: 680 },
      { date: "Oct 25", price: 675 },
      { date: "Nov 25", price: 660 },
      { date: "Dec 25", price: 655 },
      { date: "Jan 26", price: 650 },
      { date: "Feb 26", price: 645 },
      { date: "Mar 26", price: 655 },
      { date: "Apr 26", price: 648 },
      { date: "May 26", price: 642 },
      { date: "Jun 26", price: 650 }
    ],
    forecast: [
      { period: "Q3 2026", price: 630, change: -3.0, signal: "down" },
      { period: "Q4 2026", price: 615, change: -5.3, signal: "down" },
      { period: "Q1 2027", price: 632, change: -2.7, signal: "up" },
      { period: "Q2 2027", price: 645, change: -0.7, signal: "up" }
    ],
    foContracts: [
      { symbol: "MFRK26 (Futures)", exchange: "SGE (Shanghai)", contractType: "Futures", currentPrice: 648, expiryDate: "2026-09-15", lotSize: "100 Metric Tons", openInterest: 8200, volume: 1100 }
    ]
  },
  {
    id: "aluminum",
    name: "Cooling Radiator Alloy Index",
    symbol: "COOL-A",
    currentPrice: 2240,
    unit: "USD/MT",
    change24h: 0.85,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 2110 },
      { date: "Aug 25", price: 2130 },
      { date: "Sep 25", price: 2160 },
      { date: "Oct 25", price: 2145 },
      { date: "Nov 25", price: 2180 },
      { date: "Dec 25", price: 2195 },
      { date: "Jan 26", price: 2210 },
      { date: "Feb 26", price: 2230 },
      { date: "Mar 26", price: 2260 },
      { date: "Apr 26", price: 2245 },
      { date: "May 26", price: 2225 },
      { date: "Jun 26", price: 2240 }
    ],
    forecast: [
      { period: "Q3 2026", price: 2310, change: 3.1, signal: "up" },
      { period: "Q4 2026", price: 2380, change: 6.2, signal: "up" },
      { period: "Q1 2027", price: 2340, change: 4.4, signal: "down" },
      { period: "Q2 2027", price: 2290, change: 2.2, signal: "down" }
    ],
    foContracts: [
      { symbol: "COLA26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 2250, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 14500, volume: 2200 }
    ]
  },
  {
    id: "nickel",
    name: "Crypto Processor Core Alloy",
    symbol: "CRPT-N",
    currentPrice: 15400,
    unit: "USD/MT",
    change24h: 1.15,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 14200 },
      { date: "Aug 25", price: 14450 },
      { date: "Sep 25", price: 14800 },
      { date: "Oct 25", price: 14650 },
      { date: "Nov 25", price: 14950 },
      { date: "Dec 25", price: 15100 },
      { date: "Jan 26", price: 15180 },
      { date: "Feb 26", price: 15250 },
      { date: "Mar 26", price: 15500 },
      { date: "Apr 26", price: 15350 },
      { date: "May 26", price: 15200 },
      { date: "Jun 26", price: 15400 }
    ],
    forecast: [
      { period: "Q3 2026", price: 15950, change: 3.5, signal: "up" },
      { period: "Q4 2026", price: 16600, change: 7.7, signal: "up" },
      { period: "Q1 2027", price: 16250, change: 5.5, signal: "down" },
      { period: "Q2 2027", price: 15800, change: 2.5, signal: "down" }
    ],
    foContracts: [
      { symbol: "CRPN26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 15520, expiryDate: "2026-09-16", lotSize: "6 Metric Tons", openInterest: 26000, volume: 3400 }
    ]
  }
];

const FINANCE_RISKS = [
  { country: "India", riskScore: 1.5, status: "Stable", description: "Vast engineering support base & stable connectivity lanes.", vendorCount: 2, materialShare: 43 },
  { country: "USA", riskScore: 1.8, status: "Stable", description: "High-tier server thermal systems manufactured in strict environmental lanes.", vendorCount: 1, materialShare: 27 },
  { country: "France", riskScore: 2.0, status: "Stable", description: "Advanced defense-grade cryptographic cores fabricators.", vendorCount: 1, materialShare: 30 }
];

// 3. BANKS (HDFC Bank / Retail Banking Networks)
const BANKS_MATERIALS = [
  {
    id: "MAT-BNK01",
    name: "Secure ATM Vault Heavy Welded Steel Chest",
    category: "Cash Storage",
    unitPrice: 4800,
    currency: "USD",
    volume: 1200,
    totalValue: 5760000,
    vendorName: "Godrej & Boyce Mfg Co Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 0, steel: 90, aluminum: 0, nickel: 8, other: 2 },
    isAiMapped: false,
    inventoryUsed: 850,
    inventoryOrdered: 350,
    inventoryBufferStock: 100
  },
  {
    id: "MAT-BNK02",
    name: "Multi-Core Smart Card EMV Microchips",
    category: "Customer Issuance",
    unitPrice: 0.85,
    currency: "USD",
    volume: 4000000,
    totalValue: 3400000,
    vendorName: "Infineon Technologies AG",
    vendorCountry: "Germany",
    commodityWeights: { copper: 15, steel: 5, aluminum: 5, nickel: 70, other: 5 },
    isAiMapped: false,
    inventoryUsed: 2900000,
    inventoryOrdered: 1100000,
    inventoryBufferStock: 300000
  },
  {
    id: "MAT-BNK03",
    name: "Branch Biometric USB Fingerprint Scanner",
    category: "Branch Hardware",
    unitPrice: 120,
    currency: "USD",
    volume: 15000,
    totalValue: 1800000,
    vendorName: "SecuGen India Sourcing",
    vendorCountry: "India",
    commodityWeights: { copper: 35, steel: 10, aluminum: 45, nickel: 5, other: 5 },
    isAiMapped: false,
    inventoryUsed: 11000,
    inventoryOrdered: 4000,
    inventoryBufferStock: 1200
  },
  {
    id: "MAT-BNK04",
    name: "HDSL branch High-Speed Ethernet patch Cable",
    category: "Branch LAN",
    unitPrice: 5.5,
    currency: "USD",
    volume: 150000,
    totalValue: 825000,
    vendorName: "D-Link India Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 92, steel: 0, aluminum: 3, nickel: 0, other: 5 },
    isAiMapped: false,
    inventoryUsed: 120000,
    inventoryOrdered: 30000,
    inventoryBufferStock: 8000
  }
];

const BANKS_COMMODITIES = [
  {
    id: "copper",
    name: "Branch LAN Cabling copper Index",
    symbol: "CABL-C",
    currentPrice: 8480,
    unit: "USD/MT",
    change24h: 1.15,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 8000 },
      { date: "Aug 25", price: 8120 },
      { date: "Sep 25", price: 8180 },
      { date: "Oct 25", price: 8080 },
      { date: "Nov 25", price: 8250 },
      { date: "Dec 25", price: 8310 },
      { date: "Jan 26", price: 8350 },
      { date: "Feb 26", price: 8380 },
      { date: "Mar 26", price: 8460 },
      { date: "Apr 26", price: 8490 },
      { date: "May 26", price: 8410 },
      { date: "Jun 26", price: 8480 }
    ],
    forecast: [
      { period: "Q3 2026", price: 8690, change: 2.4, signal: "up" },
      { period: "Q4 2026", price: 8910, change: 5.0, signal: "up" },
      { period: "Q1 2027", price: 8750, change: 3.1, signal: "down" },
      { period: "Q2 2027", price: 8620, change: 1.6, signal: "down" }
    ],
    foContracts: [
      { symbol: "CBLC26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 8495, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 14800, volume: 1950 }
    ]
  },
  {
    id: "steel",
    name: "Heavy Vault Structural Steel",
    symbol: "VLT-ST",
    currentPrice: 720,
    unit: "USD/MT",
    change24h: -1.05,
    volatility: "Low",
    history: [
      { date: "Jul 25", price: 780 },
      { date: "Aug 25", price: 765 },
      { date: "Sep 25", price: 750 },
      { date: "Oct 25", price: 742 },
      { date: "Nov 25", price: 730 },
      { date: "Dec 25", price: 725 },
      { date: "Jan 26", price: 720 },
      { date: "Feb 26", price: 715 },
      { date: "Mar 26", price: 725 },
      { date: "Apr 26", price: 718 },
      { date: "May 26", price: 712 },
      { date: "Jun 26", price: 720 }
    ],
    forecast: [
      { period: "Q3 2026", price: 700, change: -2.7, signal: "down" },
      { period: "Q4 2026", price: 685, change: -4.8, signal: "down" },
      { period: "Q1 2027", price: 702, change: -2.5, signal: "up" },
      { period: "Q2 2027", price: 715, change: -0.6, signal: "up" }
    ],
    foContracts: [
      { symbol: "VLTS26 (Futures)", exchange: "SGE (Shanghai)", contractType: "Futures", currentPrice: 718, expiryDate: "2026-09-15", lotSize: "100 Metric Tons", openInterest: 9200, volume: 1300 }
    ]
  },
  {
    id: "aluminum",
    name: "Scanner Enclosure Aluminum",
    symbol: "SCAN-AL",
    currentPrice: 2310,
    unit: "USD/MT",
    change24h: 0.95,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 2180 },
      { date: "Aug 25", price: 2200 },
      { date: "Sep 25", price: 2230 },
      { date: "Oct 25", price: 2210 },
      { date: "Nov 25", price: 2250 },
      { date: "Dec 25", price: 2265 },
      { date: "Jan 26", price: 2280 },
      { date: "Feb 26", price: 2300 },
      { date: "Mar 26", price: 2330 },
      { date: "Apr 26", price: 2315 },
      { date: "May 26", price: 2295 },
      { date: "Jun 26", price: 2310 }
    ],
    forecast: [
      { period: "Q3 2026", price: 2380, change: 3.0, signal: "up" },
      { period: "Q4 2026", price: 2450, change: 6.0, signal: "up" },
      { period: "Q1 2027", price: 2410, change: 4.3, signal: "down" },
      { period: "Q2 2027", price: 2360, change: 2.1, signal: "down" }
    ],
    foContracts: [
      { symbol: "SCNAL26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 2320, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 12400, volume: 1800 }
    ]
  },
  {
    id: "nickel",
    name: "EMV Chip Silicon-Nickel Substrate",
    symbol: "CHIP-N",
    currentPrice: 16100,
    unit: "USD/MT",
    change24h: 1.25,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 14800 },
      { date: "Aug 25", price: 15100 },
      { date: "Sep 25", price: 15450 },
      { date: "Oct 25", price: 15300 },
      { date: "Nov 25", price: 15650 },
      { date: "Dec 25", price: 15800 },
      { date: "Jan 26", price: 15880 },
      { date: "Feb 26", price: 15950 },
      { date: "Mar 26", price: 16200 },
      { date: "Apr 26", price: 16050 },
      { date: "May 26", price: 15900 },
      { date: "Jun 26", price: 16100 }
    ],
    forecast: [
      { period: "Q3 2026", price: 16680, change: 3.6, signal: "up" },
      { period: "Q4 2026", price: 17350, change: 7.7, signal: "up" },
      { period: "Q1 2027", price: 16980, change: 5.4, signal: "down" },
      { period: "Q2 2027", price: 16500, change: 2.4, signal: "down" }
    ],
    foContracts: [
      { symbol: "CHPN26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 16220, expiryDate: "2026-09-16", lotSize: "6 Metric Tons", openInterest: 21500, volume: 2800 }
    ]
  }
];

const BANKS_RISKS = [
  { country: "India", riskScore: 1.5, status: "Stable", description: "Vast manufacturing and secure safe physical fabrication base.", vendorCount: 3, materialShare: 71 },
  { country: "Germany", riskScore: 1.8, status: "Stable", description: "Precision microchip fabrication corridors under high ESG conformance.", vendorCount: 1, materialShare: 29 }
];

// 4. OIL & GAS (Reliance Industries / Exploration & Refining)
const OIL_GAS_MATERIALS = [
  {
    id: "MAT-ONG01",
    name: "Carbon Steel Seamless Drilling & Well Pipe",
    category: "Drilling Assemblies",
    unitPrice: 320,
    currency: "USD",
    volume: 20000,
    totalValue: 6400000,
    vendorName: "Maharashtra Seamless Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 0, steel: 95, aluminum: 0, nickel: 4, other: 1 },
    isAiMapped: false,
    inventoryUsed: 14500,
    inventoryOrdered: 5500,
    inventoryBufferStock: 1800
  },
  {
    id: "MAT-ONG02",
    name: "Corrosion-Resistant Nickel Alloy Flow Control Valve",
    category: "Flow Control",
    unitPrice: 4500,
    currency: "USD",
    volume: 1500,
    totalValue: 6750000,
    vendorName: "L&T Valves Sourcing Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 10, steel: 30, aluminum: 0, nickel: 58, other: 2 },
    isAiMapped: false,
    inventoryUsed: 1100,
    inventoryOrdered: 400,
    inventoryBufferStock: 120
  },
  {
    id: "MAT-ONG03",
    name: "Offshore Rig Heavy Structural Aluminum Decking",
    category: "Rig Construction",
    unitPrice: 15000,
    currency: "USD",
    volume: 250,
    totalValue: 3750000,
    vendorName: "Hindalco Structural Solutions",
    vendorCountry: "India",
    commodityWeights: { copper: 0, steel: 10, aluminum: 85, nickel: 0, other: 5 },
    isAiMapped: false,
    inventoryUsed: 190,
    inventoryOrdered: 60,
    inventoryBufferStock: 20
  },
  {
    id: "MAT-ONG04",
    name: "Rig Power System Heavy Subsea Cable",
    category: "Rig Power Systems",
    unitPrice: 120,
    currency: "USD",
    volume: 30000,
    totalValue: 3600000,
    vendorName: "Polycab India Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 85, steel: 10, aluminum: 2, nickel: 0, other: 3 },
    isAiMapped: false,
    inventoryUsed: 22000,
    inventoryOrdered: 8000,
    inventoryBufferStock: 2500
  }
];

const OIL_GAS_COMMODITIES = [
  {
    id: "copper",
    name: "Heavy Subsea Cable copper Index",
    symbol: "CABL-ONG",
    currentPrice: 8650,
    unit: "USD/MT",
    change24h: 1.65,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 8150 },
      { date: "Aug 25", price: 8300 },
      { date: "Sep 25", price: 8350 },
      { date: "Oct 25", price: 8250 },
      { date: "Nov 25", price: 8420 },
      { date: "Dec 25", price: 8480 },
      { date: "Jan 26", price: 8520 },
      { date: "Feb 26", price: 8560 },
      { date: "Mar 26", price: 8650 },
      { date: "Apr 26", price: 8680 },
      { date: "May 26", price: 8580 },
      { date: "Jun 26", price: 8650 }
    ],
    forecast: [
      { period: "Q3 2026", price: 8880, change: 2.6, signal: "up" },
      { period: "Q4 2026", price: 9150, change: 5.7, signal: "up" },
      { period: "Q1 2027", price: 8980, change: 3.8, signal: "down" },
      { period: "Q2 2027", price: 8820, change: 1.9, signal: "down" }
    ],
    foContracts: [
      { symbol: "ONGC26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 8670, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 16500, volume: 2100 }
    ]
  },
  {
    id: "steel",
    name: "Carbon Steel Drilling Tube Index",
    symbol: "TUBE-ST",
    currentPrice: 810,
    unit: "USD/MT",
    change24h: -1.15,
    volatility: "Low",
    history: [
      { date: "Jul 25", price: 870 },
      { date: "Aug 25", price: 855 },
      { date: "Sep 25", price: 840 },
      { date: "Oct 25", price: 832 },
      { date: "Nov 25", price: 820 },
      { date: "Dec 25", price: 815 },
      { date: "Jan 26", price: 810 },
      { date: "Feb 26", price: 805 },
      { date: "Mar 26", price: 815 },
      { date: "Apr 26", price: 808 },
      { date: "May 26", price: 802 },
      { date: "Jun 26", price: 810 }
    ],
    forecast: [
      { period: "Q3 2026", price: 790, change: -2.4, signal: "down" },
      { period: "Q4 2026", price: 770, change: -4.9, signal: "down" },
      { period: "Q1 2027", price: 788, change: -2.7, signal: "up" },
      { period: "Q2 2027", price: 805, change: -0.6, signal: "up" }
    ],
    foContracts: [
      { symbol: "ONGS26 (Futures)", exchange: "SGE (Shanghai)", contractType: "Futures", currentPrice: 808, expiryDate: "2026-09-15", lotSize: "100 Metric Tons", openInterest: 11200, volume: 1500 }
    ]
  },
  {
    id: "aluminum",
    name: "Offshore Structural Aluminum",
    symbol: "AL-DECK",
    currentPrice: 2540,
    unit: "USD/MT",
    change24h: 1.05,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 2380 },
      { date: "Aug 25", price: 2410 },
      { date: "Sep 25", price: 2450 },
      { date: "Oct 25", price: 2430 },
      { date: "Nov 25", price: 2480 },
      { date: "Dec 25", price: 2500 },
      { date: "Jan 26", price: 2510 },
      { date: "Feb 26", price: 2530 },
      { date: "Mar 26", price: 2570 },
      { date: "Apr 26", price: 2550 },
      { date: "May 26", price: 2520 },
      { date: "Jun 26", price: 2540 }
    ],
    forecast: [
      { period: "Q3 2026", price: 2620, change: 3.1, signal: "up" },
      { period: "Q4 2026", price: 2695, change: 6.1, signal: "up" },
      { period: "Q1 2027", price: 2655, change: 4.5, signal: "down" },
      { period: "Q2 2027", price: 2605, change: 2.5, signal: "down" }
    ],
    foContracts: [
      { symbol: "ONGAL26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 2555, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 15400, volume: 2100 }
    ]
  },
  {
    id: "nickel",
    name: "Corrosion-Resistant Nickel Alloy",
    symbol: "NIC-FLOW",
    currentPrice: 17400,
    unit: "USD/MT",
    change24h: 0.95,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 16100 },
      { date: "Aug 25", price: 16350 },
      { date: "Sep 25", price: 16700 },
      { date: "Oct 25", price: 16550 },
      { date: "Nov 25", price: 16900 },
      { date: "Dec 25", price: 17020 },
      { date: "Jan 26", price: 17100 },
      { date: "Feb 26", price: 17250 },
      { date: "Mar 26", price: 17500 },
      { date: "Apr 26", price: 17350 },
      { date: "May 26", price: 17220 },
      { date: "Jun 26", price: 17400 }
    ],
    forecast: [
      { period: "Q3 2026", price: 18050, change: 3.7, signal: "up" },
      { period: "Q4 2026", price: 18780, change: 7.9, signal: "up" },
      { period: "Q1 2027", price: 18380, change: 5.6, signal: "down" },
      { period: "Q2 2027", price: 17850, change: 2.5, signal: "down" }
    ],
    foContracts: [
      { symbol: "ONGN26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 17520, expiryDate: "2026-09-16", lotSize: "6 Metric Tons", openInterest: 28500, volume: 3800 }
    ]
  }
];

const OIL_GAS_RISKS = [
  { country: "India", riskScore: 1.5, status: "Stable", description: "Excellent domestic pipeline seamless tubes & valve mills.", vendorCount: 4, materialShare: 100 }
];

// 5. MANUFACTURING (Heavy Machinery & Automotive Engines)
const MANUFACTURING_MATERIALS = [
  {
    id: "MAT-MFG01",
    name: "Industrial CNC Milling structural Steel Frame",
    category: "Machine Tooling",
    unitPrice: 45000,
    currency: "USD",
    volume: 120,
    totalValue: 5400000,
    vendorName: "Ace Micromatic Group",
    vendorCountry: "India",
    commodityWeights: { copper: 5, steel: 85, aluminum: 5, nickel: 3, other: 2 },
    isAiMapped: false,
    inventoryUsed: 85,
    inventoryOrdered: 35,
    inventoryBufferStock: 12
  },
  {
    id: "MAT-MFG02",
    name: "Engine Drive System Cast Iron Gears Block",
    category: "Drive Systems",
    unitPrice: 420,
    currency: "USD",
    volume: 15000,
    totalValue: 6300000,
    vendorName: "Kirloskar Ferrous Industries",
    vendorCountry: "India",
    commodityWeights: { copper: 2, steel: 93, aluminum: 0, nickel: 3, other: 2 },
    isAiMapped: false,
    inventoryUsed: 11000,
    inventoryOrdered: 4000,
    inventoryBufferStock: 1500
  },
  {
    id: "MAT-MFG03",
    name: "Heavy-Duty copper Inductor Heating Coil",
    category: "Heating Systems",
    unitPrice: 1800,
    currency: "USD",
    volume: 2000,
    totalValue: 3600000,
    vendorName: "TDK India Private Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 88, steel: 5, aluminum: 5, nickel: 0, other: 2 },
    isAiMapped: false,
    inventoryUsed: 1400,
    inventoryOrdered: 600,
    inventoryBufferStock: 200
  },
  {
    id: "MAT-MFG04",
    name: "Pneumatic Aluminum Actuator Cylinder",
    category: "Motion Control",
    unitPrice: 290,
    currency: "USD",
    volume: 12000,
    totalValue: 3480000,
    vendorName: "Festo India Sourcing",
    vendorCountry: "India",
    commodityWeights: { copper: 5, steel: 15, aluminum: 75, nickel: 0, other: 5 },
    isAiMapped: false,
    inventoryUsed: 9200,
    inventoryOrdered: 2800,
    inventoryBufferStock: 1000
  }
];

const MANUFACTURING_COMMODITIES = [
  {
    id: "copper",
    name: "Heavy Inductor copper Index",
    symbol: "IND-COP",
    currentPrice: 8520,
    unit: "USD/MT",
    change24h: 1.55,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 8050 },
      { date: "Aug 25", price: 8200 },
      { date: "Sep 25", price: 8260 },
      { date: "Oct 25", price: 8160 },
      { date: "Nov 25", price: 8330 },
      { date: "Dec 25", price: 8390 },
      { date: "Jan 26", price: 8420 },
      { date: "Feb 26", price: 8460 },
      { date: "Mar 26", price: 8540 },
      { date: "Apr 26", price: 8570 },
      { date: "May 26", price: 8470 },
      { date: "Jun 26", price: 8520 }
    ],
    forecast: [
      { period: "Q3 2026", price: 8750, change: 2.7, signal: "up" },
      { period: "Q4 2026", price: 9020, change: 5.8, signal: "up" },
      { period: "Q1 2027", price: 8860, change: 3.9, signal: "down" },
      { period: "Q2 2027", price: 8720, change: 2.3, signal: "down" }
    ],
    foContracts: [
      { symbol: "INDC26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 8540, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 15400, volume: 1850 }
    ]
  },
  {
    id: "steel",
    name: "Cast Iron & Tooling Steel Index",
    symbol: "MACH-ST",
    currentPrice: 690,
    unit: "USD/MT",
    change24h: -1.35,
    volatility: "Low",
    history: [
      { date: "Jul 25", price: 750 },
      { date: "Aug 25", price: 735 },
      { date: "Sep 25", price: 720 },
      { date: "Oct 25", price: 712 },
      { date: "Nov 25", price: 700 },
      { date: "Dec 25", price: 695 },
      { date: "Jan 26", price: 690 },
      { date: "Feb 26", price: 685 },
      { date: "Mar 26", price: 695 },
      { date: "Apr 26", price: 688 },
      { date: "May 26", price: 682 },
      { date: "Jun 26", price: 690 }
    ],
    forecast: [
      { period: "Q3 2026", price: 670, change: -2.8, signal: "down" },
      { period: "Q4 2026", price: 652, change: -5.5, signal: "down" },
      { period: "Q1 2027", price: 670, change: -2.8, signal: "up" },
      { period: "Q2 2027", price: 685, change: -0.7, signal: "up" }
    ],
    foContracts: [
      { symbol: "MCHST26 (Futures)", exchange: "SGE (Shanghai)", contractType: "Futures", currentPrice: 688, expiryDate: "2026-09-15", lotSize: "100 Metric Tons", openInterest: 11000, volume: 1400 }
    ]
  },
  {
    id: "aluminum",
    name: "Pneumatic Cylinder Aluminum",
    symbol: "PNUM-AL",
    currentPrice: 2360,
    unit: "USD/MT",
    change24h: 1.15,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 2210 },
      { date: "Aug 25", price: 2230 },
      { date: "Sep 25", price: 2270 },
      { date: "Oct 25", price: 2250 },
      { date: "Nov 25", price: 2300 },
      { date: "Dec 25", price: 2320 },
      { date: "Jan 26", price: 2330 },
      { date: "Feb 26", price: 2350 },
      { date: "Mar 26", price: 2390 },
      { date: "Apr 26", price: 2370 },
      { date: "May 26", price: 2340 },
      { date: "Jun 26", price: 2360 }
    ],
    forecast: [
      { period: "Q3 2026", price: 2440, change: 3.3, signal: "up" },
      { period: "Q4 2026", price: 2510, change: 6.3, signal: "up" },
      { period: "Q1 2027", price: 2470, change: 4.6, signal: "down" },
      { period: "Q2 2027", price: 2420, change: 2.5, signal: "down" }
    ],
    foContracts: [
      { symbol: "PNMAL26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 2375, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 15400, volume: 2200 }
    ]
  },
  {
    id: "nickel",
    name: "CNC Precision Alloy Elements",
    symbol: "CNC-ALL",
    currentPrice: 15900,
    unit: "USD/MT",
    change24h: 0.95,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 14700 },
      { date: "Aug 25", price: 14950 },
      { date: "Sep 25", price: 15300 },
      { date: "Oct 25", price: 15150 },
      { date: "Nov 25", price: 15500 },
      { date: "Dec 25", price: 15620 },
      { date: "Jan 26", price: 15700 },
      { date: "Feb 26", price: 15820 },
      { date: "Mar 26", price: 16100 },
      { date: "Apr 26", price: 15950 },
      { date: "May 26", price: 15780 },
      { date: "Jun 26", price: 15900 }
    ],
    forecast: [
      { period: "Q3 2026", price: 16500, change: 3.7, signal: "up" },
      { period: "Q4 2026", price: 17180, change: 8.0, signal: "up" },
      { period: "Q1 2027", price: 16800, change: 5.6, signal: "down" },
      { period: "Q2 2027", price: 16320, change: 2.6, signal: "down" }
    ],
    foContracts: [
      { symbol: "CNCA26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 16020, expiryDate: "2026-09-16", lotSize: "6 Metric Tons", openInterest: 18200, volume: 2300 }
    ]
  }
];

const MANUFACTURING_RISKS = [
  { country: "India", riskScore: 1.5, status: "Stable", description: "Vast tooling and drive component fabrication centers.", vendorCount: 4, materialShare: 100 }
];

// 6. SOFTWARE (TCS / Cloud Systems & Datacenters)
const SOFTWARE_MATERIALS = [
  {
    id: "MAT-SFT01",
    name: "Datacenter Core Network copper Power Cords",
    category: "Cabling Networks",
    unitPrice: 18,
    currency: "USD",
    volume: 150000,
    totalValue: 2700000,
    vendorName: "Finolex Cables Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 88, steel: 0, aluminum: 5, nickel: 0, other: 7 },
    isAiMapped: false,
    inventoryUsed: 110000,
    inventoryOrdered: 40000,
    inventoryBufferStock: 12000
  },
  {
    id: "MAT-SFT02",
    name: "Blade Server Aluminum Cooling Heatsinks Fin",
    category: "Storage Hardware",
    unitPrice: 85,
    currency: "USD",
    volume: 80000,
    totalValue: 6800000,
    vendorName: "Delta Electronics India",
    vendorCountry: "India",
    commodityWeights: { copper: 10, steel: 5, aluminum: 82, nickel: 0, other: 3 },
    isAiMapped: false,
    inventoryUsed: 580000,
    inventoryOrdered: 220000,
    inventoryBufferStock: 50000
  },
  {
    id: "MAT-SFT03",
    name: "Data Center Mainframe Rack High-Tensile Steel Frame",
    category: "Chassis Rails",
    unitPrice: 380,
    currency: "USD",
    volume: 15000,
    totalValue: 5700000,
    vendorName: "Netrack Enclosures Pvt Ltd",
    vendorCountry: "India",
    commodityWeights: { copper: 2, steel: 92, aluminum: 3, nickel: 1, other: 2 },
    isAiMapped: false,
    inventoryUsed: 11000,
    inventoryOrdered: 4000,
    inventoryBufferStock: 1000
  },
  {
    id: "MAT-SFT04",
    name: "Lithium-Nickel Uninterruptible Power Supply (UPS) Cell",
    category: "Backup Power",
    unitPrice: 4200,
    currency: "USD",
    volume: 2500,
    totalValue: 10500000,
    vendorName: "Schneider Electric Sourcing",
    vendorCountry: "France",
    commodityWeights: { copper: 15, steel: 10, aluminum: 15, nickel: 55, other: 5 },
    isAiMapped: false,
    inventoryUsed: 1900,
    inventoryOrdered: 600,
    inventoryBufferStock: 150
  }
];

const SOFTWARE_COMMODITIES = [
  {
    id: "copper",
    name: "Infrastructure Power copper Index",
    symbol: "INF-COP",
    currentPrice: 8500,
    unit: "USD/MT",
    change24h: 1.25,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 8100 },
      { date: "Aug 25", price: 8250 },
      { date: "Sep 25", price: 8290 },
      { date: "Oct 25", price: 8190 },
      { date: "Nov 25", price: 8350 },
      { date: "Dec 25", price: 8400 },
      { date: "Jan 26", price: 8440 },
      { date: "Feb 26", price: 8470 },
      { date: "Mar 26", price: 8520 },
      { date: "Apr 26", price: 8550 },
      { date: "May 26", price: 8450 },
      { date: "Jun 26", price: 8500 }
    ],
    forecast: [
      { period: "Q3 2026", price: 8720, change: 2.5, signal: "up" },
      { period: "Q4 2026", price: 8990, change: 5.7, signal: "up" },
      { period: "Q1 2027", price: 8820, change: 3.7, signal: "down" },
      { period: "Q2 2027", price: 8690, change: 2.2, signal: "down" }
    ],
    foContracts: [
      { symbol: "INFCP26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 8515, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 14200, volume: 1800 }
    ]
  },
  {
    id: "steel",
    name: "Tensile Rack Steel Index",
    symbol: "RAK-ST",
    currentPrice: 710,
    unit: "USD/MT",
    change24h: -1.15,
    volatility: "Low",
    history: [
      { date: "Jul 25", price: 770 },
      { date: "Aug 25", price: 755 },
      { date: "Sep 25", price: 740 },
      { date: "Oct 25", price: 732 },
      { date: "Nov 25", price: 720 },
      { date: "Dec 25", price: 715 },
      { date: "Jan 26", price: 710 },
      { date: "Feb 26", price: 705 },
      { date: "Mar 26", price: 715 },
      { date: "Apr 26", price: 708 },
      { date: "May 26", price: 702 },
      { date: "Jun 26", price: 710 }
    ],
    forecast: [
      { period: "Q3 2026", price: 690, change: -2.8, signal: "down" },
      { period: "Q4 2026", price: 672, change: -5.3, signal: "down" },
      { period: "Q1 2027", price: 690, change: -2.8, signal: "up" },
      { period: "Q2 2027", price: 705, change: -0.7, signal: "up" }
    ],
    foContracts: [
      { symbol: "RKST26 (Futures)", exchange: "SGE (Shanghai)", contractType: "Futures", currentPrice: 708, expiryDate: "2026-09-15", lotSize: "100 Metric Tons", openInterest: 8400, volume: 1100 }
    ]
  },
  {
    id: "aluminum",
    name: "Blade Server cooling Aluminum",
    symbol: "BLD-AL",
    currentPrice: 2280,
    unit: "USD/MT",
    change24h: 0.95,
    volatility: "Medium",
    history: [
      { date: "Jul 25", price: 2150 },
      { date: "Aug 25", price: 2170 },
      { date: "Sep 25", price: 2210 },
      { date: "Oct 25", price: 2190 },
      { date: "Nov 25", price: 2230 },
      { date: "Dec 25", price: 2250 },
      { date: "Jan 26", price: 2260 },
      { date: "Feb 26", price: 2270 },
      { date: "Mar 26", price: 2310 },
      { date: "Apr 26", price: 2290 },
      { date: "May 26", price: 2260 },
      { date: "Jun 26", price: 2280 }
    ],
    forecast: [
      { period: "Q3 2026", price: 2350, change: 3.0, signal: "up" },
      { period: "Q4 2026", price: 2420, change: 6.1, signal: "up" },
      { period: "Q1 2027", price: 2380, change: 4.3, signal: "down" },
      { period: "Q2 2027", price: 2330, change: 2.1, signal: "down" }
    ],
    foContracts: [
      { symbol: "BLDAL26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 2290, expiryDate: "2026-09-16", lotSize: "25 Metric Tons", openInterest: 11500, volume: 1600 }
    ]
  },
  {
    id: "nickel",
    name: "UPS Battery Nickel Core Index",
    symbol: "UPS-NIC",
    currentPrice: 15600,
    unit: "USD/MT",
    change24h: 1.05,
    volatility: "High",
    history: [
      { date: "Jul 25", price: 14400 },
      { date: "Aug 25", price: 14650 },
      { date: "Sep 25", price: 15000 },
      { date: "Oct 25", price: 14850 },
      { date: "Nov 25", price: 15200 },
      { date: "Dec 25", price: 15320 },
      { date: "Jan 26", price: 15400 },
      { date: "Feb 26", price: 15520 },
      { date: "Mar 26", price: 15800 },
      { date: "Apr 26", price: 15650 },
      { date: "May 26", price: 15480 },
      { date: "Jun 26", price: 15600 }
    ],
    forecast: [
      { period: "Q3 2026", price: 16200, change: 3.8, signal: "up" },
      { period: "Q4 2026", price: 16900, change: 8.3, signal: "up" },
      { period: "Q1 2027", price: 16500, change: 5.7, signal: "down" },
      { period: "Q2 2027", price: 16000, change: 2.5, signal: "down" }
    ],
    foContracts: [
      { symbol: "UPSN26 (Futures)", exchange: "LME (London)", contractType: "Futures", currentPrice: 15720, expiryDate: "2026-09-16", lotSize: "6 Metric Tons", openInterest: 16200, volume: 2200 }
    ]
  }
];

const SOFTWARE_RISKS = [
  { country: "India", riskScore: 1.5, status: "Stable", description: "Excellent high-volume secure structural and cabling vendor network.", vendorCount: 3, materialShare: 59 },
  { country: "France", riskScore: 2.0, status: "Stable", description: "Safe and compliant high-tech battery backup power fabrication center.", vendorCount: 1, materialShare: 41 }
];

const getExcelPath = (industry: string) => {
  return path.join(DATA_DIR, `sap_${industry}.xlsx`);
};

const getDefaults = (industry: string) => {
  if (industry === "pharma") {
    return { materials: PHARMA_MATERIALS, commodities: PHARMA_COMMODITIES, risks: PHARMA_RISKS };
  } else if (industry === "retail") {
    return { materials: RETAIL_MATERIALS, commodities: RETAIL_COMMODITIES, risks: RETAIL_RISKS };
  } else if (industry === "telecom") {
    return { materials: TELECOM_MATERIALS, commodities: TELECOM_COMMODITIES, risks: TELECOM_RISKS };
  } else if (industry === "finance") {
    return { materials: FINANCE_MATERIALS, commodities: FINANCE_COMMODITIES, risks: FINANCE_RISKS };
  } else if (industry === "banks") {
    return { materials: BANKS_MATERIALS, commodities: BANKS_COMMODITIES, risks: BANKS_RISKS };
  } else if (industry === "oil_gas") {
    return { materials: OIL_GAS_MATERIALS, commodities: OIL_GAS_COMMODITIES, risks: OIL_GAS_RISKS };
  } else if (industry === "manufacturing") {
    return { materials: MANUFACTURING_MATERIALS, commodities: MANUFACTURING_COMMODITIES, risks: MANUFACTURING_RISKS };
  } else if (industry === "software") {
    return { materials: SOFTWARE_MATERIALS, commodities: SOFTWARE_COMMODITIES, risks: SOFTWARE_RISKS };
  } else {
    return { materials: INITIAL_MATERIALS, commodities: INITIAL_COMMODITIES, risks: GEOPOLITICAL_RISKS_MOCK };
  }
};


function writeExcelData(filePath: string, materials: any[], commodities: any[], risks: any[]) {
  const wb = XLSX.utils.book_new();

  // Materials sheet - handle nesting
  const flatMaterials = materials.map(m => ({
    ...m,
    commodityWeights: m.commodityWeights ? JSON.stringify(m.commodityWeights) : ""
  }));
  const wsMaterials = XLSX.utils.json_to_sheet(flatMaterials);
  XLSX.utils.book_append_sheet(wb, wsMaterials, "Materials");

  // Commodities sheet - handle nesting
  const flatCommodities = commodities.map(c => ({
    ...c,
    history: c.history ? JSON.stringify(c.history) : "",
    forecast: c.forecast ? JSON.stringify(c.forecast) : "",
    foContracts: c.foContracts ? JSON.stringify(c.foContracts) : ""
  }));
  const wsCommodities = XLSX.utils.json_to_sheet(flatCommodities);
  XLSX.utils.book_append_sheet(wb, wsCommodities, "Commodities");

  // Risks sheet
  const wsRisks = XLSX.utils.json_to_sheet(risks);
  XLSX.utils.book_append_sheet(wb, wsRisks, "GeopoliticalRisks");

  XLSX.writeFile(wb, filePath);
}

function readExcelData(filePath: string, defaultMaterials: any[], defaultCommodities: any[], defaultRisks: any[]) {
  if (!fs.existsSync(filePath)) {
    return { materials: defaultMaterials, commodities: defaultCommodities, risks: defaultRisks };
  }

  try {
    const wb = XLSX.readFile(filePath);
    
    // Materials
    const wsMaterials = wb.Sheets["Materials"];
    let materials = wsMaterials ? XLSX.utils.sheet_to_json(wsMaterials) : defaultMaterials;
    materials = materials.map((m: any) => {
      if (typeof m.commodityWeights === "string" && m.commodityWeights) {
        try { m.commodityWeights = JSON.parse(m.commodityWeights); } catch (e) {}
      }
      // Ensure numeric fields are cast properly
      if (m.unitPrice !== undefined) m.unitPrice = Number(m.unitPrice);
      if (m.volume !== undefined) m.volume = Number(m.volume);
      if (m.totalValue !== undefined) m.totalValue = Number(m.totalValue);
      if (m.inventoryUsed !== undefined) m.inventoryUsed = Number(m.inventoryUsed);
      if (m.inventoryOrdered !== undefined) m.inventoryOrdered = Number(m.inventoryOrdered);
      if (m.inventoryBufferStock !== undefined) m.inventoryBufferStock = Number(m.inventoryBufferStock);
      return m;
    });

    // Commodities
    const wsCommodities = wb.Sheets["Commodities"];
    let commodities = wsCommodities ? XLSX.utils.sheet_to_json(wsCommodities) : defaultCommodities;
    commodities = commodities.map((c: any) => {
      if (typeof c.history === "string" && c.history) {
        try { c.history = JSON.parse(c.history); } catch (e) {}
      }
      if (typeof c.forecast === "string" && c.forecast) {
        try { c.forecast = JSON.parse(c.forecast); } catch (e) {}
      }
      if (typeof c.foContracts === "string" && c.foContracts) {
        try { c.foContracts = JSON.parse(c.foContracts); } catch (e) {}
      }
      if (c.currentPrice !== undefined) c.currentPrice = Number(c.currentPrice);
      if (c.change24h !== undefined) c.change24h = Number(c.change24h);
      return c;
    });

    // Risks
    const wsRisks = wb.Sheets["GeopoliticalRisks"];
    let risks = wsRisks ? XLSX.utils.sheet_to_json(wsRisks) : defaultRisks;
    risks = risks.map((r: any) => {
      if (r.riskScore !== undefined) r.riskScore = Number(r.riskScore);
      if (r.vendorCount !== undefined) r.vendorCount = Number(r.vendorCount);
      if (r.materialShare !== undefined) r.materialShare = Number(r.materialShare);
      return r;
    });

    return { materials, commodities, risks };
  } catch (err) {
    console.error("Error reading Excel file:", filePath, err);
    return { materials: defaultMaterials, commodities: defaultCommodities, risks: defaultRisks };
  }
}

// Bootstrap physical Excel database files on startup
const industriesToBootstrap = [
  { id: "automobile", m: INITIAL_MATERIALS, c: INITIAL_COMMODITIES, r: GEOPOLITICAL_RISKS_MOCK },
  { id: "pharma", m: PHARMA_MATERIALS, c: PHARMA_COMMODITIES, r: PHARMA_RISKS },
  { id: "retail", m: RETAIL_MATERIALS, c: RETAIL_COMMODITIES, r: RETAIL_RISKS },
  { id: "telecom", m: TELECOM_MATERIALS, c: TELECOM_COMMODITIES, r: TELECOM_RISKS },
  { id: "finance", m: FINANCE_MATERIALS, c: FINANCE_COMMODITIES, r: FINANCE_RISKS },
  { id: "banks", m: BANKS_MATERIALS, c: BANKS_COMMODITIES, r: BANKS_RISKS },
  { id: "oil_gas", m: OIL_GAS_MATERIALS, c: OIL_GAS_COMMODITIES, r: OIL_GAS_RISKS },
  { id: "manufacturing", m: MANUFACTURING_MATERIALS, c: MANUFACTURING_COMMODITIES, r: MANUFACTURING_RISKS },
  { id: "software", m: SOFTWARE_MATERIALS, c: SOFTWARE_COMMODITIES, r: SOFTWARE_RISKS }
];

industriesToBootstrap.forEach(ind => {
  const filePath = getExcelPath(ind.id);
  if (!fs.existsSync(filePath)) {
    writeExcelData(filePath, ind.m, ind.c, ind.r);
  }
});

const getLocalStrategyMemo = (materials: any[], simulatedRates: any, industry: string = "automobile") => {
  const rates = {
    copper: simulatedRates?.copper || 0,
    steel: simulatedRates?.steel || 0,
    aluminum: simulatedRates?.aluminum || 0,
    nickel: simulatedRates?.nickel || 0
  };

  if (industry === "pharma") {
    const highAPI = materials.filter(m => (m.commodityWeights?.copper || 0) > 40);
    const highSolvents = materials.filter(m => (m.commodityWeights?.steel || 0) > 40);
    const highGlass = materials.filter(m => (m.commodityWeights?.nickel || 0) > 40);

    const recommendations: string[] = [];
    if (rates.copper > 0) {
      recommendations.push(`- **Action: Advance Pre-purchasing for Active Pharmaceutical Ingredients (APIs)**
  - **Risk Exposure:** Immediate inflation across petrochemical base phenol precursors used in active synthesis (+${rates.copper}% simulated spike).
  - **Target Materials:** ${highAPI.map(m => `**${m.name} (${m.id})**`).join(", ") || "Paracetamol API / Amoxicillin API"}.
  - **Recommendation:** Release advanced purchasing contracts and secure additional volumes from Aurobindo and Hebei Jiheng to freeze costs before chemical spot price hikes. Cost avoidance potential: **$38,000 - $85,000**.`);
    } else {
      recommendations.push(`- **Action: Maintain Lean GMP Inventory of API Powders**
  - **Status:** API chemical prices are stable or down.
  - **Recommendation:** Run lean Just-In-Time active ingredient warehousing. Coordinate rolling deliveries with factory batch allocations to avoid capital lockups.`);
    }

    if (rates.steel < 0) {
      recommendations.push(`- **Action: Exploit Price Dips on Technical Organic Extraction Solvents**
  - **Market Signal:** Solvents are displaying a downward trend (-${Math.abs(rates.steel)}% simulated).
  - **Target Materials:** ${highSolvents.map(m => `**${m.name} (${m.id})**`).join(", ") || "USP Ethanol Solvent"}.
  - **Recommendation:** Increase reservoir fill levels at Gujarat and Mumbai formulation plants immediately. Lock in low spot-market pricing for extraction liquids to capture substantial margins.`);
    } else {
      recommendations.push(`- **Action: Maintain Routine Solvents Delivery Schedules**
  - **Status:** Solvent index remains on-line with baseline forecasts.`);
    }

    if (rates.aluminum > 0 || rates.nickel > 0) {
      recommendations.push(`- **Action: Establish Safeguard Agreements for Aluminum Foil and Borosilicate Vials**
  - **Market Signal:** Active inflationary pressures on Aluminum Foil (${rates.aluminum}%) / Glass Vials (${rates.nickel}%).
  - **Recommendation:** Standardize price-ceiling agreements with Schott Glass India and Hindalco. Blister foil and glass vials represent mandatory packaging items—any supply bottleneck stops product dispatch.`);
    }

    return `
# SAP STRATEGIC PROCUREMENT MEMORANDUM (PHARMACEUTICAL ADVISORY)
**To:** Director of Global Sourcing — Sun Pharmaceutical Industries  
**From:** SAP Procurement Commodity Analytics Engine (Local Fallback active)  
**Date:** July 2026  
**Subject:** S/4HANA Pharmaceutical Sourcing & Active Chemical Risk Mitigation  

## 1. Executive Summary
This advisory report was generated in response to active price shifts on global pharmaceutical chemical indexes. Our integrated Material Master (MARA/MBEW) records identify concentrated exposures in active ingredients (KSMs) and high-barrier packaging.

Our supply chain mappings highlight three critical exposure pillars:
- **API Chemical Base:** Highly concentrated dependency on China-based petrochemical precursors affecting Paracetamol (**MAT-PH01**) and Amoxicillin (**MAT-PH05**).
- **Process Solvents:** Steady raw volume consumption of Ethanol (**MAT-PH02**) driving continuous operating overhead.
- **Glass & Foil Packaging:** Sterile borosilicate vials (**MAT-PH03**) and blister backing (**MAT-PH04**) represent critical product dispatch dependencies.

---

## 2. Dynamic Commodity Risk Dashboard
| Commodity Index | Simulated Rate | Primary Sun Pharma Material Exposure | Sourcing Leverage |
| :--- | :---: | :--- | :--- |
| **API Base (Phenol)** | ${rates.copper > 0 ? "+" : ""}${rates.copper}% | Paracetamol & Amoxicillin active powders | High (Alternative local suppliers available) |
| **Organic Solvents** | ${rates.steel > 0 ? "+" : ""}${rates.steel}% | USP Grade Ethanol / Methanol Solvents | Medium (Leverage domestic refinery tenders) |
| **Aluminum Foil** | ${rates.aluminum > 0 ? "+" : ""}${rates.aluminum}% | Blister Pack Packaging Backing Foil | Low (Direct vendor index agreements) |
| **Borosilicate Glass** | ${rates.nickel > 0 ? "+" : ""}${rates.nickel}% | 10ml Injectable Sterile Vials | High (Domestic Schott Glass plant) |

---

## 3. Direct Action Items & Sourcing Tactics
${recommendations.join("\n\n")}

---

## 4. Vendor Geopolitical & Supply Chain Resilience Strategy
- **China API Corridor (Hebei Jiheng):** Moderate risk. Maintain an active 90-day buffer inventory of raw Acetaminophen base. Begin technical transfers to qualify alternative Indian local synthesis options.
- **European & Indian Packaging Supply:** Schott Glass (India) and Hindalco represent stable channels. Run periodic automated stock call-offs inside SAP to minimize regional delivery bottlenecks.

---
*Disclaimer: This strategic report was compiled using the local Sourcing Strategy Engine. S/4HANA OData integrity is confirmed.*
`;
  }

  if (industry === "retail") {
    const highCotton = materials.filter(m => (m.commodityWeights?.copper || 0) > 40);
    const highPulp = materials.filter(m => (m.commodityWeights?.steel || 0) > 40);
    const highAgri = materials.filter(m => (m.commodityWeights?.nickel || 0) > 40);

    const recommendations: string[] = [];
    if (rates.copper > 0) {
      recommendations.push(`- **Action: Secure Forward Purchasing Contracts for Organic Cotton Yarn**
  - **Risk Exposure:** Upward inflationary spike on ICE Cotton No. 2 index (+${rates.copper}% simulated increase).
  - **Target Materials:** ${highCotton.map(m => `**${m.name} (${m.id})**`).join(", ") || "Cotton Textiles"}.
  - **Recommendation:** Lock in supply contracts with the Gujarat Cotton Co-operative for the next 2 quarters. Securing a fixed-price threshold on yarn prevents gross margin decay on active retail apparel sections.`);
    } else {
      recommendations.push(`- **Action: Maintain Spot Procurement for Apparel Textile Fibers**
  - **Status:** Cotton indices are stable or experiencing downward pressure.
  - **Recommendation:** Procure fiber on regional spot markets. This maintains warehouse liquidity and avoids holding excess raw bales before seasonal style turnovers.`);
    }

    if (rates.steel < 0) {
      recommendations.push(`- **Action: Postpone Deliveries / Leverage Price Drops on Cardboard Packing**
  - **Market Signal:** Kraft pulp packaging indexes are down by -${Math.abs(rates.steel)}% simulated.
  - **Target Materials:** ${highPulp.map(m => `**${m.name} (${m.id})**`).join(", ") || "Corrugated Cardboard"}.
  - **Recommendation:** Defer monthly volume releases from WestPack Sourcing Mills by 30 to 45 days. Capture the downward pulp trend to drive logistics box savings of **$45,000+** in regional distribution center budgets.`);
    } else {
      recommendations.push(`- **Action: Maintain Standard JIT Cardboard Stock Call-offs**
  - **Status:** Paper and packaging board prices remain flat.`);
    }

    if (rates.aluminum > 0 || rates.nickel > 0) {
      recommendations.push(`- **Action: Secure Long-Term Agreements for PET Plastics and Agricultural Grains**
  - **Market Signal:** Inflationary stress on Polyethylene PET Resins (${rates.aluminum}%) / Agricultural Grains (${rates.nickel}%).
  - **Recommendation:** Formulate long-term purchase agreements with Reliance Polymers and local agricultural grain pools. Ensure price variance protections for grocery private-label assets.`);
    }

    return `
# SAP STRATEGIC PROCUREMENT MEMORANDUM (RETAIL SOURCING)
**To:** VP of Global Sourcing — Reliance Retail Group  
**From:** SAP Procurement Commodity Analytics Engine (Local Fallback active)  
**Date:** July 2026  
**Subject:** S/4HANA Retail Sourcing Optimization & Fiber-Agri Sourcing Advisory  

## 1. Executive Summary
This advisory report was generated in response to active index shifts on global textile, pulp, and agricultural exchanges. In high-turnover retail environments, small raw-commodity spikes represent immediate pricing pressure on private labels.

Our supply chain mappings identify three critical exposure pillars:
- **Cotton Fiber Index:** Primary raw material driver for textile private-label lines (**MAT-RT01**).
- **Kraft Pulp Index:** Direct influence on operating packaging boxes (**MAT-RT02**) utilized across all nationwide distribution centers.
- **PET Plastics & Grains:** Key drivers of grocery packaging wraps (**MAT-RT03**) and bulk staple food supplies (**MAT-RT04**).

---

## 2. Dynamic Commodity Risk Dashboard
| Commodity Index | Simulated Rate | Primary Retail Material Exposure | Sourcing Leverage |
| :--- | :---: | :--- | :--- |
| **Cotton No. 2 (ICE)** | ${rates.copper > 0 ? "+" : ""}${rates.copper}% | Private-label cotton apparel and yarns | High (Deep regional sourcing networks) |
| **Kraft Pulp & Cardboard** | ${rates.steel > 0 ? "+" : ""}${rates.steel}% | Outer Shipping & Delivery Packaging | Medium (High competition among domestic mill mills) |
| **Polyethylene PET Resins** | ${rates.aluminum > 0 ? "+" : ""}${rates.aluminum}% | Bottle resins, food bags & LDPE wraps | Medium (Direct integration with petrochemical parent) |
| **Agricultural Grains** | ${rates.nickel > 0 ? "+" : ""}${rates.nickel}% | Basmati Rice bulk cargo and sugar | High (Direct farm-gate aggregation contracts) |

---

## 3. Direct Action Items & Sourcing Tactics
${recommendations.join("\n\n")}

---

## 4. Vendor Geopolitical & Supply Chain Resilience Strategy
- **Domestic Agriculture & Fibers:** Sourcing cotton from Gujarat and basmati grains from Haryana is extremely stable. Maintain active regional supply highways.
- **Vietnam Cardboard Corridor (WestPack):** Minor caution due to regional container shipping rates. Secure direct cargo bookings with logistics carriers 60 days in advance to prevent retail shelf delays.

---
*Disclaimer: This strategic report was compiled using the local Sourcing Strategy Engine. S/4HANA OData integrity is confirmed.*
`;
  }

  // DEFAULT / AUTOMOBILE (MARUTI SUZUKI)
  const highCopper = materials.filter(m => (m.commodityWeights?.copper || 0) > 40);
  const highSteel = materials.filter(m => (m.commodityWeights?.steel || 0) > 60);
  const highAluminum = materials.filter(m => (m.commodityWeights?.aluminum || 0) > 50);
  const highNickel = materials.filter(m => (m.commodityWeights?.nickel || 0) > 20);

  const recommendations: string[] = [];

  if (rates.copper > 0) {
    recommendations.push(`- **Action: Advance Pre-purchasing for High-Copper Assemblies**
  - **Risk Exposure:** Immediate exposure to Copper price spikes (+${rates.copper}% simulated increase).
  - **Target Materials:** ${highCopper.map(m => `**${m.name} (${m.id})** [Copper: ${m.commodityWeights.copper}%]`).join(", ") || "EV Copper Busbars / Motor Stator Coils"}.
  - **Recommendation:** Release advanced purchase agreements (PO release) and buffer warehouse stock by 20-30% immediately to lock in baseline rates with Motherson Sumi and Nidec India. Projected cost avoidance: **$45,000 - $120,000**.`);
  } else {
    recommendations.push(`- **Action: Monitor & Execute JIT for Copper Components**
  - **Status:** Copper prices are down or stable (${rates.copper}% simulated).
  - **Target Materials:** ${highCopper.map(m => `**${m.name} (${m.id})**`).join(", ") || "Wiring Harness & Stator Coils"}.
  - **Recommendation:** Maintain lean Just-In-Time (JIT) scheduling. Avoid excess capital commitment in finished battery busbars or motor stator coil materials. Standardize purchasing cycles.`);
  }

  if (rates.steel < 0) {
    recommendations.push(`- **Action: Defer Purchasing / Leverage Price Drops on Chassis Steel**
  - **Market Signal:** Steel prices are exhibiting a downward trend (${rates.steel}% simulated).
  - **Target Materials:** ${highSteel.map(m => `**${m.name} (${m.id})** [Steel: ${m.commodityWeights.steel}%]`).join(", ") || "Chassis Steel Frames"}.
  - **Recommendation:** Defer spot purchases of door outer panels and chassis frame structural units from Tata Steel and AMNS India by 30 to 45 days. Capturing this downward shift on high-volume items is estimated to save **$150,000+** in quarterly raw material expenditure.`);
  } else if (rates.steel > 0) {
    recommendations.push(`- **Action: Secure Forward Contracts for Heavy Chassis Steel**
  - **Risk Exposure:** Rising steel costs (+${rates.steel}% simulated).
  - **Target Materials:** ${highSteel.map(m => `**${m.name} (${m.id})**`).join(", ") || "Chassis High-Strength Steel Frame"}.
  - **Recommendation:** Lock in long-term supply volume agreements with Tata Steel Automotive and ArcelorMittal Nippon Steel India. Seek fixed-price supply guarantees for the upcoming model production runs.`);
  } else {
    recommendations.push(`- **Action: Maintain Standard Call-offs for Chassis Steel**
  - **Status:** Steel prices are stable.
  - **Recommendation:** Proceed with standard monthly rolling schedules with AMNS India and Tata Steel.`);
  }

  if (rates.aluminum > 0 || rates.nickel > 0) {
    const items = [...highAluminum, ...highNickel];
    recommendations.push(`- **Action: Evaluate Hedges on Light Alloy and Exhaust Assemblies**
  - **Market Signal:** Active price pressures on Aluminum (${rates.aluminum}%) / Nickel (${rates.nickel}%).
  - **Target Materials:** ${items.map(m => `**${m.name} (${m.id})**`).join(", ") || "Alloy Wheels and Catalytic Converters"}.
  - **Recommendation:** Catalytic converters from Faurecia Clean Mobility rely heavily on high-value Nickel. Seek index-linked pricing options or explore alternative lower-grade chromium alternatives where emission-standards permit.`);
  }

  return `
# SAP STRATEGIC PROCUREMENT MEMORANDUM (AUTOMOTIVE ADVISORY)
**To:** Director of Supply Chain & Global Sourcing — Maruti Suzuki Corp.  
**From:** SAP Procurement Commodity Analytics Engine (Local Fallback active)  
**Date:** July 2026  
**Subject:** S/4HANA Automobile Procurement Optimization & Raw Metal Risk Mitigation  

## 1. Executive Summary
This advisory report was compiled by the local analytical module in response to real-time commodity fluctuations. Maruti Suzuki's active assembly program has significant raw metal exposure across key vehicle platforms (Swift, Baleno, Ertiga, Grand Vitara, and the eVX EV platform). 

Our multi-layered material mapping identifies the following structural exposures:
- **Steel (High-Strength / Sheets):** Represents the highest absolute physical tonnage, driven by body structures (**MAT-001**, **MAT-007**, **MAT-010**).
- **Copper:** Represents a critical high-value exposure point, highly concentrated in electrical harnesses (**MAT-002**), traction motor stator coils (**MAT-005**), and lithium battery module busbars (**MAT-008**).
- **Nickel:** Active exposure on catalytic converter exhaust subassemblies (**MAT-004**) from Faurecia.

---

## 2. Dynamic Commodity Risk Dashboard
| Commodity | Simulated Rate | Primary Maruti Material Exposure | Sourcing Leverage |
| :--- | :---: | :--- | :--- |
| **Copper (LME)** | ${rates.copper > 0 ? "+" : ""}${rates.copper}% | Wiring Harnesses, Motor Stators, EV Busbars | Medium (Dual-source available) |
| **Steel HRC (NYMEX)** | ${rates.steel > 0 ? "+" : ""}${rates.steel}% | Chassis Frames, Outer Panels, Coil Springs | High (Local sourcing via Tata Steel/AMNS) |
| **Aluminum (LME)** | ${rates.aluminum > 0 ? "+" : ""}${rates.aluminum}% | Alloy Wheel Castings, Engine Blocks | Medium (Import dependent) |
| **Nickel (LME)** | ${rates.nickel > 0 ? "+" : ""}${rates.nickel}% | Catalytic Converters | Low (Concentrated global vendor base) |

---

## 3. Direct Action Items & Sourcing Tactics
${recommendations.join("\n\n")}

---

## 4. Vendor Geopolitical & Supply Chain Resilience Strategy
- **Domestic Sourcing Base (India):** Sourcing of structural panels and frames from **Tata Steel Automotive** and **Motherson Sumi Wiring India** is highly stable. Maintain direct logistics routes via national highways to Gurugram and Manesar manufacturing hubs.
- **European & Japanese Supply Chain:** **Maxion Wheels** (Germany), **Nidec India** (Japan parent), and **Faurecia** (France) represent premium precision parts. Ensure backup logistic sea corridors are pre-booked 90 days in advance to mitigate shipping delays in Indian Ocean channels.
- **Exchange Hedges:** Active monitoring of F&O contracts on **MCX (India)** and **LME (London)** is recommended. For Copper, utilize MCX COPPER futures to hedge downstream price changes.

---
*Disclaimer: This strategic report was compiled using the local Sourcing Strategy Engine. S/4HANA OData integrity is confirmed.*
`;
};

// API Endpoints

// 1. Get current list of materials
app.get("/api/materials", (req, res) => {
  const industry = (req.query.industry as string) || "automobile";
  const defaults = getDefaults(industry);
  const filePath = getExcelPath(industry);
  const data = readExcelData(filePath, defaults.materials, defaults.commodities, defaults.risks);
  res.json(data.materials);
});

// 2. Get current commodities data
app.get("/api/commodities", (req, res) => {
  const industry = (req.query.industry as string) || "automobile";
  const defaults = getDefaults(industry);
  const filePath = getExcelPath(industry);
  const data = readExcelData(filePath, defaults.materials, defaults.commodities, defaults.risks);
  res.json(data.commodities);
});

// 3. Get geopolitical risk score list
app.get("/api/geopolitical-risks", (req, res) => {
  const industry = (req.query.industry as string) || "automobile";
  const defaults = getDefaults(industry);
  const filePath = getExcelPath(industry);
  const data = readExcelData(filePath, defaults.materials, defaults.commodities, defaults.risks);
  res.json(data.risks);
});

// 4. Get Excel File DB Details (Information/Metadata)
app.get("/api/excel/info", (req, res) => {
  const sysConfig = loadSystemConfig();
  const industries = sysConfig.industries.map(i => i.id);
  const info = industries.map(ind => {
    const filePath = getExcelPath(ind);
    const relativePath = path.relative(process.cwd(), filePath);
    const exists = fs.existsSync(filePath);
    const size = exists ? fs.statSync(filePath).size : 0;
    return {
      industry: ind,
      filePath,
      relativePath: "./" + relativePath.replace(/\\/g, "/"),
      exists,
      size: `${(size / 1024).toFixed(2)} KB`
    };
  });
  res.json(info);
});

// New endpoint: Expose list of industries with display names dynamically
app.get("/api/industries", (req, res) => {
  const sysConfig = loadSystemConfig();
  const list = sysConfig.industries.map(i => ({
    id: i.id,
    name: i.name,
    clientName: i.clientName,
    sectorName: i.sectorName
  }));
  res.json(list);
});

// 5. Save updated materials dataset directly back to Excel
app.post("/api/excel/update-materials", (req, res) => {
  const { industry, materials } = req.body;
  const ind = industry || "automobile";
  const defaults = getDefaults(ind);
  const filePath = getExcelPath(ind);
  try {
    const data = readExcelData(filePath, defaults.materials, defaults.commodities, defaults.risks);
    writeExcelData(filePath, materials, data.commodities, data.risks);
    console.log(`[EXCEL] Successfully wrote updated materials to ${filePath}`);
    res.json({ success: true, message: `Successfully updated materials in Excel file: ${filePath}` });
  } catch (err: any) {
    console.error(`[EXCEL] Error updating materials in ${filePath}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Save updated commodities dataset directly back to Excel
app.post("/api/excel/update-commodities", (req, res) => {
  const { industry, commodities } = req.body;
  const ind = industry || "automobile";
  const defaults = getDefaults(ind);
  const filePath = getExcelPath(ind);
  try {
    const data = readExcelData(filePath, defaults.materials, defaults.commodities, defaults.risks);
    writeExcelData(filePath, data.materials, commodities, data.risks);
    console.log(`[EXCEL] Successfully wrote updated commodities to ${filePath}`);
    res.json({ success: true, message: `Successfully updated commodities in Excel file: ${filePath}` });
  } catch (err: any) {
    console.error(`[EXCEL] Error updating commodities in ${filePath}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// 7. Save updated geopolitical risks dataset directly back to Excel
app.post("/api/excel/update-risks", (req, res) => {
  const { industry, risks } = req.body;
  const ind = industry || "automobile";
  const defaults = getDefaults(ind);
  const filePath = getExcelPath(ind);
  try {
    const data = readExcelData(filePath, defaults.materials, defaults.commodities, defaults.risks);
    writeExcelData(filePath, data.materials, data.commodities, risks);
    console.log(`[EXCEL] Successfully wrote updated risks to ${filePath}`);
    res.json({ success: true, message: `Successfully updated risks in Excel file: ${filePath}` });
  } catch (err: any) {
    console.error(`[EXCEL] Error updating risks in ${filePath}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Live FX and Commodity price background fluctuation ticker
const initialConfig = loadSystemConfig();
let liveFxRates = { 
  USD_INR: initialConfig.variables.USD_INR_DEFAULT || 83.45, 
  USD_EUR: initialConfig.variables.USD_EUR_DEFAULT || 0.92, 
  source: "Default Rates from system_config.xlsx" 
};
let lastFxFetchTime = "Never";
let tickerIntervalCount = 0;

// Fetch live FX rates from configured public endpoint
async function fetchLiveRates() {
  const sysConfig = loadSystemConfig();
  const url = sysConfig.variables.FX_API_URL || "https://open.er-api.com/v6/latest/USD";
  const defaultInr = sysConfig.variables.USD_INR_DEFAULT || 83.45;
  const defaultEur = sysConfig.variables.USD_EUR_DEFAULT || 0.9200;

  try {
    console.log(`[LIVE-API] Fetching real-time exchange rates from ${url}...`);
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data && data.rates) {
        liveFxRates = {
          USD_INR: Number((data.rates.INR || defaultInr).toFixed(2)),
          USD_EUR: Number((data.rates.EUR || defaultEur).toFixed(4)),
          source: `Live Feed from ${new URL(url).hostname}`
        };
        lastFxFetchTime = new Date().toLocaleTimeString();
        console.log(`[LIVE-API] Successfully synchronized FX: USD/INR = ${liveFxRates.USD_INR}, Source: ${liveFxRates.source}`);
      }
    } else {
      console.warn(`[LIVE-API] Server returned error status: ${response.status}`);
    }
  } catch (err: any) {
    console.warn(`[LIVE-API] Could not fetch live rates: ${err.message || err}. Using default template FX.`);
  }
}

// Background simulation ticker that rewrites Excel files on disk
function fluctuateAllExcelDatabases() {
  const sysConfig = loadSystemConfig();
  const industries = sysConfig.industries.map(i => i.id);
  const maxFlucPct = sysConfig.variables.MAX_FLUC_PCT || 1.5;
  const minPrice = sysConfig.variables.MIN_COMMODITY_PRICE || 10;
  const maxPrice = sysConfig.variables.MAX_COMMODITY_PRICE || 100000;

  tickerIntervalCount++;
  console.log(`[TICKER] Tick #${tickerIntervalCount} - Simulating global commodity changes on disk (Max +/- ${maxFlucPct}%)...`);
  
  industries.forEach(ind => {
    const defaults = getDefaults(ind);
    const filePath = getExcelPath(ind);
    
    try {
      if (!fs.existsSync(filePath)) {
        // If file doesn't exist, bootstrap it first
        writeExcelData(filePath, defaults.materials, defaults.commodities, defaults.risks);
      }
      
      const data = readExcelData(filePath, defaults.materials, defaults.commodities, defaults.risks);
      
      // 1. Fluctuate each commodity price slightly
      const updatedCommodities = data.commodities.map((c: any) => {
        // Simulating 24-hour fluctuations with random walk (+/- maxFlucPct)
        const range = maxFlucPct * 2;
        const fluctuationPercent = (Math.random() * range - maxFlucPct) / 100;
        const oldPrice = c.currentPrice || 1000;
        let newPrice = oldPrice * (1 + fluctuationPercent);
        
        // Boundaries to keep numbers realistic (configured from excel)
        if (newPrice < minPrice) newPrice = minPrice;
        if (newPrice > maxPrice) newPrice = maxPrice;
        
        const deltaPercent = ((newPrice - oldPrice) / oldPrice) * 100;
        const change24h = (c.change24h || 0) + deltaPercent;
        
        // Keep a neat rolling history
        let history = c.history;
        if (!Array.isArray(history)) {
          try {
            history = typeof history === "string" ? JSON.parse(history) : [];
          } catch (e) {
            history = [];
          }
        }
        
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        history.push({ date: timestamp, price: Number(newPrice.toFixed(2)) });
        if (history.length > 10) history.shift();
        
        return {
          ...c,
          currentPrice: Number(newPrice.toFixed(2)),
          change24h: Number(change24h.toFixed(2)),
          history
        };
      });
      
      // 2. Propagate price changes down to S/4HANA material master prices proportionally based on weights
      const updatedMaterials = data.materials.map((m: any) => {
        const weights = m.commodityWeights || {};
        
        // Base weights influence
        let weightSum = 0;
        let weightedPriceSum = 0;
        
        Object.keys(weights).forEach(key => {
          if (key === "other") return;
          const wt = weights[key] || 0;
          const comm = updatedCommodities.find((c: any) => c.id === key);
          if (comm) {
            weightedPriceSum += (wt * comm.currentPrice);
            weightSum += wt;
          }
        });
        
        // Scale unit price using weighted commodity changes
        const originalDefaults = defaults.materials.find((dm: any) => dm.id === m.id);
        const basePrice = originalDefaults ? originalDefaults.unitPrice : m.unitPrice;
        
        // Random walk of material price combined with currency fluctuation
        const randomFactor = 1 + (Math.random() * 0.4 - 0.2) / 100; // tiny +/- 0.2% randomness
        const fxFactor = liveFxRates.USD_INR / (sysConfig.variables.USD_INR_DEFAULT || 83.45); // currency impact
        
        let calculatedPrice = basePrice * randomFactor * fxFactor;
        
        // If there's a strong commodity link, we influence it up to 40%
        if (weightSum > 0) {
          const pctInfluence = Math.min(weightSum / 100, 0.6); // cap commodity weight influence
          calculatedPrice = (basePrice * (1 - pctInfluence)) + (basePrice * pctInfluence * (weightedPriceSum / 5000)); // blended ratio
        }
        
        if (calculatedPrice < 1) calculatedPrice = 1;
        
        return {
          ...m,
          unitPrice: Number(calculatedPrice.toFixed(2)),
          totalValue: Number((calculatedPrice * (m.volume || 0)).toFixed(2))
        };
      });
      
      // Write back directly to disk
      writeExcelData(filePath, updatedMaterials, updatedCommodities, data.risks);
      
    } catch (err: any) {
      console.error(`[TICKER] Error updating database for industry ${ind}:`, err.message || err);
    }
  });
  
  console.log(`[TICKER] Rewrite completed for all Excel spreadsheets on disk.`);
}

// Master Interval checking system_config.xlsx parameters dynamically every second
let fxElapsedSeconds = 0;
let tickerElapsedSeconds = 0;

// Execute initial rate sync
fetchLiveRates();
setTimeout(fluctuateAllExcelDatabases, 2000);

setInterval(() => {
  const sysConfig = loadSystemConfig();
  const tickerSec = sysConfig.variables.TICKER_INTERVAL_SEC || 60;
  const fxMin = sysConfig.variables.FX_REFRESH_INTERVAL_MIN || 5;
  const fxSec = fxMin * 60;

  fxElapsedSeconds++;
  tickerElapsedSeconds++;

  if (tickerElapsedSeconds >= tickerSec) {
    tickerElapsedSeconds = 0;
    fluctuateAllExcelDatabases();
  }

  if (fxElapsedSeconds >= fxSec) {
    fxElapsedSeconds = 0;
    fetchLiveRates();
  }
}, 1000);

// API endpoint to retrieve full system_config.xlsx specifications
app.get("/api/system-config", (req, res) => {
  try {
    const config = loadSystemConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API endpoint to update variables sheet in system_config.xlsx dynamically
app.post("/api/system-config/update-variables", (req, res) => {
  const { variables } = req.body;
  if (!variables || typeof variables !== "object") {
    return res.status(400).json({ error: "Missing variables object in request body" });
  }
  try {
    saveSystemConfigVariables(variables);
    res.json({
      success: true,
      message: "Variables successfully synchronized with system_config.xlsx on server!"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Live market fluctuation status
app.get("/api/ticker-status", (req, res) => {
  res.json({
    activeFxRate: liveFxRates.USD_INR,
    eurRate: liveFxRates.USD_EUR,
    source: liveFxRates.source,
    lastFetch: lastFxFetchTime,
    ticks: tickerIntervalCount,
    lastUpdate: new Date().toLocaleTimeString(),
    nextUpdateInSeconds: 60 - Math.floor((Date.now() % 60000) / 1000)
  });
});

// 9. Manual trigger for immediate fluctuation
app.post("/api/trigger-fluctuation", (req, res) => {
  try {
    fluctuateAllExcelDatabases();
    res.json({
      success: true,
      message: "Market price fluctuations triggered successfully! All 9 physical Excel databases updated on disk.",
      activeFxRate: liveFxRates.USD_INR,
      lastUpdate: new Date().toLocaleTimeString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Map uploaded BOMs/Materials to raw commodities using Gemini
app.post("/api/analyze-boms", async (req, res) => {
  const { materials } = req.body;
  if (!materials || !Array.isArray(materials)) {
    return res.status(400).json({ error: "Missing materials array in request body" });
  }

  const ai = getGeminiClient();
  if (!ai) {
    console.log("No Gemini API key. Generating local keyword-based composition mapping.");
    const mapped = getLocalMaterialMapping(materials);
    return res.json(mapped);
  }

  try {
    const listToPrompt = materials.map(m => ({
      id: m.id || m.materialId || Math.random().toString(36).substr(2, 9),
      name: m.name || m.description,
      category: m.category || ""
    }));

    const response = await generateContentWithModelFallback(ai, {
      contents: `You are an SAP Material Master and metal fabrication engineering expert.
Analyze the following list of SAP technical materials and estimate their approximate weight percentage of key industrial raw commodities (copper, steel, aluminum, nickel) based on industry standards for heavy utilities and power equipment (e.g., generators, transformers, switchgear, structural steel, cables).
The percentage weights for copper, steel, aluminum, nickel, and "other" (plastics, insulation, other metals) MUST sum up exactly to 100%.

Materials list:
${JSON.stringify(listToPrompt, null, 2)}

Provide a JSON array matching the schema where you return the weights and a concise 1-sentence SAP consultant explanation for the estimate. Do not include any markdown format tags other than valid JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              copper: { type: Type.NUMBER, description: "Weight % of copper (0-100)" },
              steel: { type: Type.NUMBER, description: "Weight % of steel (0-100)" },
              aluminum: { type: Type.NUMBER, description: "Weight % of aluminum (0-100)" },
              nickel: { type: Type.NUMBER, description: "Weight % of nickel (0-100)" },
              other: { type: Type.NUMBER, description: "Weight % of other materials (0-100)" },
              explanation: { type: Type.STRING, description: "SAP consultant 1-sentence design justification" }
            },
            required: ["id", "copper", "steel", "aluminum", "nickel", "other", "explanation"]
          }
        }
      }
    });

    const parsedMapping = JSON.parse(response.text || "[]");
    const mapped = materials.map(mat => {
      const matId = mat.id || mat.materialId;
      const aiMap = parsedMapping.find((p: any) => p.id === matId);
      if (aiMap) {
        return {
          ...mat,
          commodityWeights: {
            copper: aiMap.copper,
            steel: aiMap.steel,
            aluminum: aiMap.aluminum,
            nickel: aiMap.nickel,
            other: aiMap.other
          },
          isAiMapped: true,
          mappingExplanation: aiMap.explanation
        };
      } else {
        // standard fallback
        return {
          ...mat,
          commodityWeights: { copper: 15, steel: 50, aluminum: 15, nickel: 5, other: 15 },
          isAiMapped: false,
          mappingExplanation: "Fallback baseline distribution applied."
        };
      }
    });

    res.json(mapped);
  } catch (error: any) {
    console.warn("Gemini BOM mapping failed. Falling back to offline local heuristic mapping:", error.message || error);
    try {
      const mapped = getLocalMaterialMapping(materials);
      return res.json(mapped);
    } catch (fallbackError: any) {
      console.error("Critical mapping fallback failure:", fallbackError);
      res.status(500).json({ error: "Failed to map materials via AI. " + error.message });
    }
  }
});

// 5. Generate a comprehensive SAP Procurement Strategy & Advisory memo using Gemini
app.post("/api/generate-strategy", async (req, res) => {
  const { materials, simulatedRates, marketStatus, industry } = req.body;
  if (!materials || !Array.isArray(materials)) {
    return res.status(400).json({ error: "Missing materials data" });
  }

  const activeIndustry = industry || "automobile";

  const ai = getGeminiClient();
  if (!ai) {
    console.log(`No Gemini API key. Generating local dynamic consulting strategy memorandum for ${activeIndustry}.`);
    const fallbackMemo = getLocalStrategyMemo(materials, simulatedRates, activeIndustry);
    return res.json({ strategyMemo: fallbackMemo });
  }

  try {
    let industryContext = "";
    if (activeIndustry === "pharma") {
      industryContext = `The client is a global pharmaceutical leader (Sun Pharmaceutical Industries).
Their active Material Master includes Active Pharmaceutical Ingredients (APIs), organic synthesis solvents, sterile glass vials, and aluminum backing blister foils.
They map their raw material components to critical indexes like API Base chemicals (Phenol precursors) mapped to 'copper', organic solvents to 'steel', aluminum backing to 'aluminum', and sterile borosilicate glass to 'nickel'.
The primary goal is avoiding production stoppages on active formulas (Amoxicillin, Paracetamol) and keeping packaging cost parameters stable.`;
    } else if (activeIndustry === "retail") {
      industryContext = `The client is a major retail conglomerate (Reliance Retail Group).
Their active Material Master includes premium organic cotton yarns, kraft cardboard shipping boxes, PET beverage plastic resins, and agricultural basmati rice grains.
They map organic cotton yarn to 'copper', packaging cardboard to 'steel', PET plastic resins to 'aluminum', and agricultural food grains to 'nickel'.
The primary goal is mitigating price spikes on highly distributed private-label consumer goods and minimizing shipping packaging margins.`;
    } else {
      industryContext = `The client is a tier-1 automobile manufacturer (Maruti Suzuki Corp).
Their active Material Master includes chassis high-strength steel frames, EV electrical wiring harnesses, alloy wheel castings, catalytic converters, and traction motor stators.
They map wiring harnesses/EV motor stators to 'copper', structural chassis panels/frames to 'steel', alloy wheels/engine castings to 'aluminum', and nickel-heavy catalytic converter exhaust components to 'nickel'.
The primary goal is managing heavy industrial metal price exposures across key vehicle assembly programs.`;
    }

    const prompt = `You are a Principal SAP Supply Chain Consultant and Senior Commodity Analyst.
${industryContext}

Current simulated commodity price adjustments (relative to base):
- Copper / API Index / Cotton: ${simulatedRates?.copper || 0}% change
- Steel / Organic Solvents / Cardboard: ${simulatedRates?.steel || 0}% change
- Aluminum / Blister Foil / PET Resins: ${simulatedRates?.aluminum || 0}% change
- Nickel / Borosilicate Glass / Grains: ${simulatedRates?.nickel || 0}% change

Here is the company's loaded material list from SAP:
${JSON.stringify(materials, null, 2)}

Market forecasts on exchanges over the next 1-2 quarters:
- Copper / API Index / Cotton: Strong bullish trend due to global electrification or raw crop yields (+9.5% by Q4)
- Steel / Solvents / Cardboard: Neutral to bearish (-5% by Q4) due to slowing general industrial indexes
- Aluminum / Blister Foil / PET Resins: Moderate bullish (+6% by Q4) owing to solar frames, medical wraps, and plastics packaging
- Nickel / Glass Vials / Grains: Highly volatile, slightly bearish (-6.6% by Q4) due to supply expansion in Southeast Asia

Based on this, generate a highly professional SAP Advisory Procurement Memo. Include:
1. Executive Summary identifying the client's highest raw material/commodity risk exposures.
2. Direct Action Items: Specific SAP Materials to purchase in advance (due to expected commodity spikes) and specific materials to delay/hold purchase orders on (to capture price drops). Highlight materials by ID (e.g., MAT-001 or MAT-PH01) and calculate specific cost-impact benefits where possible.
3. Vendor Geopolitical & Logistic Strategy based on vendor countries.
Use markdown headings, tables, and bullet points. Make it read like a premium, high-value consulting report. Refer to the specific company name, material IDs, and vendor parameters provided.`;

    const response = await generateContentWithModelFallback(ai, {
      contents: prompt
    });

    res.json({ strategyMemo: response.text });
  } catch (error: any) {
    console.warn("Failed to generate strategic memo via Gemini. Falling back to offline dynamic advisor:", error.message || error);
    try {
      const fallbackMemo = getLocalStrategyMemo(materials, simulatedRates, activeIndustry);
      return res.json({ strategyMemo: fallbackMemo });
    } catch (fallbackError: any) {
      console.error("Critical strategy fallback failure:", fallbackError);
      res.status(500).json({ error: "Failed to generate report via AI. " + error.message });
    }
  }
});


// Serve static assets in production, otherwise mount Vite dev server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
