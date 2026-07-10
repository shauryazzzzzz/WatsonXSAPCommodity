import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import * as XLSX from "xlsx";

dotenv.config();

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

// Helper to generate content with fallback models if the primary model is busy or fails
const generateContentWithModelFallback = async (ai: any, params: {
  contents: any;
  config?: any;
}) => {
  try {
    console.log("Trying Gemini generation with primary model: gemini-3.5-flash");
    return await ai.models.generateContent({
      model: "gemini-3.5-flash",
      ...params
    });
  } catch (error: any) {
    console.warn(`Primary model gemini-3.5-flash failed (Code/Message: ${error.message || error}). Trying fallback model: gemini-3.1-flash-lite`);
    try {
      return await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        ...params
      });
    } catch (fallbackError: any) {
      console.error(`Fallback model gemini-3.1-flash-lite also failed:`, fallbackError.message || fallbackError);
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

// Excel File Management and Persistence Setup
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const AUTOMOBILE_EXCEL_PATH = path.join(DATA_DIR, "sap_automobile.xlsx");
const PHARMA_EXCEL_PATH = path.join(DATA_DIR, "sap_pharma.xlsx");
const RETAIL_EXCEL_PATH = path.join(DATA_DIR, "sap_retail.xlsx");

const getExcelPath = (industry: string) => {
  if (industry === "pharma") return PHARMA_EXCEL_PATH;
  if (industry === "retail") return RETAIL_EXCEL_PATH;
  return AUTOMOBILE_EXCEL_PATH;
};

const getDefaults = (industry: string) => {
  if (industry === "pharma") {
    return { materials: PHARMA_MATERIALS, commodities: PHARMA_COMMODITIES, risks: PHARMA_RISKS };
  } else if (industry === "retail") {
    return { materials: RETAIL_MATERIALS, commodities: RETAIL_COMMODITIES, risks: RETAIL_RISKS };
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
if (!fs.existsSync(AUTOMOBILE_EXCEL_PATH)) {
  writeExcelData(AUTOMOBILE_EXCEL_PATH, INITIAL_MATERIALS, INITIAL_COMMODITIES, GEOPOLITICAL_RISKS_MOCK);
}
if (!fs.existsSync(PHARMA_EXCEL_PATH)) {
  writeExcelData(PHARMA_EXCEL_PATH, PHARMA_MATERIALS, PHARMA_COMMODITIES, PHARMA_RISKS);
}
if (!fs.existsSync(RETAIL_EXCEL_PATH)) {
  writeExcelData(RETAIL_EXCEL_PATH, RETAIL_MATERIALS, RETAIL_COMMODITIES, RETAIL_RISKS);
}

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
  const industries = ["automobile", "pharma", "retail"];
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
