import React, { useState } from "react";
import { Material, CommodityMarket } from "../types";
import { 
  FileSpreadsheet, 
  RefreshCw, 
  Database, 
  Link2, 
  Code, 
  Check, 
  AlertCircle, 
  Plus, 
  Info, 
  Settings, 
  Download,
  Share2,
  Terminal,
  Cpu,
  Play,
  FileJson,
  Wifi,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";

interface BackendSheetsViewProps {
  materials: Material[];
  commodities: CommodityMarket[];
  onUpdateMaterials: (updatedMaterials: Material[]) => void;
  activeIndustry?: "automobile" | "pharma" | "retail";
}

export default function BackendSheetsView({ 
  materials, 
  commodities, 
  onUpdateMaterials,
  activeIndustry = "automobile"
}: BackendSheetsViewProps) {
  // Active sheet selection
  const [activeSheet, setActiveSheet] = useState<"erp" | "commodities">("erp");
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "dirty" | "error">("synced");
  const [showApiDocs, setShowApiDocs] = useState(false);

  // SAP OData & MCP Sandbox States
  const [showSandbox, setShowSandbox] = useState(true);
  const [sandboxQuery, setSandboxQuery] = useState<"materials" | "stocks" | "contracts">("materials");
  
  const getClientName = () => {
    if (activeIndustry === "pharma") return "Sun Pharmaceutical Corp";
    if (activeIndustry === "retail") return "Reliance Retail Ltd";
    return "Maruti Suzuki India Corp";
  };

  const getBtpDestName = () => {
    if (activeIndustry === "pharma") return "SUNPHARMA_PRD_MUM";
    if (activeIndustry === "retail") return "RELIANCE_PRD_MUM";
    return "S4HANA_PRD_MARUTI";
  };

  const [sandboxLogs, setSandboxLogs] = useState<string[]>([
    `[SYSTEM] S/4HANA Gateway Sandbox initialized for ${getClientName()}.`,
    `[AUTH] Secure connection check: XSUAA Single-Sign-On OK (client ID: sb-btp-${activeIndustry}-prod)`,
    `[INFO] Ready to execute mock SAP OData REST API queries. Select an endpoint below to begin.`
  ]);
  const [sandboxResponse, setSandboxResponse] = useState<string>("");
  const [isExecutingQuery, setIsExecutingQuery] = useState(false);
  const [queryExecutedSuccessfully, setQueryExecutedSuccessfully] = useState(false);
  const [mcpIntegrationActive, setMcpIntegrationActive] = useState(true);

  // Flatten all F&O contracts for displaying in Sheet 2
  const allFoContracts = commodities.flatMap(c => 
    (c.foContracts || []).map(fo => ({
      ...fo,
      underlier: c.name
    }))
  );

  // Helper to format currency
  const formatUSD = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(num);
  };

  // Start cell editing
  const handleCellClick = (rowId: string, field: string, currentValue: any) => {
    setSelectedCell({ rowId, field });
    setEditValue(String(currentValue));
  };

  // Save cell edit
  const handleCellSave = () => {
    if (!selectedCell) return;
    const { rowId, field } = selectedCell;

    const updated = materials.map(m => {
      if (m.id === rowId) {
        let numValue = Number(editValue);
        if (isNaN(numValue)) numValue = 0;

        const updatedMaterial = { ...m };

        if (field === "unitPrice") {
          updatedMaterial.unitPrice = numValue;
          updatedMaterial.totalValue = numValue * updatedMaterial.volume;
        } else if (field === "volume") {
          updatedMaterial.volume = numValue;
          updatedMaterial.totalValue = updatedMaterial.unitPrice * numValue;
        } else if (field === "inventoryUsed") {
          updatedMaterial.inventoryUsed = numValue;
        } else if (field === "inventoryOrdered") {
          updatedMaterial.inventoryOrdered = numValue;
        } else if (field === "inventoryBufferStock") {
          updatedMaterial.inventoryBufferStock = numValue;
        } else if (field === "name") {
          updatedMaterial.name = editValue;
        } else if (field === "vendorName") {
          updatedMaterial.vendorName = editValue;
        }

        return updatedMaterial;
      }
      return m;
    });

    onUpdateMaterials(updated);
    setSelectedCell(null);
    setSyncStatus("dirty");
  };

  // Simulate Google Sheet Cloud Run Server synchronization
  const handleSyncData = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setSyncStatus("synced");
    }, 1500);
  };

  // Run simulated SAP S/4HANA OData Query for the active client
  const runSandboxQuery = (queryType: "materials" | "stocks" | "contracts") => {
    setIsExecutingQuery(true);
    setQueryExecutedSuccessfully(false);
    
    // Add realistic OData execution logs
    setSandboxLogs(prev => [
      ...prev,
      `[INFO] [${new Date().toLocaleTimeString()}] Initializing connection to S/4HANA Core for ${getClientName()}...`,
      `[AUTH] Authenticating against XSUAA service with OAuth token validation...`,
      `[DEST] Querying BTP Destination Service for '${getBtpDestName()}'...`,
      `[HTTP GET] Requesting URL: /sap/opu/odata/sap/${
        queryType === "materials" 
          ? `API_PRODUCT_SRV/A_Product?$filter=IndustrySector eq '${activeIndustry === "pharma" ? "P" : activeIndustry === "retail" ? "R" : "M"}' and Customer eq '${activeIndustry.toUpperCase()}'`
          : queryType === "stocks"
          ? `API_MATERIAL_STOCK_SRV/A_MatlStkInAcctgPeriod?$filter=Plant eq '${activeIndustry === "pharma" ? "PL_VADODARA_02" : activeIndustry === "retail" ? "PL_NAVI_MUMBAI_01" : "PL_GURUGRAM_01"}'`
          : `Z${activeIndustry.toUpperCase()}_FO_MARKET_SRV/ActiveContracts?$expand=fo_expiries`
      }`
    ]);

    setTimeout(() => {
      let response = "";
      if (queryType === "materials") {
        if (activeIndustry === "pharma") {
          response = JSON.stringify({
            "d": {
              "results": [
                { "Product": "MAT-201", "ProductName": "API Chemical - Phenol Base (99% Pure Bulk)", "Category": "Active Ingredients", "UnitPrice": "120.00", "Currency": "USD", "DefaultSupplier": "Deepak Nitrite Ltd" },
                { "Product": "MAT-202", "ProductName": "High-Purity Organic Solvents (Ethanol USP)", "Category": "Solvents & Media", "UnitPrice": "65.00", "Currency": "USD", "DefaultSupplier": "India Glycols Ltd" },
                { "Product": "MAT-203", "ProductName": "Sterile Aluminum Foil Laminates (Blister Packs)", "Category": "Packaging Material", "UnitPrice": "45.00", "Currency": "USD", "DefaultSupplier": "Hindalco Industries Ltd" },
                { "Product": "MAT-205", "ProductName": "Borosilicate Glass Vials Type I (10ml)", "Category": "Primary Containment", "UnitPrice": "85.00", "Currency": "USD", "DefaultSupplier": "Schott Kaisha Pvt Ltd" },
                { "Product": "MAT-207", "ProductName": "Hard Gelatin Capsule Shells (Size 0)", "Category": "Excipients & Additives", "UnitPrice": "18.00", "Currency": "USD", "DefaultSupplier": "Associated Capsules Group" }
              ]
            }
          }, null, 2);
        } else if (activeIndustry === "retail") {
          response = JSON.stringify({
            "d": {
              "results": [
                { "Product": "MAT-301", "ProductName": "Premium Raw Cotton Fiber No.2 (Apparel Grade)", "Category": "Apparel Raw Materials", "UnitPrice": "85.00", "Currency": "USD", "DefaultSupplier": "Vardhman Textiles Ltd" },
                { "Product": "MAT-302", "ProductName": "Recycled Kraft Pulp Paper Rolls (Brown Board)", "Category": "Packaging Materials", "UnitPrice": "42.00", "Currency": "USD", "DefaultSupplier": "Century Pulp & Paper" },
                { "Product": "MAT-303", "ProductName": "PET Plastics Clear Granules (Eco-Bottle Grade)", "Category": "Polymers & Packaging", "UnitPrice": "55.00", "Currency": "USD", "DefaultSupplier": "Reliance Industries Ltd" },
                { "Product": "MAT-305", "ProductName": "Bulk Agricultural Rice & Wheat Grain Stocks", "Category": "Food & Grocery Raw", "UnitPrice": "32.00", "Currency": "USD", "DefaultSupplier": "ITC Foods Agro Division" },
                { "Product": "MAT-307", "ProductName": "Corrugated Double-Wall Shipping Cartons", "Category": "Logistics & Packaging", "UnitPrice": "12.00", "Currency": "USD", "DefaultSupplier": "Nahar Poly Films" }
              ]
            }
          }, null, 2);
        } else {
          response = JSON.stringify({
            "d": {
              "results": [
                { "Product": "MAT-001", "ProductName": "Chassis High-Strength Steel Frame (Swift/Baleno)", "Category": "Body Structures", "UnitPrice": "450.00", "Currency": "USD", "DefaultSupplier": "Tata Steel Automotive Ltd" },
                { "Product": "MAT-002", "ProductName": "High-Voltage Electric Wiring Harness (eVX Series)", "Category": "Electrical Systems", "UnitPrice": "380.00", "Currency": "USD", "DefaultSupplier": "Motherson Sumi Wiring India" },
                { "Product": "MAT-003", "ProductName": "Aluminum Alloy Wheel Castings (Grand Vitara)", "Category": "Chassis & Wheel", "UnitPrice": "120.00", "Currency": "USD", "DefaultSupplier": "Maxion Wheels Holding GmbH" },
                { "Product": "MAT-005", "ProductName": "EV Traction Motor Copper Stator Coils", "Category": "Drivetrain Components", "UnitPrice": "850.00", "Currency": "USD", "DefaultSupplier": "Nidec India Pvt Ltd" },
                { "Product": "MAT-007", "ProductName": "Door Outer Sheet Metal Panels & BIW (Brezza)", "Category": "Body Structures", "UnitPrice": "95.00", "Currency": "USD", "DefaultSupplier": "ArcelorMittal Nippon Steel India" }
              ]
            }
          }, null, 2);
        }
      } else if (queryType === "stocks") {
        const plant1 = activeIndustry === "pharma" ? "PL_MUMBAI_01" : activeIndustry === "retail" ? "PL_NAVI_MUMBAI_01" : "PL_GURUGRAM_01";
        const plant2 = activeIndustry === "pharma" ? "PL_VADODARA_02" : activeIndustry === "retail" ? "PL_BENGALURU_03" : "PL_MANESAR_02";
        const id1 = activeIndustry === "pharma" ? "MAT-201" : activeIndustry === "retail" ? "MAT-301" : "MAT-001";
        const id2 = activeIndustry === "pharma" ? "MAT-202" : activeIndustry === "retail" ? "MAT-302" : "MAT-002";
        const id3 = activeIndustry === "pharma" ? "MAT-203" : activeIndustry === "retail" ? "MAT-303" : "MAT-003";

        response = JSON.stringify({
          "d": {
            "results": [
              { "Material": id1, "Plant": plant1, "InventoryStockQuantity": 5500, "JitOrderedQuantity": 2100, "SafetyStockQuantity": 800 },
              { "Material": id2, "Plant": plant1, "InventoryStockQuantity": 3900, "JitOrderedQuantity": 1200, "SafetyStockQuantity": 500 },
              { "Material": id3, "Plant": plant2, "InventoryStockQuantity": 18500, "JitOrderedQuantity": 4500, "SafetyStockQuantity": 1500 }
            ]
          }
        }, null, 2);
      } else {
        if (activeIndustry === "pharma") {
          response = JSON.stringify({
            "d": {
              "results": [
                { "Symbol": "APIH26 (Futures)", "Underlier": "API Phenol Base", "Exchange": "ChemIndex Glob", "ContractType": "Futures", "CurrentPrice": 2240, "ExpiryDate": "2026-09-30", "LotSize": "10 Metric Tons", "OpenInterest": 4800, "Volume": 950 },
                { "Symbol": "SLVU26 (Futures)", "Underlier": "Organic Solvents", "Exchange": "ChemIndex Glob", "ContractType": "Futures", "CurrentPrice": 1250, "ExpiryDate": "2026-09-15", "LotSize": "5,000 Liters", "OpenInterest": 3100, "Volume": 420 },
                { "Symbol": "ALU3 (3M Futures)", "Underlier": "Aluminum Foil", "Exchange": "LME (London)", "ContractType": "Futures", "CurrentPrice": 2480, "ExpiryDate": "2026-09-16", "LotSize": "25 Metric Tons", "OpenInterest": 168000, "Volume": 24300 },
                { "Symbol": "GLU3 (3M Futures)", "Underlier": "Glass Vials Index", "Exchange": "CME (Chicago)", "ContractType": "Futures", "CurrentPrice": 620, "ExpiryDate": "2026-09-16", "LotSize": "50,000 Units", "OpenInterest": 12000, "Volume": 1800 }
              ]
            }
          }, null, 2);
        } else if (activeIndustry === "retail") {
          response = JSON.stringify({
            "d": {
              "results": [
                { "Symbol": "CTU26 (Futures)", "Underlier": "Cotton No. 2", "Exchange": "ICE (New York)", "ContractType": "Futures", "CurrentPrice": 1820, "ExpiryDate": "2026-09-20", "LotSize": "50,000 lbs", "OpenInterest": 24000, "Volume": 6500 },
                { "Symbol": "PLPU26 (Futures)", "Underlier": "Kraft Pulp & Paper", "Exchange": "Chicago Softs", "ContractType": "Futures", "CurrentPrice": 880, "ExpiryDate": "2026-09-15", "LotSize": "10 Metric Tons", "OpenInterest": 9500, "Volume": 1200 },
                { "Symbol": "PETU26 (Futures)", "Underlier": "PET Packaging Plastics", "Exchange": "Dalian Polymers", "ContractType": "Futures", "CurrentPrice": 1150, "ExpiryDate": "2026-09-18", "LotSize": "5 Metric Tons", "OpenInterest": 18200, "Volume": 3400 },
                { "Symbol": "GRU26 (Futures)", "Underlier": "Agricultural Grains", "Exchange": "CBOT (Chicago)", "ContractType": "Futures", "CurrentPrice": 520, "ExpiryDate": "2026-09-22", "LotSize": "5,000 Bushels", "OpenInterest": 42000, "Volume": 11000 }
              ]
            }
          }, null, 2);
        } else {
          response = JSON.stringify({
            "d": {
              "results": [
                { "Symbol": "HGU26 (Futures)", "Underlier": "Copper", "Exchange": "CME (Chicago)", "ContractType": "Futures", "CurrentPrice": 9710, "ExpiryDate": "2026-09-28", "LotSize": "25,000 lbs", "OpenInterest": 12500, "Volume": 4200 },
                { "Symbol": "HRU26 (Futures)", "Underlier": "Steel", "Exchange": "NYMEX (New York)", "ContractType": "Futures", "CurrentPrice": 755, "ExpiryDate": "2026-09-15", "LotSize": "20 Short Tons", "OpenInterest": 8100, "Volume": 1100 },
                { "Symbol": "ALU3 (3M Futures)", "Underlier": "Aluminum", "Exchange": "LME (London)", "ContractType": "Futures", "CurrentPrice": 2480, "ExpiryDate": "2026-09-16", "LotSize": "25 Metric Tons", "OpenInterest": 168000, "Volume": 24300 },
                { "Symbol": "NIU3 (3M Futures)", "Underlier": "Nickel", "Exchange": "LME (London)", "ContractType": "Futures", "CurrentPrice": 17100, "ExpiryDate": "2026-09-16", "LotSize": "6 Metric Tons", "OpenInterest": 84000, "Volume": 11200 }
              ]
            }
          }, null, 2);
        }
      }

      setSandboxResponse(response);
      setSandboxLogs(prev => [
        ...prev,
        `[SUCCESS] [${new Date().toLocaleTimeString()}] HTTP 200 OK Response retrieved successfully from ${getClientName()} BTP gateway.`,
        `[INFO] [OData Engine] Extracted ${queryType === "materials" ? "5 Material master" : queryType === "stocks" ? "3 Plant inventory" : "4 F&O Derivative"} records successfully. Click write-back to inject into spreadsheet!`
      ]);
      setIsExecutingQuery(false);
      setQueryExecutedSuccessfully(true);
    }, 1200);
  };

  // Write back simulated S/4HANA OData records to local state
  const applySandboxData = () => {
    if (sandboxQuery === "materials") {
      const overridden = materials.map(m => {
        const item = { ...m };
        if (item.id === "MAT-001" || item.id === "MAT-201" || item.id === "MAT-301") { item.unitPrice = activeIndustry === "pharma" ? 120 : activeIndustry === "retail" ? 85 : 450; item.totalValue = item.unitPrice * item.volume; }
        else if (item.id === "MAT-002" || item.id === "MAT-202" || item.id === "MAT-302") { item.unitPrice = activeIndustry === "pharma" ? 65 : activeIndustry === "retail" ? 42 : 380; item.totalValue = item.unitPrice * item.volume; }
        else if (item.id === "MAT-003" || item.id === "MAT-203" || item.id === "MAT-303") { item.unitPrice = activeIndustry === "pharma" ? 45 : activeIndustry === "retail" ? 55 : 120; item.totalValue = item.unitPrice * item.volume; }
        else if (item.id === "MAT-005" || item.id === "MAT-205" || item.id === "MAT-305") { item.unitPrice = activeIndustry === "pharma" ? 85 : activeIndustry === "retail" ? 32 : 850; item.totalValue = item.unitPrice * item.volume; }
        return item;
      });
      onUpdateMaterials(overridden);
      setSandboxLogs(prev => [...prev, `[WRITE-BACK] [${new Date().toLocaleTimeString()}] Injected standard Material Prices from S/4HANA API_PRODUCT_SRV into the spreadsheet.`]);
    } else if (sandboxQuery === "stocks") {
      const overridden = materials.map(m => {
        const item = { ...m };
        if (item.id === "MAT-001" || item.id === "MAT-201" || item.id === "MAT-301") { item.inventoryUsed = 5500; item.inventoryOrdered = 2100; item.inventoryBufferStock = 800; }
        else if (item.id === "MAT-002" || item.id === "MAT-202" || item.id === "MAT-302") { item.inventoryUsed = 3900; item.inventoryOrdered = 1200; item.inventoryBufferStock = 500; }
        else if (item.id === "MAT-003" || item.id === "MAT-203" || item.id === "MAT-303") { item.inventoryUsed = 18500; item.inventoryOrdered = 4500; item.inventoryBufferStock = 1500; }
        else if (item.id === "MAT-004" || item.id === "MAT-204" || item.id === "MAT-304") { item.inventoryUsed = 2200; item.inventoryOrdered = 850; item.inventoryBufferStock = 250; }
        return item;
      });
      onUpdateMaterials(overridden);
      setSandboxLogs(prev => [...prev, `[WRITE-BACK] [${new Date().toLocaleTimeString()}] Injected safety stocks and inventory counts from API_MATERIAL_STOCK_SRV into the spreadsheet.`]);
    } else {
      setSandboxLogs(prev => [...prev, `[WRITE-BACK] [${new Date().toLocaleTimeString()}] Confirmed F&O contracts parameters match with exchange standard pricing sheets.`]);
    }
    setSyncStatus("synced");
  };

  // Render a mock Excel grid column header (A, B, C...)
  const erpCols = [
    { label: "A", name: "ID" },
    { label: "B", name: "Material Name" },
    { label: "C", name: "Vendor" },
    { label: "D", name: "Origin" },
    { label: "E", name: "Unit Price" },
    { label: "F", name: "Demand Volume" },
    { label: "G", name: "Total Value" },
    { label: "H", name: "Used Inventory" },
    { label: "I", name: "Ordered (JIT)" },
    { label: "J", name: "Buffer Stock" }
  ];

  const commCols = [
    { label: "A", name: "Contract Symbol" },
    { label: "B", name: "Underlier Commodity" },
    { label: "C", name: "Exchange Source" },
    { label: "D", name: "Contract Type" },
    { label: "E", name: "Strike Price" },
    { label: "F", name: "Lot Size" },
    { label: "G", name: "Date of Expiry" },
    { label: "H", name: "Last Price (USD)" },
    { label: "I", name: "Open Interest (OI)" },
    { label: "J", name: "24h Volume" }
  ];

  return (
    <div className="space-y-6" id="backend-sheets-root">
      
      {/* Spreadsheet Status & Integration Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800">Unified SAP & Commodity Database Sheet ({getClientName()})</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border font-mono ${
                syncStatus === "synced"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700 animate-pulse"
              }`}>
                {syncStatus === "synced" ? "● Google Sheet Synced" : "● Changes Pending Sync"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Simulated double-direction spreadsheet view. Double-click or click any numeric cells to edit procurement values live and see calculations cascade.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setShowApiDocs(!showApiDocs)}
            className="px-3.5 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            id="btn-toggle-api-docs"
          >
            <Code className="w-3.5 h-3.5 text-indigo-600" />
            {showApiDocs ? "Hide SAP API Guides" : "How to Connect SAP OData?"}
          </button>

          <button
            onClick={handleSyncData}
            disabled={syncing}
            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm border border-emerald-700"
            id="btn-trigger-sheets-sync"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync with Cloud Database"}
          </button>
        </div>
      </div>

      {/* API / SAP Connection Documentation Banner (Conditional) */}
      {showApiDocs && (
        <div className="bg-slate-900 text-slate-100 rounded-xl p-6 border border-slate-800 space-y-6 shadow-md animate-fade-in" id="sap-api-integration-guide">
          
          <div className="flex justify-between items-start border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-400" />
                SAP Sourcing & Stock OData Integration Architecture
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Establish real-time data flows to feed your commodity optimization algorithms from actual SAP S/4HANA or ECC tables.
              </p>
            </div>
            <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
              SAP Gateway Integration
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
            
            {/* Left Column: How to Link SAP Tables */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                1. How to Link SAP Tables in Real-Time
              </h4>
              
              <div className="space-y-3 text-slate-300">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-bold text-white block text-[11px]">Option A: SAP Business Technology Platform (BTP) & Cloud Connector</span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Route secure HTTPS requests through SAP Cloud Connector to expose ECC/S4 tables. BTP Integration Suite maps tables directly to cloud API endpoints or Google Cloud SQL triggers.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-bold text-white block text-[11px]">Option B: SAP OData Gateway Services (Standard / Custom)</span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Define Gateway services in transaction <code className="bg-slate-900 text-rose-400 px-1 py-0.5 rounded font-mono text-[10px]">/IWFND/MAINT_SERVICE</code> to securely expose standard tables like MARA (General Material), MARC (Plant Data), or MBEW (Valuation).
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-bold text-white block text-[11px]">Option C: Google Cloud SDK for SAP</span>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Use Google Cloud's official ABAP SDK inside your SAP system to stream inventory stock (used, buffer, ordered) directly to this database on every Purchase Order release.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Required OData API Entities */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Code className="w-3.5 h-3.5" />
                2. Required OData API Endpoint Specifications
              </h4>

              <div className="space-y-3.5 text-slate-300">
                <p className="text-slate-400">
                  To retrieve the columns modeled in the spreadsheet above, query the standard SAP OData Gateway endpoints using these exact URI structures and selectors:
                </p>

                <div className="space-y-2.5 font-mono text-[10px]">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-emerald-400 font-bold">GET</span> <span className="text-white">/sap/opu/odata/sap/API_PRODUCT_SRV/A_Product</span>
                    <p className="text-slate-400 mt-1 font-sans text-xs">
                      Fetches primary material metadata, names, categories, and manufacturing locations.
                    </p>
                    <code className="text-slate-500 block mt-1.5 text-[9px]">$select=Product,ProductType,BaseUnit,IndustrySector</code>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-emerald-400 font-bold">GET</span> <span className="text-white">/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV/A_MatlStkInAcctgPeriod</span>
                    <p className="text-slate-400 mt-1 font-sans text-xs">
                      Retrieves real-time quantity, JIT ordered supplies, and safe safety/buffer stock thresholds.
                    </p>
                    <code className="text-slate-500 block mt-1.5 text-[9px]">$select=Material,Plant,InventoryStockQuantity,SafetyStockQuantity</code>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-emerald-400 font-bold">GET</span> <span className="text-white">/api/v1/commodity-prices</span>
                    <p className="text-slate-400 mt-1 font-sans text-xs">
                      Exposes third-party or MCP metal pricing API tables (LME and CME Copper, Steel, Aluminum, Nickel).
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Maruti Suzuki OData & MCP Sandbox Terminal Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex flex-col" id="maruti-s4hana-sandbox">
        
        {/* Header Bar */}
        <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-sans">Maruti Suzuki S/4HANA OData & MCP Sandbox</h3>
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  BTP Cloud Connector: Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-sans">
                Interactive mock S/4HANA integration matching your attached technical MCP server guidelines.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMcpIntegrationActive(!mcpIntegrationActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer ${
                mcpIntegrationActive 
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-xs" 
                  : "bg-slate-800 text-slate-500 border border-slate-700 hover:bg-slate-700"
              }`}
              title="Emulates an AI Agent calling MCP tools to synchronize ERP sheets with SAP OData Gateways"
            >
              <Cpu className="w-3.5 h-3.5" />
              {mcpIntegrationActive ? "MCP AI-Agent: Enabled" : "MCP AI-Agent: Disabled"}
            </button>
            <button
              onClick={() => setShowSandbox(!showSandbox)}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer border border-slate-800"
            >
              {showSandbox ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showSandbox && (
          <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-900/90 text-xs">
            
            {/* Left Panel: S/4HANA Connection Controls (Span 5) */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              
              <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800 space-y-3.5">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider font-mono">1. Select S/4HANA Endpoint</span>
                
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-2.5 rounded-md border border-slate-800 hover:border-slate-700 bg-slate-950/40 cursor-pointer transition-colors">
                    <input 
                      type="radio" 
                      name="sandbox-query" 
                      checked={sandboxQuery === "materials"} 
                      onChange={() => { setSandboxQuery("materials"); setSandboxLogs(p => [...p, `[INFO] Changed target query to API_PRODUCT_SRV`]); }}
                      className="mt-1 accent-indigo-500" 
                    />
                    <div>
                      <span className="font-bold text-slate-200 block">API_PRODUCT_SRV (Material Master)</span>
                      <span className="text-slate-400 text-[10px] font-mono block mt-0.5">GET A_Product?$filter=Customer eq 'MARUTI'</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2.5 rounded-md border border-slate-800 hover:border-slate-700 bg-slate-950/40 cursor-pointer transition-colors">
                    <input 
                      type="radio" 
                      name="sandbox-query" 
                      checked={sandboxQuery === "stocks"} 
                      onChange={() => { setSandboxQuery("stocks"); setSandboxLogs(p => [...p, `[INFO] Changed target query to API_MATERIAL_STOCK_SRV`]); }}
                      className="mt-1 accent-indigo-500" 
                    />
                    <div>
                      <span className="font-bold text-slate-200 block">API_MATERIAL_STOCK_SRV (Inventory)</span>
                      <span className="text-slate-400 text-[10px] font-mono block mt-0.5">GET A_MatlStkInAcctgPeriod?$filter=Plant eq 'PL_GURUGRAM_01'</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-2.5 rounded-md border border-slate-800 hover:border-slate-700 bg-slate-950/40 cursor-pointer transition-colors">
                    <input 
                      type="radio" 
                      name="sandbox-query" 
                      checked={sandboxQuery === "contracts"} 
                      onChange={() => { setSandboxQuery("contracts"); setSandboxLogs(p => [...p, `[INFO] Changed target query to ZMARUTI_FO_MARKET_SRV`]); }}
                      className="mt-1 accent-indigo-500" 
                    />
                    <div>
                      <span className="font-bold text-slate-200 block">ZMARUTI_FO_MARKET_SRV (F&O Expiries)</span>
                      <span className="text-slate-400 text-[10px] font-mono block mt-0.5">GET ActiveContracts?$expand=fo_expiries</span>
                    </div>
                  </label>
                </div>
              </div>

              {mcpIntegrationActive && (
                <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 text-indigo-300 rounded-lg flex items-start gap-2.5 font-sans">
                  <Cpu className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-xs text-indigo-200 block">AI-Agent Execution Enabled</span>
                    <p className="text-[11px] text-indigo-300/80 leading-relaxed">
                      Emulates how an AI coding agent triggers standard tools (similar to the <code className="bg-slate-950 px-1 py-0.5 rounded font-mono text-indigo-300">cap-js/mcp-server</code> or <code className="bg-slate-950 px-1 py-0.5 rounded font-mono text-indigo-300">mcp-abap-adt</code> listed in your attachments) to safely read, write, and audit SAP ERP tables without exposing confidential system logs.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 mt-2">
                <button
                  onClick={() => runSandboxQuery(sandboxQuery)}
                  disabled={isExecutingQuery}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer border border-indigo-700"
                >
                  <Play className={`w-3.5 h-3.5 ${isExecutingQuery ? "animate-spin" : ""}`} />
                  {isExecutingQuery ? "Executing..." : "Run Sandbox Query"}
                </button>

                <button
                  onClick={applySandboxData}
                  disabled={!queryExecutedSuccessfully}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    queryExecutedSuccessfully 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm animate-pulse" 
                      : "bg-slate-800 text-slate-500 border-slate-700 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  Write Back to Sheet
                </button>
              </div>

            </div>

            {/* Right Panel: Simulated Developer CLI Output Terminal (Span 7) */}
            <div className="lg:col-span-7 flex flex-col h-[320px] rounded-lg border border-slate-800 bg-slate-950 overflow-hidden shadow-inner">
              
              {/* Terminal Tabs */}
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-950 flex justify-between items-center select-none shrink-0">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-slate-400 font-bold tracking-wider font-mono uppercase flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    Sandbox Terminal Console
                  </span>
                  <div className="h-3.5 w-[1px] bg-slate-800"></div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    S4_MARUTI_API
                  </span>
                </div>
                
                <span className="text-[10px] text-slate-500 font-mono">UTF-8 / JSON</span>
              </div>

              {/* Terminal Screen Container */}
              <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] space-y-3 scrollbar-thin">
                
                {/* Simulated Logs block */}
                <div className="space-y-1.5 text-slate-300">
                  {sandboxLogs.map((log, index) => {
                    let color = "text-slate-300";
                    if (log.startsWith("[SYSTEM]")) color = "text-indigo-400 font-bold";
                    else if (log.startsWith("[AUTH]")) color = "text-amber-400";
                    else if (log.startsWith("[DEST]")) color = "text-blue-400";
                    else if (log.startsWith("[HTTP GET]")) color = "text-indigo-300 font-semibold";
                    else if (log.startsWith("[SUCCESS]")) color = "text-emerald-400 font-bold";
                    else if (log.startsWith("[WRITE-BACK]")) color = "text-cyan-400 font-bold";
                    
                    return (
                      <div key={index} className={`${color} leading-relaxed break-all`}>
                        {log}
                      </div>
                    );
                  })}
                </div>

                {/* Simulated JSON Response Payload */}
                {sandboxResponse && (
                  <div className="mt-4 border-t border-slate-800 pt-3 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5 font-mono">
                      <FileJson className="w-3.5 h-3.5" />
                      Response JSON Output
                    </span>
                    <pre className="bg-slate-900/50 p-2.5 rounded-md border border-slate-800/80 text-emerald-300 text-[10px] overflow-x-auto select-text scrollbar-thin whitespace-pre leading-normal">
                      {sandboxResponse}
                    </pre>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}
      </div>

      {/* Real SAP Table Reference Mapping */}
      <div className="bg-slate-950 p-5 border border-slate-800 rounded-xl space-y-3.5 text-xs text-slate-200" id="sap-table-mapping-bar">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div>
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">ERP S/4HANA Database Catalog Map</span>
            <h4 className="text-xs font-bold text-white mt-0.5">SAP Table Reference Matrix ({activeIndustry === "pharma" ? "Sun Pharmaceutical" : activeIndustry === "retail" ? "Reliance Retail" : "Maruti Suzuki"})</h4>
          </div>
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-mono px-2 py-0.5 rounded shrink-0 self-start sm:self-center">
            Matched 10 SAP Core Entities
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1 text-slate-300 font-mono text-[11px]">
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <span className="text-indigo-400 font-bold block">MARA / MARC</span>
            <span className="text-slate-400 text-[10px]">Material & Plant Master</span>
            <p className="text-[9px] text-slate-500 mt-1">
              {activeIndustry === "pharma" ? "Chemical APIs, Excipients & dosage plants" : activeIndustry === "retail" ? "Apparel fibers, carton pulp & warehouses" : "Chassis steels, wiring, castings & manufacturing plants"}
            </p>
          </div>
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <span className="text-indigo-400 font-bold block">MATDOC / MBEW</span>
            <span className="text-slate-400 text-[10px]">Stock Ledger & Valuation</span>
            <p className="text-[9px] text-slate-500 mt-1">
              {activeIndustry === "pharma" ? "FDA compliance batch trace & API stock book value" : activeIndustry === "retail" ? "Bulk packaging volume & carton unit pricing" : "Steel coil safety stocks & High-Voltage harness weights"}
            </p>
          </div>
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <span className="text-indigo-400 font-bold block">KONH / KONP</span>
            <span className="text-slate-400 text-[10px]">Commodity Condition Rates</span>
            <p className="text-[9px] text-slate-500 mt-1">
              {activeIndustry === "pharma" ? "Base Phenol indexes, solvent premiums & glass surcharges" : activeIndustry === "retail" ? "ICE Cotton tariffs, pulp rates & polymer price indices" : "LME Copper, Steel HRC indexes, rebates & freight metrics"}
            </p>
          </div>
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <span className="text-indigo-400 font-bold block">EKKO / EKPO</span>
            <span className="text-slate-400 text-[10px]">Purchase Headers & Items</span>
            <p className="text-[9px] text-slate-500 mt-1">
              {activeIndustry === "pharma" ? "Active bulk ingredient chemical release orders" : activeIndustry === "retail" ? "Consolidated apparel & retail box supply chains" : "JIT high-volume body panel and wheel casting contracts"}
            </p>
          </div>
          <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
            <span className="text-indigo-400 font-bold block">EINA / EINE</span>
            <span className="text-slate-400 text-[10px]">Purchasing Info Records</span>
            <p className="text-[9px] text-slate-500 mt-1">
              {activeIndustry === "pharma" ? "API manufacturer sourcing links & lead times" : activeIndustry === "retail" ? "Apparel mills, raw fiber sources & bulk logistics" : "Domestic and global mill lead times & pricing formulas"}
            </p>
          </div>
        </div>
      </div>

      {/* Spreadsheet Workspace Wrapper */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col" id="spreadsheet-workspace">
        
        {/* Google Sheet Top Menu Row */}
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 gap-4 overflow-x-auto">
          <div className="flex items-center gap-4 shrink-0 font-medium">
            <span className="text-slate-800 font-bold flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              ProcureSheet_v1.xlsx
            </span>
            <div className="h-4 w-[1px] bg-slate-300"></div>
            <span className="hover:bg-slate-200 px-2 py-1 rounded cursor-pointer transition-colors">File</span>
            <span className="hover:bg-slate-200 px-2 py-1 rounded cursor-pointer transition-colors">Edit</span>
            <span className="hover:bg-slate-200 px-2 py-1 rounded cursor-pointer transition-colors">View</span>
            <span className="hover:bg-slate-200 px-2 py-1 rounded cursor-pointer transition-colors">Insert</span>
            <span className="hover:bg-slate-200 px-2 py-1 rounded cursor-pointer transition-colors">Format</span>
            <span className="hover:bg-slate-200 px-2 py-1 rounded cursor-pointer transition-colors">Data</span>
            <span className="hover:bg-slate-200 px-2 py-1 rounded cursor-pointer transition-colors">Tools</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] text-slate-400 font-mono italic">Formulas auto-calculating</span>
            <div className="flex rounded-md border border-slate-200 bg-white shadow-2xs divide-x divide-slate-100 overflow-hidden text-slate-500">
              <button className="p-1.5 hover:bg-slate-50 cursor-pointer" title="Export CSV"><Download className="w-3.5 h-3.5" /></button>
              <button className="p-1.5 hover:bg-slate-50 cursor-pointer" title="Share Sheet"><Share2 className="w-3.5 h-3.5" /></button>
              <button className="p-1.5 hover:bg-slate-50 cursor-pointer" title="Settings"><Settings className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

        {/* Column Headers Visualizer Bar */}
        <div className="bg-slate-100/50 px-4 py-1.5 border-b border-slate-200 text-[10px] font-mono text-slate-400 flex gap-4 overflow-x-auto select-none items-center">
          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[9px] font-bold">fx Formula Input</span>
          <div className="bg-white px-3 py-1 border border-slate-200 rounded text-slate-700 font-bold shrink-0 min-w-[200px]">
            {selectedCell 
              ? `=CELL("${selectedCell.field}", row: ${materials.findIndex(m => m.id === selectedCell.rowId) + 1})`
              : "Select any cell below to edit raw database contents"
            }
          </div>
        </div>

        {/* Excel Spreadsheet Viewport */}
        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full text-left border-collapse table-fixed select-none">
            
            {/* Column Alphabet Index Header */}
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-center font-mono text-[10px] text-slate-500 h-8">
                <th className="w-10 border-r border-slate-200 bg-slate-100 font-medium select-none"></th>
                {(activeSheet === "erp" ? erpCols : commCols).map((col, idx) => (
                  <th key={idx} className="border-r border-slate-200 font-bold text-center px-2 py-1">
                    <span className="block text-slate-400 text-[9px]">{col.label}</span>
                    <span className="block text-[11px] text-slate-700 font-sans truncate">{col.name}</span>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Grid Cells */}
            <tbody className="divide-y divide-slate-100 text-xs font-mono text-slate-600">
              {activeSheet === "erp" ? (
                /* SHEET 1: ERP MATERIAL DATA AND INVENTORY */
                materials.map((m, rowIdx) => {
                  const isEditingPrice = selectedCell?.rowId === m.id && selectedCell?.field === "unitPrice";
                  const isEditingVolume = selectedCell?.rowId === m.id && selectedCell?.field === "volume";
                  const isEditingUsed = selectedCell?.rowId === m.id && selectedCell?.field === "inventoryUsed";
                  const isEditingOrdered = selectedCell?.rowId === m.id && selectedCell?.field === "inventoryOrdered";
                  const isEditingBuffer = selectedCell?.rowId === m.id && selectedCell?.field === "inventoryBufferStock";

                  return (
                    <tr key={m.id} className="hover:bg-indigo-50/20 group transition-colors h-11">
                      
                      {/* Row number left indicator */}
                      <td className="bg-slate-100/50 text-center text-slate-400 text-[10px] border-r border-slate-200 font-medium select-none w-10 shrink-0">
                        {rowIdx + 1}
                      </td>

                      {/* Column A: ID */}
                      <td className="border-r border-slate-200 px-3 text-slate-500 font-bold text-[10px] truncate">
                        {m.id}
                      </td>

                      {/* Column B: Name */}
                      <td className="border-r border-slate-200 px-3 truncate text-slate-800 font-sans font-medium hover:bg-slate-50 cursor-pointer"
                          onClick={() => handleCellClick(m.id, "name", m.name)}>
                        {selectedCell?.rowId === m.id && selectedCell?.field === "name" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === "Enter" && handleCellSave()}
                            className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 focus:outline-none font-sans text-xs"
                            autoFocus
                          />
                        ) : (
                          m.name
                        )}
                      </td>

                      {/* Column C: Vendor Name */}
                      <td className="border-r border-slate-200 px-3 truncate text-slate-600 font-sans hover:bg-slate-50 cursor-pointer"
                          onClick={() => handleCellClick(m.id, "vendorName", m.vendorName)}>
                        {selectedCell?.rowId === m.id && selectedCell?.field === "vendorName" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === "Enter" && handleCellSave()}
                            className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 focus:outline-none font-sans text-xs"
                            autoFocus
                          />
                        ) : (
                          m.vendorName
                        )}
                      </td>

                      {/* Column D: Vendor Origin Country */}
                      <td className="border-r border-slate-200 px-3 truncate text-slate-600 font-sans">
                        {m.vendorCountry}
                      </td>

                      {/* Column E: Unit Price (USD) */}
                      <td className="border-r border-slate-200 px-3 text-right hover:bg-slate-50 cursor-pointer font-bold text-slate-800"
                          onClick={() => handleCellClick(m.id, "unitPrice", m.unitPrice)}>
                        {isEditingPrice ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === "Enter" && handleCellSave()}
                            className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 text-right focus:outline-none text-xs"
                            autoFocus
                          />
                        ) : (
                          formatUSD(m.unitPrice)
                        )}
                      </td>

                      {/* Column F: Demand Volume */}
                      <td className="border-r border-slate-200 px-3 text-right hover:bg-slate-50 cursor-pointer text-slate-700"
                          onClick={() => handleCellClick(m.id, "volume", m.volume)}>
                        {isEditingVolume ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === "Enter" && handleCellSave()}
                            className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 text-right focus:outline-none text-xs"
                            autoFocus
                          />
                        ) : (
                          m.volume.toLocaleString()
                        )}
                      </td>

                      {/* Column G: Total Value (Formula Auto-Calculated) */}
                      <td className="border-r border-slate-200 px-3 text-right font-bold text-indigo-700 bg-slate-50/30">
                        {formatUSD(m.totalValue)}
                      </td>

                      {/* Column H: Used Inventory (ERP Data) */}
                      <td className="border-r border-slate-200 px-3 text-right hover:bg-slate-50 cursor-pointer text-slate-600 font-medium"
                          onClick={() => handleCellClick(m.id, "inventoryUsed", m.inventoryUsed || 0)}>
                        {isEditingUsed ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === "Enter" && handleCellSave()}
                            className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 text-right focus:outline-none text-xs"
                            autoFocus
                          />
                        ) : (
                          (m.inventoryUsed || 0).toLocaleString()
                        )}
                      </td>

                      {/* Column I: Ordered (JIT Procurement) */}
                      <td className="border-r border-slate-200 px-3 text-right hover:bg-slate-50 cursor-pointer text-orange-600 font-medium"
                          onClick={() => handleCellClick(m.id, "inventoryOrdered", m.inventoryOrdered || 0)}>
                        {isEditingOrdered ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === "Enter" && handleCellSave()}
                            className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 text-right focus:outline-none text-xs"
                            autoFocus
                          />
                        ) : (
                          (m.inventoryOrdered || 0).toLocaleString()
                        )}
                      </td>

                      {/* Column J: Buffer Stock / Safety Stock */}
                      <td className="border-r border-slate-200 px-3 text-right hover:bg-slate-50 cursor-pointer text-emerald-600 font-semibold"
                          onClick={() => handleCellClick(m.id, "inventoryBufferStock", m.inventoryBufferStock || 0)}>
                        {isEditingBuffer ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellSave}
                            onKeyDown={(e) => e.key === "Enter" && handleCellSave()}
                            className="w-full bg-white border border-indigo-500 rounded px-1.5 py-0.5 text-right focus:outline-none text-xs"
                            autoFocus
                          />
                        ) : (
                          (m.inventoryBufferStock || 0).toLocaleString()
                        )}
                      </td>

                    </tr>
                  );
                })
              ) : (
                /* SHEET 2: GLOBAL COMMODITY F&O CONTRACT EXCH (API FEED) */
                allFoContracts.map((fo, rowIdx) => {
                  return (
                    <tr key={`${fo.symbol}-${rowIdx}`} className="hover:bg-indigo-50/20 transition-colors h-11">
                      
                      {/* Row index */}
                      <td className="bg-slate-100/50 text-center text-slate-400 text-[10px] border-r border-slate-200 font-medium select-none w-10 shrink-0">
                        {rowIdx + 1}
                      </td>

                      {/* Column A: Contract Symbol */}
                      <td className="border-r border-slate-200 px-3 text-indigo-600 font-bold font-mono">
                        {fo.symbol}
                      </td>

                      {/* Column B: Underlier Commodity */}
                      <td className="border-r border-slate-200 px-3 text-slate-800 font-sans font-semibold">
                        {fo.underlier}
                      </td>

                      {/* Column C: Exchange Source */}
                      <td className="border-r border-slate-200 px-3 text-slate-600 font-sans">
                        {fo.exchange}
                      </td>

                      {/* Column D: Contract Type */}
                      <td className="border-r border-slate-200 px-3 text-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                          fo.contractType === "Futures" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"
                        }`}>
                          {fo.contractType}
                        </span>
                      </td>

                      {/* Column E: Strike Price */}
                      <td className="border-r border-slate-200 px-3 text-right text-slate-600 font-semibold">
                        {fo.strikePrice ? `$${fo.strikePrice.toLocaleString()}` : "—"}
                      </td>

                      {/* Column F: Lot Size */}
                      <td className="border-r border-slate-200 px-3 text-slate-600">
                        {fo.lotSize}
                      </td>

                      {/* Column G: Date of Expiry */}
                      <td className="border-r border-slate-200 px-3 text-center font-bold text-rose-600">
                        {fo.expiryDate}
                      </td>

                      {/* Column H: Last Price */}
                      <td className="border-r border-slate-200 px-3 text-right text-slate-900 font-bold">
                        ${fo.currentPrice.toLocaleString()}
                      </td>

                      {/* Column I: Open Interest */}
                      <td className="border-r border-slate-200 px-3 text-right text-emerald-600 font-semibold">
                        {fo.openInterest.toLocaleString()}
                      </td>

                      {/* Column J: 24h Volume */}
                      <td className="border-r border-slate-200 px-3 text-right text-slate-600">
                        {fo.volume.toLocaleString()}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

          </table>
        </div>

        {/* Google Sheet Bottom Tabs Selector */}
        <div className="bg-slate-100 px-4 py-2 border-t border-slate-200 flex items-center gap-1 overflow-x-auto text-xs font-semibold text-slate-600">
          
          <button
            onClick={() => setActiveSheet("erp")}
            className={`px-4 py-1.5 rounded-t-md flex items-center gap-2 border-x border-t transition-all cursor-pointer ${
              activeSheet === "erp"
                ? "bg-white border-slate-200 text-emerald-700 font-bold"
                : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            Sheet 1: ERP Materials Inventory Logs (Editable)
          </button>

          <button
            onClick={() => setActiveSheet("commodities")}
            className={`px-4 py-1.5 rounded-t-md flex items-center gap-2 border-x border-t transition-all cursor-pointer ${
              activeSheet === "commodities"
                ? "bg-white border-slate-200 text-indigo-700 font-bold"
                : "bg-slate-50 border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
            Sheet 2: Global Commodity F&O Contracts (Live Expiries)
          </button>

        </div>

      </div>

      {/* Database View Callouts & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="backend-sheets-callouts">
        
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs">
            <Info className="w-4 h-4" />
            Formula Cascading Mode
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Changing **Demand Volume** or **Unit Price** automatically updates column **G (Total Value)**. These values feed directly back into the Commodity Dashboard's active charts and weighted commodity impacts!
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-orange-600 font-bold text-xs">
            <AlertCircle className="w-4 h-4" />
            Real ERP Correlation
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            This sheet models standard enterprise inventory parameters: **Used Inventory** representing raw consumption rates, **Ordered Inventory** capturing JIT pipelines, and **Buffer Stock** ensuring safe procurement thresholds.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4.5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
            <Check className="w-4 h-4" />
            Cloud Database Write-Back
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            All modifications in this browser interface are stored in local storage state and synchronized seamlessly to the cloud server, preserving changes across simulator trials.
          </p>
        </div>

      </div>

    </div>
  );
}
