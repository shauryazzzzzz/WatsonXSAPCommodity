import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileSpreadsheet, 
  Database, 
  Trash2, 
  Plus, 
  Edit3, 
  RefreshCw, 
  FileJson, 
  Check, 
  AlertCircle, 
  Download,
  Search,
  Sliders,
  HelpCircle
} from "lucide-react";
import { Material, CommodityMarket, GeopoliticalRisk } from "../types";

interface ExcelFileInfo {
  industry: string;
  filePath: string;
  relativePath: string;
  exists: boolean;
  size: string;
}

interface ExcelDatabaseViewProps {
  activeIndustry: "automobile" | "pharma" | "retail";
  onTriggerDataRefresh: () => void;
}

export default function ExcelDatabaseView({ 
  activeIndustry,
  onTriggerDataRefresh
}: ExcelDatabaseViewProps) {
  // Database files metadata
  const [fileInfos, setFileInfos] = useState<ExcelFileInfo[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Active viewing states
  const [selectedIndustry, setSelectedIndustry] = useState<"automobile" | "pharma" | "retail">(activeIndustry);
  const [selectedSheet, setSelectedSheet] = useState<"materials" | "commodities" | "risks">("materials");
  const [searchQuery, setSearchQuery] = useState("");

  // Data loaded from active Excel
  const [materials, setMaterials] = useState<Material[]>([]);
  const [commodities, setCommodities] = useState<any[]>([]);
  const [risks, setRisks] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // CRUD operation states
  const [isAdding, setIsAdding] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forms states
  const [materialForm, setMaterialForm] = useState({
    id: "",
    name: "",
    category: "",
    unitPrice: 100,
    currency: "USD",
    volume: 5000,
    vendorName: "",
    vendorCountry: "",
    inventoryUsed: 3000,
    inventoryOrdered: 1500,
    inventoryBufferStock: 500
  });

  const [commodityForm, setCommodityForm] = useState({
    id: "",
    name: "",
    symbol: "",
    currentPrice: 1000,
    unit: "USD/MT",
    change24h: 0.0,
    volatility: "Medium"
  });

  const [riskForm, setRiskForm] = useState({
    country: "",
    riskScore: 2.0,
    status: "Stable",
    description: "",
    vendorCount: 1,
    materialShare: 10
  });

  // Sync / fetch Excel metadata and files info
  const fetchFileInfos = async () => {
    setLoadingInfo(true);
    try {
      const res = await fetch("/api/excel/info");
      if (res.ok) {
        const data = await res.json();
        setFileInfos(data);
      }
    } catch (err) {
      console.error("Error fetching excel files info:", err);
    } finally {
      setLoadingInfo(false);
    }
  };

  // Fetch the actual dataset from Excel sheets via the server
  const fetchExcelSheetData = async (ind: string) => {
    setLoadingData(true);
    try {
      // Fetch materials
      const resMat = await fetch(`/api/materials?industry=${ind}`);
      const materialsData = await resMat.json();
      setMaterials(materialsData);

      // Fetch commodities
      const resComm = await fetch(`/api/commodities?industry=${ind}`);
      const commoditiesData = await resComm.json();
      setCommodities(commoditiesData);

      // Fetch risks
      const resRisk = await fetch(`/api/geopolitical-risks?industry=${ind}`);
      const risksData = await resRisk.json();
      setRisks(risksData);
    } catch (err) {
      console.error("Error loading Excel sheets:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchFileInfos();
    fetchExcelSheetData(selectedIndustry);
  }, [selectedIndustry]);

  // Keep selectedIndustry in sync with activeIndustry when it changes on top header
  useEffect(() => {
    setSelectedIndustry(activeIndustry);
  }, [activeIndustry]);

  const showFeedback = (type: "success" | "error", msg: string) => {
    if (type === "success") {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    } else {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  // Save materials back to server and refresh
  const saveMaterialsToExcel = async (updatedList: Material[]) => {
    try {
      const res = await fetch("/api/excel/update-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: selectedIndustry, materials: updatedList })
      });
      if (res.ok) {
        setMaterials(updatedList);
        showFeedback("success", "Materials sheet written and saved to Excel file successfully!");
        fetchFileInfos();
        onTriggerDataRefresh(); // Refresh top level dashboard
      } else {
        const err = await res.json();
        showFeedback("error", `Failed to write Excel: ${err.error || "Unknown error"}`);
      }
    } catch (e: any) {
      showFeedback("error", `Network error: ${e.message}`);
    }
  };

  // Save commodities back to server
  const saveCommoditiesToExcel = async (updatedList: any[]) => {
    try {
      const res = await fetch("/api/excel/update-commodities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: selectedIndustry, commodities: updatedList })
      });
      if (res.ok) {
        setCommodities(updatedList);
        showFeedback("success", "Commodities sheet written and saved to Excel file successfully!");
        fetchFileInfos();
        onTriggerDataRefresh();
      } else {
        const err = await res.json();
        showFeedback("error", `Failed to write Excel: ${err.error || "Unknown error"}`);
      }
    } catch (e: any) {
      showFeedback("error", `Network error: ${e.message}`);
    }
  };

  // Save risks back to server
  const saveRisksToExcel = async (updatedList: any[]) => {
    try {
      const res = await fetch("/api/excel/update-risks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: selectedIndustry, risks: updatedList })
      });
      if (res.ok) {
        setRisks(updatedList);
        showFeedback("success", "Geopolitical Risks sheet written and saved to Excel file successfully!");
        fetchFileInfos();
        onTriggerDataRefresh();
      } else {
        const err = await res.json();
        showFeedback("error", `Failed to write Excel: ${err.error || "Unknown error"}`);
      }
    } catch (e: any) {
      showFeedback("error", `Network error: ${e.message}`);
    }
  };

  // DELETE row from active Excel
  const handleDeleteRow = (idOrKey: string) => {
    if (!window.confirm(`Are you sure you want to delete this row from the active industry Excel file?`)) return;

    if (selectedSheet === "materials") {
      const updated = materials.filter(m => m.id !== idOrKey);
      saveMaterialsToExcel(updated);
    } else if (selectedSheet === "commodities") {
      const updated = commodities.filter(c => c.id !== idOrKey);
      saveCommoditiesToExcel(updated);
    } else if (selectedSheet === "risks") {
      const updated = risks.filter(r => r.country !== idOrKey);
      saveRisksToExcel(updated);
    }
  };

  // ADD new row
  const handleAddRowSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSheet === "materials") {
      if (!materialForm.id || !materialForm.name) {
        showFeedback("error", "Material ID and Name are required!");
        return;
      }
      if (materials.some(m => m.id.toLowerCase() === materialForm.id.toLowerCase())) {
        showFeedback("error", `Duplicate Material ID: ${materialForm.id} already exists!`);
        return;
      }

      const newMaterial: Material = {
        ...materialForm,
        totalValue: materialForm.unitPrice * materialForm.volume,
        commodityWeights: { copper: 0, steel: 0, aluminum: 0, nickel: 0, other: 100 },
        isAiMapped: false
      };

      const updated = [...materials, newMaterial];
      saveMaterialsToExcel(updated);
      setIsAdding(false);
      // Reset form
      setMaterialForm({
        id: "", name: "", category: "Sourcing Raw", unitPrice: 100, currency: "USD",
        volume: 5000, vendorName: "", vendorCountry: "",
        inventoryUsed: 3000, inventoryOrdered: 1500, inventoryBufferStock: 500
      });
    } else if (selectedSheet === "commodities") {
      if (!commodityForm.id || !commodityForm.name) {
        showFeedback("error", "Commodity ID and Name are required!");
        return;
      }
      if (commodities.some(c => c.id.toLowerCase() === commodityForm.id.toLowerCase())) {
        showFeedback("error", `Duplicate Commodity ID: ${commodityForm.id} already exists!`);
        return;
      }

      const newCommodity = {
        ...commodityForm,
        history: [{ date: "Jun 26", price: commodityForm.currentPrice }],
        forecast: [{ period: "Q3 2026", price: commodityForm.currentPrice * 1.05, change: 5.0, signal: "up" }],
        foContracts: []
      };

      const updated = [...commodities, newCommodity];
      saveCommoditiesToExcel(updated);
      setIsAdding(false);
    } else if (selectedSheet === "risks") {
      if (!riskForm.country) {
        showFeedback("error", "Country Name is required!");
        return;
      }
      if (risks.some(r => r.country.toLowerCase() === riskForm.country.toLowerCase())) {
        showFeedback("error", `Duplicate Entry: Geopolitical risk for ${riskForm.country} already exists!`);
        return;
      }

      const updated = [...risks, { ...riskForm }];
      saveRisksToExcel(updated);
      setIsAdding(false);
    }
  };

  // OPEN Edit row form
  const startEditRow = (row: any) => {
    setEditingRow({ ...row });
  };

  // SAVE edited row
  const handleEditRowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRow) return;

    if (selectedSheet === "materials") {
      const updated = materials.map(m => m.id === editingRow.id ? {
        ...editingRow,
        totalValue: Number(editingRow.unitPrice) * Number(editingRow.volume)
      } : m);
      saveMaterialsToExcel(updated);
    } else if (selectedSheet === "commodities") {
      const updated = commodities.map(c => c.id === editingRow.id ? { ...editingRow } : c);
      saveCommoditiesToExcel(updated);
    } else if (selectedSheet === "risks") {
      const updated = risks.map(r => r.country === editingRow.country ? { ...editingRow } : r);
      saveRisksToExcel(updated);
    }
    setEditingRow(null);
  };

  // Helper to format industry titles
  const getIndustryLabel = (ind: string) => {
    if (ind === "pharma") return "Sun Pharma (LifeSciences)";
    if (ind === "retail") return "Reliance Retail (Consumer Goods)";
    return "Maruti Suzuki (Automobile)";
  };

  // Filter lists based on search query
  const filteredMaterials = materials.filter(m => 
    m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.vendorCountry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCommodities = commodities.filter(c => 
    c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRisks = risks.filter(r => 
    r.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in" id="excel-db-management-panel">
      
      {/* 1. Header Information Grid */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database className="w-48 h-48" />
        </div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-700/60 rounded-lg text-emerald-300">
              <FileSpreadsheet className="w-6 h-6 animate-pulse" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight">SAP Excel Database Management (Page 2)</h2>
              <p className="text-xs text-emerald-100/80">
                Direct read/write access to the server's Excel database files representing dummy-fetched S/4HANA OData integrity.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {fileInfos.map(info => {
              const isActive = info.industry === selectedIndustry;
              return (
                <div 
                  key={info.industry}
                  onClick={() => setSelectedIndustry(info.industry as any)}
                  className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                    isActive 
                      ? "bg-white/15 border-white/30 shadow-md ring-2 ring-emerald-400" 
                      : "bg-black/10 border-white/10 hover:bg-white/5"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-emerald-300 tracking-wide uppercase">
                      {info.industry === "automobile" ? "Automotive" : info.industry === "pharma" ? "LifeSciences" : "Consumer"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 font-mono text-emerald-300">
                      {info.size}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold mt-1 truncate">{getIndustryLabel(info.industry)}</h4>
                  <div className="mt-2 space-y-0.5 font-mono text-[10px] text-emerald-200/70">
                    <p className="truncate">File: <span className="text-white">{info.relativePath}</span></p>
                    <p className="truncate">Status: <span className="text-emerald-300">● ONLINE & WRITEABLE</span></p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notifications bar */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2"
          >
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}

        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Main Workspace Layout */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        
        {/* Navigation & Toolbar Header */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Sheet Selector Tabs */}
          <div className="flex bg-slate-200/60 p-1 rounded-lg gap-1">
            <button
              onClick={() => { setSelectedSheet("materials"); setSearchQuery(""); }}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                selectedSheet === "materials" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Materials DB Sheet
            </button>
            <button
              onClick={() => { setSelectedSheet("commodities"); setSearchQuery(""); }}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                selectedSheet === "commodities" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Commodity Indexes Sheet
            </button>
            <button
              onClick={() => { setSelectedSheet("risks"); setSearchQuery(""); }}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                selectedSheet === "risks" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Geopolitical Risks Sheet
            </button>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:flex-initial">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Search Excel data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-56 pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <button
              onClick={() => {
                fetchExcelSheetData(selectedIndustry);
                fetchFileInfos();
              }}
              title="Refresh database values from disk"
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin text-emerald-600" : ""}`} />
            </button>

            <button
              onClick={() => setIsAdding(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Row to Excel
            </button>
          </div>
        </div>

        {/* 3. Grid Table Visualization */}
        <div className="overflow-x-auto min-h-[300px]">
          {loadingData ? (
            <div className="flex flex-col items-center justify-center p-24 text-slate-400">
              <RefreshCw className="w-10 h-10 animate-spin text-emerald-500 mb-3" />
              <p className="text-xs">Loading physical spreadsheet content from active industry Excel file...</p>
            </div>
          ) : (
            <>
              {/* SHEET 1: MATERIALS */}
              {selectedSheet === "materials" && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">SAP ID</th>
                      <th className="py-3 px-4">Material Name</th>
                      <th className="py-3 px-4">BOM Category</th>
                      <th className="py-3 px-4 text-right">Unit Price</th>
                      <th className="py-3 px-4 text-right">Volume</th>
                      <th className="py-3 px-4 text-right">Total Value</th>
                      <th className="py-3 px-4">Vendor & Country</th>
                      <th className="py-3 px-4 text-right">Stocks (Used/Ordered/Buffer)</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                    {filteredMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-slate-400">
                          No matching material master records found in the Excel workbook.
                        </td>
                      </tr>
                    ) : (
                      filteredMaterials.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900">{m.id}</td>
                          <td className="py-3 px-4 font-medium max-w-xs truncate" title={m.name}>{m.name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                              {m.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-950">
                            {m.unitPrice} {m.currency}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">{m.volume.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700">
                            ${m.totalValue ? m.totalValue.toLocaleString() : (m.unitPrice * m.volume).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-800">{m.vendorName}</p>
                            <p className="text-[10px] text-slate-400">{m.vendorCountry}</p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[11px] space-y-0.5">
                            <p className="text-slate-500">Used: <span className="text-slate-800 font-semibold">{m.inventoryUsed}</span></p>
                            <p className="text-slate-500">Ordered: <span className="text-slate-800 font-semibold">{m.inventoryOrdered}</span></p>
                            <p className="text-slate-500">Buffer: <span className="text-emerald-700 font-semibold">{m.inventoryBufferStock}</span></p>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => startEditRow(m)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                                title="Edit Material"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(m.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 cursor-pointer"
                                title="Delete Material"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* SHEET 2: COMMODITIES */}
              {selectedSheet === "commodities" && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Commodity ID</th>
                      <th className="py-3 px-4">Index Market Name</th>
                      <th className="py-3 px-4">Ticker Symbol</th>
                      <th className="py-3 px-4 text-right">Current Index Price</th>
                      <th className="py-3 px-4">Unit of Measure</th>
                      <th className="py-3 px-4 text-right">24h Shift</th>
                      <th className="py-3 px-4">Market Volatility</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                    {filteredCommodities.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400">
                          No matching commodity records found in the Excel workbook.
                        </td>
                      </tr>
                    ) : (
                      filteredCommodities.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-semibold text-slate-900 uppercase">{c.id}</td>
                          <td className="py-3 px-4 font-medium">{c.name}</td>
                          <td className="py-3 px-4 font-mono text-indigo-600 font-semibold">{c.symbol}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                            ${Number(c.currentPrice).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-slate-500">{c.unit}</td>
                          <td className={`py-3 px-4 text-right font-mono font-semibold ${
                            Number(c.change24h) >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {Number(c.change24h) >= 0 ? "+" : ""}{c.change24h}%
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.volatility === "High" 
                                ? "bg-red-50 text-red-700 border border-red-100" 
                                : c.volatility === "Medium"
                                ? "bg-amber-50 text-amber-700 border border-amber-100"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            }`}>
                              {c.volatility}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => startEditRow(c)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                                title="Edit Commodity"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(c.id)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 cursor-pointer"
                                title="Delete Commodity"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* SHEET 3: GEOPOLITICAL RISKS */}
              {selectedSheet === "risks" && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-400 uppercase font-mono tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Sourcing Country</th>
                      <th className="py-3 px-4 text-center">Risk Score (1-5)</th>
                      <th className="py-3 px-4">Risk Status</th>
                      <th className="py-3 px-4">Supply Chain Impact Statement</th>
                      <th className="py-3 px-4 text-right">Vendor Count</th>
                      <th className="py-3 px-4 text-right">BOM Material Share</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans text-slate-700">
                    {filteredRisks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          No matching country risk records found in the Excel workbook.
                        </td>
                      </tr>
                    ) : (
                      filteredRisks.map((r, idx) => (
                        <tr key={r.country + idx} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-semibold text-slate-900">{r.country}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center justify-center w-7 h-7 rounded-full font-mono font-bold bg-slate-100 text-slate-800">
                              {r.riskScore}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              r.status === "Stable" 
                                ? "bg-emerald-100 text-emerald-800" 
                                : r.status === "Caution"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 max-w-sm font-medium text-slate-600 italic">
                            "{r.description}"
                          </td>
                          <td className="py-3 px-4 text-right font-mono">{r.vendorCount || 1}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold">{r.materialShare || 0}%</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => startEditRow(r)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                                title="Edit Risk"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(r.country)}
                                className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 cursor-pointer"
                                title="Delete Risk"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {/* 4. MODAL: ADD ROW FORM */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden"
          >
            <div className="bg-emerald-800 text-white p-4 flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Add Row to Excel Sheet ({selectedSheet.toUpperCase()})
              </h3>
              <button 
                onClick={() => setIsAdding(false)} 
                className="text-white/80 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRowSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Form elements for Materials */}
              {selectedSheet === "materials" && (
                <div className="space-y-3.5 text-xs text-slate-600">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SAP Material ID (e.g. MAT-110)</label>
                    <input
                      type="text" required placeholder="MAT-XXX"
                      value={materialForm.id}
                      onChange={(e) => setMaterialForm({ ...materialForm, id: e.target.value })}
                      className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Material Name Description</label>
                    <input
                      type="text" required placeholder="Enter SAP product description"
                      value={materialForm.name}
                      onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                      className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">BOM Category</label>
                      <input
                        type="text" required placeholder="e.g. Body Structures"
                        value={materialForm.category}
                        onChange={(e) => setMaterialForm({ ...materialForm, category: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                      <input
                        type="text" required placeholder="USD"
                        value={materialForm.currency}
                        onChange={(e) => setMaterialForm({ ...materialForm, currency: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Unit Price ($)</label>
                      <input
                        type="number" required min="0.01" step="0.01"
                        value={materialForm.unitPrice}
                        onChange={(e) => setMaterialForm({ ...materialForm, unitPrice: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Annual Volume (MT)</label>
                      <input
                        type="number" required min="1"
                        value={materialForm.volume}
                        onChange={(e) => setMaterialForm({ ...materialForm, volume: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vendor Name</label>
                      <input
                        type="text" required placeholder="Tata Steel Ltd"
                        value={materialForm.vendorName}
                        onChange={(e) => setMaterialForm({ ...materialForm, vendorName: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vendor Country</label>
                      <input
                        type="text" required placeholder="India"
                        value={materialForm.vendorCountry}
                        onChange={(e) => setMaterialForm({ ...materialForm, vendorCountry: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Form elements for Commodities */}
              {selectedSheet === "commodities" && (
                <div className="space-y-3.5 text-xs text-slate-600">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Commodity ID (e.g. copper, cotton)</label>
                    <input
                      type="text" required placeholder="lowercase index key"
                      value={commodityForm.id}
                      onChange={(e) => setFormLowercaseId(e.target.value)}
                      className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Index Name</label>
                    <input
                      type="text" required placeholder="Copper (LME)"
                      value={commodityForm.name}
                      onChange={(e) => setCommodityForm({ ...commodityForm, name: e.target.value })}
                      className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Symbol</label>
                      <input
                        type="text" required placeholder="HG-F"
                        value={commodityForm.symbol}
                        onChange={(e) => setCommodityForm({ ...commodityForm, symbol: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Unit of Measure</label>
                      <input
                        type="text" required placeholder="USD/MT"
                        value={commodityForm.unit}
                        onChange={(e) => setCommodityForm({ ...commodityForm, unit: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Index Price ($)</label>
                      <input
                        type="number" required min="0.01" step="0.01"
                        value={commodityForm.currentPrice}
                        onChange={(e) => setCommodityForm({ ...commodityForm, currentPrice: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Volatility</label>
                      <select
                        value={commodityForm.volatility}
                        onChange={(e) => setCommodityForm({ ...commodityForm, volatility: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Form elements for Risks */}
              {selectedSheet === "risks" && (
                <div className="space-y-3.5 text-xs text-slate-600">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Sourcing Country</label>
                    <input
                      type="text" required placeholder="e.g. India, Germany"
                      value={riskForm.country}
                      onChange={(e) => setRiskForm({ ...riskForm, country: e.target.value })}
                      className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Risk Score (1.0 - 5.0)</label>
                      <input
                        type="number" required min="1.0" max="5.0" step="0.1"
                        value={riskForm.riskScore}
                        onChange={(e) => setRiskForm({ ...riskForm, riskScore: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Status</label>
                      <select
                        value={riskForm.status}
                        onChange={(e) => setRiskForm({ ...riskForm, status: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none bg-white"
                      >
                        <option value="Stable">Stable</option>
                        <option value="Caution">Caution</option>
                        <option value="High Risk">High Risk</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Supply Chain Statement</label>
                    <textarea
                      required rows={3} placeholder="Provide structural risk details on logistics and sourcing stability"
                      value={riskForm.description}
                      onChange={(e) => setRiskForm({ ...riskForm, description: e.target.value })}
                      className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vendor Count</label>
                      <input
                        type="number" required min="1"
                        value={riskForm.vendorCount}
                        onChange={(e) => setRiskForm({ ...riskForm, vendorCount: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">BOM Share (%)</label>
                      <input
                        type="number" required min="0" max="100"
                        value={riskForm.materialShare}
                        onChange={(e) => setRiskForm({ ...riskForm, materialShare: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  Write to Excel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 5. MODAL: EDIT ROW FORM */}
      {editingRow && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden"
          >
            <div className="bg-indigo-800 text-white p-4 flex justify-between items-center">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Edit3 className="w-4 h-4" />
                Edit Row in Excel ({selectedSheet.toUpperCase()})
              </h3>
              <button 
                onClick={() => setEditingRow(null)} 
                className="text-white/80 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditRowSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* EDIT Materials */}
              {selectedSheet === "materials" && (
                <div className="space-y-3.5 text-xs text-slate-600">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SAP Material ID (ReadOnly)</label>
                    <input
                      type="text" disabled
                      value={editingRow.id}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-slate-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Material Name Description</label>
                    <input
                      type="text" required
                      value={editingRow.name}
                      onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                      className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">BOM Category</label>
                      <input
                        type="text" required
                        value={editingRow.category}
                        onChange={(e) => setEditingRow({ ...editingRow, category: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Unit Price ($)</label>
                      <input
                        type="number" required min="0.01" step="0.01"
                        value={editingRow.unitPrice}
                        onChange={(e) => setEditingRow({ ...editingRow, unitPrice: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Volume (MT)</label>
                      <input
                        type="number" required min="1"
                        value={editingRow.volume}
                        onChange={(e) => setEditingRow({ ...editingRow, volume: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vendor Country</label>
                      <input
                        type="text" required
                        value={editingRow.vendorCountry}
                        onChange={(e) => setEditingRow({ ...editingRow, vendorCountry: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-500 mb-1">Used Stock</label>
                      <input
                        type="number" required
                        value={editingRow.inventoryUsed || 0}
                        onChange={(e) => setEditingRow({ ...editingRow, inventoryUsed: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-1.5 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-500 mb-1">Ordered Stock</label>
                      <input
                        type="number" required
                        value={editingRow.inventoryOrdered || 0}
                        onChange={(e) => setEditingRow({ ...editingRow, inventoryOrdered: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-1.5 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-500 mb-1">Buffer Stock</label>
                      <input
                        type="number" required
                        value={editingRow.inventoryBufferStock || 0}
                        onChange={(e) => setEditingRow({ ...editingRow, inventoryBufferStock: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-1.5 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* EDIT Commodities */}
              {selectedSheet === "commodities" && (
                <div className="space-y-3.5 text-xs text-slate-600">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Commodity ID (ReadOnly)</label>
                    <input
                      type="text" disabled
                      value={editingRow.id}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-slate-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Index Name</label>
                    <input
                      type="text" required
                      value={editingRow.name}
                      onChange={(e) => setEditingRow({ ...editingRow, name: e.target.value })}
                      className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Ticker Symbol</label>
                      <input
                        type="text" required
                        value={editingRow.symbol}
                        onChange={(e) => setEditingRow({ ...editingRow, symbol: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-indigo-600 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Unit</label>
                      <input
                        type="text" required
                        value={editingRow.unit}
                        onChange={(e) => setEditingRow({ ...editingRow, unit: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Index Price ($)</label>
                      <input
                        type="number" required min="0.01" step="0.01"
                        value={editingRow.currentPrice}
                        onChange={(e) => setEditingRow({ ...editingRow, currentPrice: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">24h Shift (%)</label>
                      <input
                        type="number" required step="0.01"
                        value={editingRow.change24h}
                        onChange={(e) => setEditingRow({ ...editingRow, change24h: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* EDIT Risks */}
              {selectedSheet === "risks" && (
                <div className="space-y-3.5 text-xs text-slate-600">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Country (ReadOnly)</label>
                    <input
                      type="text" disabled
                      value={editingRow.country}
                      className="w-full bg-slate-50 border border-slate-200 p-2 rounded text-slate-400 font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Risk Score (1-5)</label>
                      <input
                        type="number" required min="1.0" max="5.0" step="0.1"
                        value={editingRow.riskScore}
                        onChange={(e) => setEditingRow({ ...editingRow, riskScore: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Status</label>
                      <select
                        value={editingRow.status}
                        onChange={(e) => setEditingRow({ ...editingRow, status: e.target.value })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                      >
                        <option value="Stable">Stable</option>
                        <option value="Caution">Caution</option>
                        <option value="High Risk">High Risk</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Supply Chain Impact Statement</label>
                    <textarea
                      required rows={3}
                      value={editingRow.description}
                      onChange={(e) => setEditingRow({ ...editingRow, description: e.target.value })}
                      className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Vendor Count</label>
                      <input
                        type="number" required min="1"
                        value={editingRow.vendorCount || 1}
                        onChange={(e) => setEditingRow({ ...editingRow, vendorCount: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">BOM Share (%)</label>
                      <input
                        type="number" required min="0" max="100"
                        value={editingRow.materialShare || 0}
                        onChange={(e) => setEditingRow({ ...editingRow, materialShare: Number(e.target.value) })}
                        className="w-full border border-slate-200 p-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );

  // Helper setter to force lowercase IDs
  function setFormLowercaseId(val: string) {
    setCommodityForm({
      ...commodityForm,
      id: val.toLowerCase().replace(/\s+/g, "")
    });
  }
}
