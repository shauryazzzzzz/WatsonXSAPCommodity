import React, { useState, useEffect } from "react";
import { Material, CommodityMarket, GeopoliticalRisk } from "./types";
import UploadZone from "./components/UploadZone";
import SimulationControls from "./components/SimulationControls";
import MaterialsTable from "./components/MaterialsTable";
import GeopoliticalRisks from "./components/GeopoliticalRisks";
import StrategyAdvisory from "./components/StrategyAdvisory";
import BackendSheetsView from "./components/BackendSheetsView";
import ExcelDatabaseView from "./components/ExcelDatabaseView";
import DataFlowArchitecture from "./components/DataFlowArchitecture";
import { 
  BarChart3, 
  Globe2, 
  Sparkles, 
  Calculator, 
  Coins, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  FolderGit,
  ArrowRight,
  TrendingUp as TrendIcon,
  HelpCircle,
  RefreshCw,
  FileSpreadsheet,
  Car,
  Pill,
  ShoppingBag,
  PhoneCall,
  DollarSign,
  Landmark,
  Droplets,
  Factory,
  Cpu,
  Building
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const INDUSTRIES = [
  { id: "automobile", name: "Automobile" },
  { id: "pharma", name: "Pharma" },
  { id: "retail", name: "Retail" },
  { id: "telecom", name: "Telecom" },
  { id: "finance", name: "Finance" },
  { id: "banks", name: "Banks" },
  { id: "oil_gas", name: "Oil & Gas" },
  { id: "manufacturing", name: "Manufacturing" },
  { id: "software", name: "Software" }
];

const getIndustryIcon = (id: string) => {
  switch (id) {
    case "automobile": return <Car className="w-4 h-4" />;
    case "pharma": return <Pill className="w-4 h-4" />;
    case "retail": return <ShoppingBag className="w-4 h-4" />;
    case "telecom": return <PhoneCall className="w-4 h-4" />;
    case "finance": return <DollarSign className="w-4 h-4" />;
    case "banks": return <Landmark className="w-4 h-4" />;
    case "oil_gas": return <Droplets className="w-4 h-4" />;
    case "manufacturing": return <Factory className="w-4 h-4" />;
    case "software": return <Cpu className="w-4 h-4" />;
    default: return <Building className="w-4 h-4" />;
  }
};

const getClientName = (id: string) => {
  const clients: Record<string, string> = {
    automobile: "Maruti Suzuki",
    pharma: "Sun Pharma",
    retail: "Reliance Retail",
    telecom: "Bharti Airtel",
    finance: "State Bank of India",
    banks: "HDFC Bank",
    oil_gas: "Reliance Industries",
    manufacturing: "Tata Motors",
    software: "Tata Consultancy Services"
  };
  return clients[id] || (id.charAt(0).toUpperCase() + id.slice(1).replace("_", " ") + " Corp");
};

const getSectorName = (id: string) => {
  const sectors: Record<string, string> = {
    automobile: "Automotive Sector",
    pharma: "LifeSciences & Pharma",
    retail: "Consumer & Retail Sector",
    telecom: "Telecom & Telecom Infrastructure",
    finance: "Financial Services & Treasury",
    banks: "Banking & Retail Wealth",
    oil_gas: "Energy, Oil & Gas Sector",
    manufacturing: "Heavy Industry & Manufacturing",
    software: "Software & Cloud Services"
  };
  return sectors[id] || (id.charAt(0).toUpperCase() + id.slice(1).replace("_", " ") + " Sector");
};

export default function App() {
  // Active states
  const [activeTab, setActiveTab] = useState<"materials" | "excel_db" | "commodities" | "risks" | "strategy" | "backend_sheet" | "architecture">("materials");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [commodities, setCommodities] = useState<CommodityMarket[]>([]);
  const [riskCatalog, setRiskCatalog] = useState<GeopoliticalRisk[]>([]);
  const [activeIndustry, setActiveIndustry] = useState<string>("automobile");
  const [isPollingEnabled, setIsPollingEnabled] = useState(true);
  
  // Selection and simulation states
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>("copper");
  const [simulationRates, setSimulationRates] = useState({
    copper: 0,
    steel: 0,
    aluminum: 0,
    nickel: 0
  });

  // Poll materials and commodities dynamically every 15 seconds if enabled
  useEffect(() => {
    if (!isPollingEnabled) return;

    const interval = setInterval(async () => {
      try {
        const [materialsRes, commoditiesRes, risksRes] = await Promise.all([
          fetch(`/api/materials?industry=${activeIndustry}`),
          fetch(`/api/commodities?industry=${activeIndustry}`),
          fetch(`/api/geopolitical-risks?industry=${activeIndustry}`)
        ]);

        if (materialsRes.ok && commoditiesRes.ok && risksRes.ok) {
          const materialsData = await materialsRes.json();
          const commoditiesData = await commoditiesRes.json();
          const risksData = await risksRes.json();

          setMaterials(materialsData);
          setCommodities(commoditiesData);
          setRiskCatalog(risksData);
        }
      } catch (err) {
        console.error("Auto-polling dashboard data failed:", err);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isPollingEnabled, activeIndustry]);

  // AI strategy text and loaders
  const [strategyMemo, setStrategyMemo] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Dynamic names
  const getCommodityName = (id: string) => {
    const found = commodities.find(c => c.id === id);
    if (found) return found.name;
    // fallback
    if (id === "copper") return "Copper (LME)";
    if (id === "steel") return "Steel HRC (NYMEX)";
    if (id === "aluminum") return "Aluminum (LME)";
    if (id === "nickel") return "Nickel (LME)";
    return id;
  };

  // Load initial datasets from the server on startup or industry change
  const refreshAllDashboardData = async (showLoader = false) => {
    try {
      if (showLoader) setIsLoading(true);
      const [materialsRes, commoditiesRes, risksRes] = await Promise.all([
        fetch(`/api/materials?industry=${activeIndustry}`),
        fetch(`/api/commodities?industry=${activeIndustry}`),
        fetch(`/api/geopolitical-risks?industry=${activeIndustry}`)
      ]);

      const materialsData = await materialsRes.json();
      const commoditiesData = await commoditiesRes.json();
      const risksData = await risksRes.json();

      setMaterials(materialsData);
      setCommodities(commoditiesData);
      setRiskCatalog(risksData);

      // Fetch initial strategic memo based on current values
      await generateStrategyMemo(materialsData, simulationRates, activeIndustry);
    } catch (err) {
      console.error("Failed to refresh dashboard data:", err);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  useEffect(() => {
    setSimulationRates({ copper: 0, steel: 0, aluminum: 0, nickel: 0 });
    refreshAllDashboardData(true);
  }, [activeIndustry]);

  // Fetch or re-generate strategy memo via server Gemini API
  const generateStrategyMemo = async (
    currentMaterials: Material[], 
    currentRates: typeof simulationRates,
    industryToUse: string = activeIndustry
  ) => {
    try {
      setIsGenerating(true);
      const response = await fetch("/api/generate-strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materials: currentMaterials,
          simulatedRates: currentRates,
          industry: industryToUse
        })
      });

      if (!response.ok) {
        throw new Error("Sourcing Strategy report generation failed.");
      }

      const data = await response.json();
      setStrategyMemo(data.strategyMemo || "No report generated.");
    } catch (err) {
      console.error(err);
      setStrategyMemo("### Error: Strategy report generation could not connect to Gemini API. Sourcing advisor is offline.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Trigger strategy re-evaluation manually
  const handleRefreshReport = async () => {
    await generateStrategyMemo(materials, simulationRates, activeIndustry);
  };

  // Callbacks when a new excel workbook is loaded
  const handleMaterialsLoaded = (loadedMaterials: Material[], source: "uploaded" | "default") => {
    setMaterials(loadedMaterials);
    // Generate strategy immediately for the new dataset
    generateStrategyMemo(loadedMaterials, simulationRates, activeIndustry);
  };

  // Update a single material composition (manual override)
  const handleUpdateMaterial = (updatedMaterial: Material) => {
    const updatedList = materials.map(m => m.id === updatedMaterial.id ? updatedMaterial : m);
    setMaterials(updatedList);
    // Re-evaluate strategy with updated manual ratios
    generateStrategyMemo(updatedList, simulationRates, activeIndustry);
  };

  // Update entire materials dataset (from spreadsheet edits)
  const handleUpdateMaterialsList = (updatedList: Material[]) => {
    setMaterials(updatedList);
    generateStrategyMemo(updatedList, simulationRates, activeIndustry);
  };

  // Calculations for KPI Cards
  let totalProcurementSpend = 0;
  let totalCopperExposure = 0;
  let totalSteelExposure = 0;
  let totalAluminumExposure = 0;
  let totalNickelExposure = 0;
  let totalTradedExposure = 0;
  let geopoliticalRiskSpend = 0;

  materials.forEach((m) => {
    const spend = m.volume * m.unitPrice;
    totalProcurementSpend += spend;
    
    const copperShare = (m.commodityWeights?.copper || 0) / 100;
    const steelShare = (m.commodityWeights?.steel || 0) / 100;
    const aluminumShare = (m.commodityWeights?.aluminum || 0) / 100;
    const nickelShare = (m.commodityWeights?.nickel || 0) / 100;

    totalCopperExposure += spend * copperShare;
    totalSteelExposure += spend * steelShare;
    totalAluminumExposure += spend * aluminumShare;
    totalNickelExposure += spend * nickelShare;

    totalTradedExposure += spend * (copperShare + steelShare + aluminumShare + nickelShare);

    // Compute geopolitical risk spend (caution or risk country vendors, e.g. risk >= 3)
    const countryRisk = riskCatalog.find(r => r.country.toLowerCase() === m.vendorCountry.toLowerCase());
    if (countryRisk && countryRisk.riskScore >= 3) {
      geopoliticalRiskSpend += spend;
    }
  });

  // Weighted exposure proportions
  const copperWeightedPercent = totalProcurementSpend > 0 ? (totalCopperExposure / totalProcurementSpend) * 100 : 0;
  const steelWeightedPercent = totalProcurementSpend > 0 ? (totalSteelExposure / totalProcurementSpend) * 100 : 0;
  const aluminumWeightedPercent = totalProcurementSpend > 0 ? (totalAluminumExposure / totalProcurementSpend) * 100 : 0;
  const nickelWeightedPercent = totalProcurementSpend > 0 ? (totalNickelExposure / totalProcurementSpend) * 100 : 0;
  
  const geopoliticalRiskRatio = totalProcurementSpend > 0 ? (geopoliticalRiskSpend / totalProcurementSpend) * 100 : 0;
  const totalExposureRatio = totalProcurementSpend > 0 ? (totalTradedExposure / totalProcurementSpend) * 100 : 0;

  // Active simulated delta addition
  const simCopperDelta = totalCopperExposure * (simulationRates.copper / 100);
  const simSteelDelta = totalSteelExposure * (simulationRates.steel / 100);
  const simAluminumDelta = totalAluminumExposure * (simulationRates.aluminum / 100);
  const simNickelDelta = totalNickelExposure * (simulationRates.nickel / 100);
  const totalSimDelta = simCopperDelta + simSteelDelta + simAluminumDelta + simNickelDelta;

  const formatUSD = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(num);
  };

  // Selected commodity for detailed historical LME line chart
  const activeCommodity = commodities.find(c => c.id === selectedCommodityId) || commodities[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-500/10">
      
      {/* Upper Navigation & Branding Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-6 py-4 shadow-sm" id="app-header">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-700 flex items-center justify-center text-white font-bold text-xl shadow-md">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">CommodityProcure <span className="text-indigo-600 font-medium">Intelligence</span></h1>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  v2026.7
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Principal SAP Material Master exchange rate correlation, forecasting, and hedge strategist for {getClientName(activeIndustry)}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Exchange Feeds: Live (LME/NYMEX)
            </div>
            <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>
            <div className="flex items-center gap-3 hidden md:flex">
              <div className="text-right">
                <p className="text-xs font-bold text-slate-800">SAP Global Consultant</p>
                <p className="text-[10px] text-slate-500">{getSectorName(activeIndustry)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center text-slate-700 italic font-serif font-bold">JD</div>
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        /* Full Page Loader */
        <div className="flex flex-col items-center justify-center py-40 text-center space-y-4">
          <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-800">Bootstrapping SAP Intelligence Module...</p>
            <p className="text-xs text-slate-500">Parsing default Material Master logs & real-time commodity indices.</p>
          </div>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

          {/* Industry Context Selection Panel */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-2xl border border-slate-800 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-5" id="industry-selector-panel">
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider">Enterprise Sourcing Domain Context</span>
              <h2 className="text-sm font-bold text-white">Active Industry Dataset Selector</h2>
              <p className="text-[11px] text-slate-300 max-w-xl">
                Switch between active clients to dynamically swap mock SAP material databases, condition rates (MARA/KONP), and geopolitical risks.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind.id}
                  onClick={() => setActiveIndustry(ind.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    activeIndustry === ind.id
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-sm shadow-indigo-600/30"
                      : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {getIndustryIcon(ind.id)}
                  {ind.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sourcing Spend KPIs Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="kpi-block">
            
            {/* KPI 1: Overall Annual Spend */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 relative overflow-hidden group shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Total Annual Spend</span>
                  <div className="text-2xl font-bold text-slate-800 font-mono mt-1.5">{formatUSD(totalProcurementSpend)}</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <Coins className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                Sourcing volume: <span className="font-mono text-slate-700 font-bold">{materials.length} standard items</span>
              </p>
            </div>

             {/* KPI 2: Weighted Primary Commodity Impact */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 relative overflow-hidden group shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Weighted {getCommodityName("copper")} Concentration</span>
                  <div className="text-2xl font-bold text-slate-800 font-mono mt-1.5">{copperWeightedPercent.toFixed(1)}%</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <Calculator className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-2">
                <span>Value: {formatUSD(totalCopperExposure)}</span>
                <span className="text-indigo-600 font-bold">{getCommodityName("copper")} Primary</span>
              </div>
            </div>

            {/* KPI 3: Commodity Risk Exposure */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 relative overflow-hidden group shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Traded Commodity Exposure</span>
                  <div className="text-2xl font-bold text-slate-800 font-mono mt-1.5">{totalExposureRatio.toFixed(1)}%</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-mono border-t border-slate-100 pt-2">
                <span>Active Exposure: {formatUSD(totalTradedExposure)}</span>
                {totalSimDelta !== 0 && (
                  <span className={`font-bold ${totalSimDelta > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    Sim: {totalSimDelta > 0 ? "+" : ""}{simulationRates.copper > 0 || simulationRates.steel > 0 ? `${((totalSimDelta / totalProcurementSpend) * 100).toFixed(1)}%` : ""}
                  </span>
                )}
              </div>
            </div>

            {/* KPI 4: Sourcing Geopolitical Risks */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 relative overflow-hidden group shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Geopolitical Risk Ratio</span>
                  <div className="text-2xl font-bold text-slate-800 font-mono mt-1.5">{geopoliticalRiskRatio.toFixed(1)}%</div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                Caution Sourcing: <span className="font-mono text-slate-700 font-bold">{formatUSD(geopoliticalRiskSpend)}</span>
              </p>
            </div>

          </div>

          {/* Upload Zone */}
          <UploadZone
            onMaterialsLoaded={handleMaterialsLoaded}
            onStartAnalysis={() => setIsAnalyzing(true)}
            onEndAnalysis={() => setIsAnalyzing(false)}
            isAnalyzing={isAnalyzing}
          />

          {/* Interactive Simulation Panel */}
          <SimulationControls
            materials={materials}
            commodities={commodities}
            rates={simulationRates}
            onRateChange={(newRates) => {
              setSimulationRates(newRates);
              // Recalculate AI strategies when sliders adjust
              generateStrategyMemo(materials, newRates, activeIndustry);
            }}
            industry={activeIndustry}
          />

          {/* Main Dashboard Interactive Tabs */}
          <div className="space-y-4">
            <div className="flex border-b border-slate-200 gap-1 overflow-x-auto pb-px" id="main-navigation-tabs">
              <button
                onClick={() => setActiveTab("materials")}
                className={`px-5 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "materials"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
                id="tab-btn-materials"
              >
                <FolderGit className="w-4 h-4" />
                SAP Materials & BOM Allocation
              </button>

              <button
                onClick={() => setActiveTab("excel_db")}
                className={`px-5 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "excel_db"
                    ? "border-emerald-600 text-emerald-600 bg-emerald-50/40 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
                id="tab-btn-excel-db"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                SAP Excel Databases (Page 2)
              </button>

              <button
                onClick={() => setActiveTab("commodities")}
                className={`px-5 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "commodities"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
                id="tab-btn-commodities"
              >
                <Coins className="w-4 h-4" />
                Commodity Exchanges Desk
              </button>

              <button
                onClick={() => setActiveTab("risks")}
                className={`px-5 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "risks"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
                id="tab-btn-risks"
              >
                <Globe2 className="w-4 h-4" />
                Sourcing Geopolitical Risks
              </button>

              <button
                onClick={() => setActiveTab("strategy")}
                className={`px-5 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "strategy"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                    : "border-transparent text-slate-500 hover:text-indigo-600"
                }`}
                id="tab-btn-strategy"
              >
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                Strategic AI Advisory Memo
              </button>

              <button
                onClick={() => setActiveTab("backend_sheet")}
                className={`px-5 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "backend_sheet"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
                id="tab-btn-backend-sheet"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Unified ERP & Commodity Sheet
              </button>

              <button
                onClick={() => setActiveTab("architecture")}
                className={`px-5 py-3.5 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === "architecture"
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/40"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
                id="tab-btn-architecture"
              >
                <Cpu className="w-4 h-4 text-indigo-500" />
                Data Flow & Architecture
              </button>
            </div>

            {/* Tab Renderers */}
            <div>
              {activeTab === "materials" && (
                <MaterialsTable
                  materials={materials}
                  onUpdateMaterial={handleUpdateMaterial}
                  selectedMaterialId={selectedMaterialId}
                  onSelectMaterial={setSelectedMaterialId}
                />
              )}

              {activeTab === "excel_db" && (
                <ExcelDatabaseView
                  activeIndustry={activeIndustry}
                  onTriggerDataRefresh={() => refreshAllDashboardData(false)}
                />
              )}

              {activeTab === "commodities" && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-fade-in" id="commodities-exchanges-panel">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Commodity Cards Selection (4 cols) */}
                    <div className="lg:col-span-4 space-y-3.5">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Exchange Index Markets</h3>
                      
                      {commodities.map((c) => {
                        const isSelected = selectedCommodityId === c.id;
                        const isUp = c.change24h > 0;
                        const weight = c.id === "copper" ? copperWeightedPercent 
                                    : c.id === "steel" ? steelWeightedPercent 
                                    : c.id === "aluminum" ? aluminumWeightedPercent 
                                    : nickelWeightedPercent;

                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedCommodityId(c.id)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                              isSelected
                                ? "bg-indigo-50/50 border-indigo-500 ring-1 ring-indigo-500/20"
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/40"
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">{c.symbol}</span>
                                <h4 className="text-sm font-semibold text-slate-800 mt-0.5">{c.name}</h4>
                              </div>
                              <span className={`text-[11px] font-mono font-bold flex items-center gap-0.5 ${isUp ? "text-emerald-600" : "text-rose-600"}`}>
                                {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                {isUp ? "+" : ""}{c.change24h}%
                              </span>
                            </div>

                            <div className="flex justify-between items-baseline mt-4 pt-3 border-t border-slate-100">
                              <span className="text-base font-bold text-slate-800 font-mono">{c.currentPrice.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">{c.unit}</span></span>
                              <span className="text-[10px] text-slate-400 font-mono">Weighted Impact: <strong className="text-slate-600">{weight.toFixed(0)}%</strong></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Commodity Details & Chart (8 cols) */}
                    <div className="lg:col-span-8 flex flex-col justify-between">
                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 h-full flex flex-col justify-between space-y-6">
                        
                        {/* Header details */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-200">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-indigo-600">{activeCommodity.symbol}</span>
                            <h3 className="text-base font-bold text-slate-800 mt-0.5">{activeCommodity.name} Traded History</h3>
                          </div>
                          
                          <div className="flex gap-4 font-mono text-[10px] text-slate-500">
                            <div>
                              <span className="text-slate-400">Exchange Standard:</span>
                              <p className="text-slate-700 mt-0.5">LME / CME Physical Deliverable</p>
                            </div>
                            <div>
                              <span className="text-slate-400">Price Volatility Index:</span>
                              <p className={`font-bold mt-0.5 ${
                                activeCommodity.volatility === "High" ? "text-purple-600" : activeCommodity.volatility === "Medium" ? "text-amber-600" : "text-emerald-600"
                              }`}>{activeCommodity.volatility}</p>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Recharts Line chart */}
                        <div className="h-[250px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={activeCommodity.history}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                              <YAxis stroke="#64748b" fontSize={10} domain={["auto", "auto"]} tickFormatter={(val) => val.toLocaleString()} />
                              <Tooltip
                                contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", color: "#1e293b" }}
                                formatter={(val) => [`$${Number(val).toLocaleString()}`, "Price"]}
                              />
                              <Line
                                type="monotone"
                                dataKey="price"
                                stroke="#4f46e5"
                                strokeWidth={2.5}
                                dot={{ fill: "#4f46e5", r: 3 }}
                                activeDot={{ r: 5 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Forecast Quarter timeline */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Exchange Futures Outlook (LME Q-Forecasts)</h4>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {activeCommodity.forecast.map((fc, i) => {
                              const isBull = fc.signal === "up";
                              return (
                                <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 flex flex-col justify-between shadow-sm">
                                  <span className="text-[10px] text-slate-400 font-bold">{fc.period}</span>
                                  <div className="flex justify-between items-baseline mt-2">
                                    <span className="text-xs font-bold text-slate-800 font-mono">${fc.price.toLocaleString()}</span>
                                    <span className={`text-[9px] font-bold font-mono flex items-center ${isBull ? "text-emerald-600" : "text-rose-600"}`}>
                                      {isBull ? "+" : ""}{fc.change}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "risks" && (
                <GeopoliticalRisks
                  materials={materials}
                  riskCatalog={riskCatalog}
                />
              )}

              {activeTab === "strategy" && (
                <StrategyAdvisory
                  materials={materials}
                  rates={simulationRates}
                  onRefreshReport={handleRefreshReport}
                  strategyMemo={strategyMemo}
                  isGenerating={isGenerating}
                />
              )}

              {activeTab === "backend_sheet" && (
                <BackendSheetsView
                  materials={materials}
                  commodities={commodities}
                  onUpdateMaterials={handleUpdateMaterialsList}
                  activeIndustry={activeIndustry}
                />
              )}

              {activeTab === "architecture" && (
                <DataFlowArchitecture
                  activeIndustry={activeIndustry}
                  onRefreshAllData={() => refreshAllDashboardData(false)}
                  isPollingEnabled={isPollingEnabled}
                  onTogglePolling={() => setIsPollingEnabled(!isPollingEnabled)}
                />
              )}
            </div>
          </div>
        </main>
      )}

      {/* Footer credits and information */}
      <footer className="border-t border-slate-200 bg-white px-6 py-8 text-center text-xs text-slate-500">
        <p>© 2026 SAP Supply Chain Commodity Integration Module. All rights reserved.</p>
        <p className="mt-1">
          Designed for principal SAP material master analysis, weight estimations, and hedge forecasting. {activeIndustry === "pharma" ? "Sun Pharma (LifeSciences)" : activeIndustry === "retail" ? "Reliance Retail (Consumer Goods)" : "Maruti Suzuki (Automobile)"} industry simulation mode active.
        </p>
      </footer>

    </div>
  );
}
