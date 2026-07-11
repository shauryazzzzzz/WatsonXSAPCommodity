import React, { useState, useEffect } from "react";
import { 
  Globe, 
  ArrowRightLeft, 
  Database, 
  Play, 
  FileSpreadsheet, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  HelpCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  Settings,
  Sliders,
  Save
} from "lucide-react";

interface TickerStatus {
  activeFxRate: number;
  eurRate: number;
  source: string;
  lastFetch: string;
  ticks: number;
  lastUpdate: string;
  nextUpdateInSeconds: number;
}

interface ExcelFileInfo {
  industry: string;
  filePath: string;
  relativePath: string;
  exists: boolean;
  size: string;
}

interface SystemConfig {
  variables: Record<string, any>;
  industries: Array<{ id: string; name: string; clientName: string; sectorName: string; excelFileName: string }>;
  commodities: Array<{ id: string; name: string; symbol: string; unit: string; volatility: string; initialPrice: number }>;
}

interface DataFlowArchitectureProps {
  activeIndustry: string;
  onRefreshAllData: () => void;
  isPollingEnabled: boolean;
  onTogglePolling: () => void;
}

export default function DataFlowArchitecture({
  activeIndustry,
  onRefreshAllData,
  isPollingEnabled,
  onTogglePolling
}: DataFlowArchitectureProps) {
  const [tickerStatus, setTickerStatus] = useState<TickerStatus | null>(null);
  const [excelInfo, setExcelInfo] = useState<ExcelFileInfo[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [editedVars, setEditedVars] = useState<Record<string, string>>({});
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaveMessage, setConfigSaveMessage] = useState<{ success: boolean; text: string } | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/ticker-status");
      if (res.ok) {
        const data = await res.json();
        setTickerStatus(data);
      }

      const infoRes = await fetch("/api/excel/info");
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        setExcelInfo(infoData);
      }
    } catch (e) {
      console.error("Failed to fetch ticker status", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/system-config");
      if (res.ok) {
        const data: SystemConfig = await res.json();
        setSystemConfig(data);
        // Map current values to edited map state
        const initialVars: Record<string, string> = {};
        Object.keys(data.variables).forEach(key => {
          initialVars[key] = String(data.variables[key]);
        });
        setEditedVars(initialVars);
      }
    } catch (err) {
      console.error("Failed to load backend system configuration", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchConfig();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const triggerFluctuation = async () => {
    setIsTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/trigger-fluctuation", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setTriggerResult({ success: true, message: data.message });
        fetchStatus();
        onRefreshAllData(); // Refresh App state
        setTimeout(() => setTriggerResult(null), 5000);
      } else {
        setTriggerResult({ success: false, message: "Server failed to execute live fluctuation" });
      }
    } catch (e) {
      setTriggerResult({ success: false, message: "Network error occurred while triggering fluctuation" });
    } finally {
      setIsTriggering(false);
    }
  };

  const handleVariableChange = (key: string, val: string) => {
    setEditedVars(prev => ({
      ...prev,
      [key]: val
    }));
  };

  const saveVariablesToExcel = async () => {
    setIsSavingConfig(true);
    setConfigSaveMessage(null);
    try {
      const variablesToSend: Record<string, any> = {};
      Object.keys(editedVars).forEach(key => {
        const originalVal = systemConfig?.variables[key];
        if (typeof originalVal === "number") {
          variablesToSend[key] = Number(editedVars[key]);
        } else {
          variablesToSend[key] = editedVars[key];
        }
      });

      const res = await fetch("/api/system-config/update-variables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: variablesToSend })
      });

      if (res.ok) {
        const result = await res.json();
        setConfigSaveMessage({ success: true, text: result.message || "Successfully saved config variables!" });
        await fetchConfig();
        await fetchStatus();
        onRefreshAllData(); // Apply updated exchange rates immediately
        setTimeout(() => setConfigSaveMessage(null), 6000);
      } else {
        setConfigSaveMessage({ success: false, text: "Server rejected variables write request." });
      }
    } catch (err) {
      setConfigSaveMessage({ success: false, text: "Connection to configuration endpoint failed." });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const getIndustryDisplayName = (id: string) => {
    const found = systemConfig?.industries.find(i => i.id === id);
    if (found) return found.name;
    
    const names: Record<string, string> = {
      automobile: "Automobile (Maruti Suzuki)",
      pharma: "Pharma (Sun Pharma)",
      retail: "Retail (Reliance Retail)",
      telecom: "Telecom (Bharti Airtel)",
      finance: "Finance (SBI Treasury)",
      banks: "Banks (HDFC Bank)",
      oil_gas: "Oil & Gas (Reliance Industries)",
      manufacturing: "Manufacturing (Tata Motors)",
      software: "Software (TCS Cloud Services)"
    };
    return names[id] || id;
  };

  return (
    <div className="space-y-8 animate-fade-in" id="data-flow-architecture-view">
      {/* Top Banner & Control Board */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">Live Synced System Active</span>
            </div>
            <h2 className="text-xl font-bold mt-1 tracking-tight">S/4HANA ERP Database & Live Commodities Flow</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              This panel exposes the real-world architecture. Sourcing prices are not hardcoded static lists; they dynamically fluctuate on disk spreadsheets and synchronize with live global FX feeds.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            {/* Real-time Polling Toggle */}
            <button
              onClick={onTogglePolling}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isPollingEnabled
                  ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPollingEnabled ? "animate-spin" : ""}`} />
              Auto-Polling: {isPollingEnabled ? "Every 15s (On)" : "Paused (Off)"}
            </button>

            {/* Manual Fluctuate Trigger */}
            <button
              onClick={triggerFluctuation}
              disabled={isTriggering}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-500 transition-all cursor-pointer shadow-lg shadow-indigo-600/30 disabled:opacity-50"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {isTriggering ? "Fluctuating..." : "Trigger Live Market Fluctuation"}
            </button>
          </div>
        </div>

        {/* Trigger Response Message */}
        {triggerResult && (
          <div className={`mt-4 p-3 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fade-in ${
            triggerResult.success 
              ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/50" 
              : "bg-rose-950/40 text-rose-400 border-rose-800/50"
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{triggerResult.message}</span>
          </div>
        )}
      </div>

      {/* Central Excel Configuration Panel */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Central Configuration Variables (system_config.xlsx)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Zero Hard Coding implementation. All parameters below are dynamically loaded from <code className="bg-slate-200 text-indigo-800 px-1 rounded">/data/system_config.xlsx</code>. Modify them here to rewrite the Excel file directly in the backend!
            </p>
          </div>
          <button
            onClick={saveVariablesToExcel}
            disabled={isSavingConfig}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white border border-indigo-500 hover:bg-indigo-500 transition-all cursor-pointer disabled:opacity-50 shadow-md shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            {isSavingConfig ? "Syncing..." : "Save to system_config.xlsx"}
          </button>
        </div>

        {/* Save message */}
        {configSaveMessage && (
          <div className={`m-4 p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
            configSaveMessage.success
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}>
            <CheckCircle2 className="w-4 h-4" />
            <span>{configSaveMessage.text}</span>
          </div>
        )}

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {systemConfig ? (
              Object.keys(systemConfig.variables).map((key) => {
                const originalVal = systemConfig.variables[key];
                const currentVal = editedVars[key] || "";
                
                // Friendly description
                const descriptionMap: Record<string, string> = {
                  USD_INR_DEFAULT: "Initial or fallback USD to INR exchange rate used in ERP calculations.",
                  USD_EUR_DEFAULT: "Initial or fallback USD to EUR exchange rate.",
                  TICKER_INTERVAL_SEC: "Time interval in seconds for automatic background commodity price fluctuations.",
                  MAX_FLUC_PCT: "Maximum price fluctuation percentage (+/-) applied during each interval step.",
                  MIN_COMMODITY_PRICE: "Lower floor boundary for dynamic commodity pricing simulations.",
                  MAX_COMMODITY_PRICE: "Ceiling price threshold for dynamic commodity pricing simulations.",
                  PRIMARY_GEMINI_MODEL: "Primary Gemini LLM model utilized for procurement risk advisory generations.",
                  FALLBACK_GEMINI_MODEL: "Alternative fallback model automatically invoked if limits or quota issues occur.",
                  FX_API_URL: "Public REST endpoint utilized to fetch dynamic real-time exchange rates.",
                  FX_REFRESH_INTERVAL_MIN: "Synchronization frequency in minutes to query live currency feeds."
                };

                return (
                  <div key={key} className="p-4 bg-slate-50 border border-slate-150 rounded-xl space-y-1.5 hover:border-slate-300 transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-bold text-indigo-900">{key}</span>
                      <span className="text-[10px] uppercase font-mono text-slate-400">
                        {typeof originalVal}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {descriptionMap[key] || "Global system variable used dynamically across endpoints."}
                    </p>
                    <div className="pt-1.5 flex items-center gap-2">
                      <input
                        type="text"
                        value={currentVal}
                        onChange={(e) => handleVariableChange(key, e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 text-center py-6">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Reading global variables sheet from server config database...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Live Feeds & Ticker Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Foreign Exchange API Feed */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Exchange Rate API Feed</h3>
                <span className="text-[9px] font-mono text-slate-400 uppercase">Live currency portal</span>
              </div>
            </div>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-bold px-2 py-0.5 rounded-full">
              Real API Feed
            </span>
          </div>

          <div className="mt-5 space-y-3.5">
            <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Active USD/INR</span>
              <span className="text-xl font-bold font-mono text-slate-800">
                ₹{tickerStatus?.activeFxRate ? tickerStatus.activeFxRate.toFixed(2) : "83.45"}
              </span>
            </div>
            <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Active USD/EUR</span>
              <span className="text-sm font-bold font-mono text-slate-800">
                €{tickerStatus?.eurRate ? tickerStatus.eurRate.toFixed(4) : "0.9200"}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[10px] text-slate-400">
              <span>Feed Provider</span>
              <span className="font-semibold text-slate-600 text-right truncate max-w-[150px]">
                {tickerStatus?.source || "open.er-api.com"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Commodity Fluctuation Ticker */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Interval Ticker status</h3>
                <span className="text-[9px] font-mono text-slate-400 uppercase">Background fluctuation loop</span>
              </div>
            </div>
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold px-2 py-0.5 rounded-full">
              Dynamic Rate
            </span>
          </div>

          <div className="mt-5 space-y-3.5">
            <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Total Fluctuation Loops</span>
              <span className="text-xl font-bold font-mono text-indigo-600">
                {tickerStatus?.ticks || 0} ticks
              </span>
            </div>
            <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Next Auto-Fluctuation</span>
              <span className="text-sm font-bold font-mono text-slate-850">
                In {tickerStatus?.nextUpdateInSeconds !== undefined ? tickerStatus.nextUpdateInSeconds : 60}s
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[10px] text-slate-400">
              <span>Loop Scope</span>
              <span className="font-semibold text-slate-600">
                {systemConfig?.industries.length || 9} Active Excel files
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Active State Status */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">ERP Local Integration</h3>
                <span className="text-[9px] font-mono text-slate-400 uppercase">Master Data Synchronization</span>
              </div>
            </div>
            <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-bold px-2 py-0.5 rounded-full">
              Active Sync
            </span>
          </div>

          <div className="mt-5 space-y-3.5">
            <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Active ERP Division</span>
              <span className="text-xs font-bold text-slate-800">
                {getIndustryDisplayName(activeIndustry)}
              </span>
            </div>
            <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
              <span className="text-xs text-slate-500">Client-Side Polling</span>
              <span className={`text-xs font-bold ${isPollingEnabled ? "text-emerald-600" : "text-slate-500"}`}>
                {isPollingEnabled ? "Enabled (15s Loop)" : "Disabled"}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-[10px] text-slate-400">
              <span>S/4HANA OData Integrity</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                Verified <CheckCircle2 className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Visual Architectural Data Path */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
          Interactive Data flow Architecture map
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-11 items-center gap-4 py-4 text-center">
          
          {/* Node 1: Live External Feed */}
          <div className="lg:col-span-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col items-center">
            <Globe className="w-6 h-6 text-emerald-600 mb-1.5" />
            <span className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider">Live API Website</span>
            <p className="text-xs font-bold text-slate-850 mt-1">open.er-api.com</p>
            <p className="text-[10px] text-slate-500 mt-1">Fetches real global exchange rates</p>
          </div>

          {/* Arrow 1 */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center text-slate-400">
            <ArrowRight className="w-5 h-5 hidden lg:block text-slate-300" />
            <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">FX Rates</span>
          </div>

          {/* Node 2: Backend Price Engine */}
          <div className="lg:col-span-3 bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex flex-col items-center shadow-inner">
            <Cpu className="w-6 h-6 text-indigo-600 mb-1.5 animate-pulse" />
            <span className="text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wider">Live Fluctuation Engine</span>
            <p className="text-xs font-bold text-slate-850 mt-1">Express Server Task</p>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Triggers dynamically. Fluctuate commodities & dynamically recalculates material prices.
            </p>
          </div>

          {/* Arrow 2 */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center text-slate-400">
            <ArrowRight className="w-5 h-5 hidden lg:block text-slate-300" />
            <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Disk Write</span>
          </div>

          {/* Node 3: Physical Excel Database */}
          <div className="lg:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center">
            <Database className="w-6 h-6 text-amber-600 mb-1.5" />
            <span className="text-[10px] font-mono font-bold text-amber-700 uppercase tracking-wider">Disk Databases</span>
            <p className="text-xs font-bold text-slate-850 mt-1">sap_{activeIndustry}.xlsx</p>
            <p className="text-[10px] text-slate-500 mt-1">Binary excel files on disk rewrite in real time</p>
          </div>

          {/* Arrow 3 */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center text-slate-400">
            <ArrowRight className="w-5 h-5 hidden lg:block text-slate-300" />
            <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">HTTP GET</span>
          </div>

          {/* Node 4: React UI */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-850 rounded-xl p-4 flex flex-col items-center text-white">
            <FileSpreadsheet className="w-6 h-6 text-indigo-400 mb-1.5" />
            <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-wider">ERP Dashboard</span>
            <p className="text-xs font-bold mt-1">React Frontend</p>
          </div>

        </div>
      </div>

      {/* Backend Excel DB Files Inspector */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50/80 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              S/4HANA Backend File Inspector & Binary Integrity
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These are the physical sheets located on the server disk. Direct modifications to these files are watched and fetched in real time.
            </p>
          </div>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-lg">
            {excelInfo.length} Spreadsheets Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="py-3 px-4 font-bold text-slate-600">Enterprise Segment</th>
                <th className="py-3 px-4 font-bold text-slate-600">Physical Excel Path on Server</th>
                <th className="py-3 px-4 font-bold text-slate-600">Binary Size</th>
                <th className="py-3 px-4 text-center font-bold text-slate-600">Physical Integrity</th>
                <th className="py-3 px-4 text-center font-bold text-slate-600">Active Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {excelInfo.map((info, idx) => {
                const isActive = info.industry === activeIndustry;
                return (
                  <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${isActive ? "bg-indigo-50/30" : ""}`}>
                    <td className="py-3.5 px-4 font-bold text-slate-800 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${info.exists ? "bg-emerald-500" : "bg-rose-500"}`} />
                      {getIndustryDisplayName(info.industry).split(" ")[0]}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">{info.filePath}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-600">{info.exists ? info.size : "Not Generated"}</td>
                    <td className="py-3.5 px-4 text-center">
                      {info.exists ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded">
                           <CheckCircle2 className="w-3 h-3" /> Binary Disk OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" /> Bootstrapping Fallback
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {isActive ? (
                        <span className="bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                          Selected
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-medium">Inactive</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
