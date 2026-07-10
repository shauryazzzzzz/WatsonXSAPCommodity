import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, RefreshCw } from "lucide-react";
import { Material } from "../types";

interface UploadZoneProps {
  onMaterialsLoaded: (materials: Material[], source: "uploaded" | "default") => void;
  onStartAnalysis: () => void;
  onEndAnalysis: () => void;
  isAnalyzing: boolean;
}

export default function UploadZone({
  onMaterialsLoaded,
  onStartAnalysis,
  onEndAnalysis,
  isAnalyzing
}: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to generate and download a sample excel template
  const downloadTemplate = () => {
    const templateData = [
      {
        "Material ID": "MAT-EXT-101",
        "Material Name": "Power Grid Transformer Coil 250kVA",
        "Category": "Transformers",
        "Unit Price (USD)": 38000,
        "Annual Volume": 15,
        "Vendor Name": "Nexans Sourcing Ltd",
        "Vendor Country": "France",
        "Copper %": 60,
        "Steel %": 25,
        "Aluminum %": 5,
        "Nickel %": 0
      },
      {
        "Material ID": "MAT-EXT-102",
        "Material Name": "High-Capacitor Turbine Rotor Axle",
        "Category": "Generators",
        "Unit Price (USD)": 145000,
        "Annual Volume": 3,
        "Vendor Name": "Harbin Electric Corp",
        "Vendor Country": "China",
        "Copper %": 15,
        "Steel %": 70,
        "Aluminum %": 5,
        "Nickel %": 5
      },
      {
        "Material ID": "MAT-EXT-103",
        "Material Name": "Substation Grounding Busbar Copper",
        "Category": "Cables",
        "Unit Price (USD)": 450,
        "Annual Volume": 120,
        "Vendor Name": "Aurubis AG",
        "Vendor Country": "Germany",
        "Copper %": 90,
        "Steel %": 0,
        "Aluminum %": 5,
        "Nickel %": 0
      },
      {
        "Material ID": "MAT-EXT-104",
        "Material Name": "Structural Support Steel Brackets",
        "Category": "Structures",
        "Unit Price (USD)": 1250,
        "Annual Volume": 200,
        "Vendor Name": "Tata Steel Europe",
        "Vendor Country": "Netherlands",
        "Copper %": 0,
        "Steel %": 95,
        "Aluminum %": 0,
        "Nickel %": 0
      },
      {
        "Material ID": "MAT-EXT-105",
        "Material Name": "Power Cooling Radiator Fin (No Weights - Test AI Mapping)",
        "Category": "Cooling Systems",
        "Unit Price (USD)": 7500,
        "Annual Volume": 25,
        "Vendor Name": "Valeo S.A.",
        "Vendor Country": "Brazil"
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SAP Master Data");
    XLSX.writeFile(workbook, "SAP_Material_Commodity_Template.xlsx");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    onStartAnalysis();
    setUploadStatus(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (!rawJson || rawJson.length === 0) {
          throw new Error("The uploaded sheet is empty.");
        }

        // Standardize the Excel headers into Material objects
        const uploadedMaterials: Material[] = rawJson.map((row, index) => {
          const id = String(row["Material ID"] || row["ID"] || row["MaterialNo"] || `MAT-UP-${index + 1}`);
          const name = String(row["Material Name"] || row["Description"] || row["Name"] || `Unnamed Material ${index + 1}`);
          const category = String(row["Category"] || "Other Components");
          const unitPrice = Number(row["Unit Price (USD)"] || row["UnitPrice"] || row["Price"] || 100);
          const volume = Number(row["Annual Volume"] || row["Annual Quantity"] || row["Volume"] || row["Qty"] || 1);
          const vendorName = String(row["Vendor Name"] || row["Vendor"] || "Unknown Sourcing");
          const vendorCountry = String(row["Vendor Country"] || row["Country"] || row["Location"] || "Global");

          // Check if weights are provided, otherwise leave undefined for AI mapping
          const copper = row["Copper %"] !== undefined ? Number(row["Copper %"]) : undefined;
          const steel = row["Steel %"] !== undefined ? Number(row["Steel %"]) : undefined;
          const aluminum = row["Aluminum %"] !== undefined ? Number(row["Aluminum %"]) : undefined;
          const nickel = row["Nickel %"] !== undefined ? Number(row["Nickel %"]) : undefined;

          // If weights are provided, pack them. Else, default to empty so server can enrich.
          const weightsSpecified = [copper, steel, aluminum, nickel].some(w => w !== undefined);

          return {
            id,
            name,
            category,
            unitPrice,
            currency: "USD",
            volume,
            totalValue: unitPrice * volume,
            vendorName,
            vendorCountry,
            commodityWeights: weightsSpecified ? {
              copper: copper || 0,
              steel: steel || 0,
              aluminum: aluminum || 0,
              nickel: nickel || 0,
              other: Math.max(0, 100 - (copper || 0) - (steel || 0) - (aluminum || 0) - (nickel || 0))
            } : { copper: 0, steel: 0, aluminum: 0, nickel: 0, other: 100 },
            isAiMapped: !weightsSpecified // true means we need AI to map it
          } as Material;
        });

        // Split into already-mapped and materials that require AI estimation
        const needsAiEstimation = uploadedMaterials.filter(m => m.isAiMapped);
        const alreadyMapped = uploadedMaterials.filter(m => !m.isAiMapped);

        let finalMaterialsList: Material[] = [];

        if (needsAiEstimation.length > 0) {
          // Send to server to estimate compositions using Gemini
          const response = await fetch("/api/analyze-boms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ materials: needsAiEstimation })
          });

          if (!response.ok) {
            throw new Error("Failed to correlate material compositions with Gemini API.");
          }

          const estimatedMaterials: Material[] = await response.json();
          finalMaterialsList = [...alreadyMapped, ...estimatedMaterials];
        } else {
          finalMaterialsList = uploadedMaterials;
        }

        onMaterialsLoaded(finalMaterialsList, "uploaded");
        setUploadStatus({
          type: "success",
          message: `Successfully loaded ${finalMaterialsList.length} materials from spreadsheet. ${needsAiEstimation.length > 0 ? `${needsAiEstimation.length} materials mapped via Gemini AI.` : ""}`
        });
      } catch (err: any) {
        console.error(err);
        setUploadStatus({
          type: "error",
          message: err.message || "Error reading spreadsheet. Make sure it matches our template structure."
        });
      } finally {
        onEndAnalysis();
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6" id="upload-panel">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            SAP Master Data Sourcing
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Upload SAP Material Master / Bill of Materials (BOM) Excel lists to map raw commodity weights.
          </p>
        </div>

        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-4 py-2 transition-all cursor-pointer shadow-sm"
          title="Download sample Excel template to feed the advisor"
          id="btn-download-template"
        >
          <Download className="w-3.5 h-3.5" />
          Download Excel Template
        </button>
      </div>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
          dragActive
            ? "border-indigo-500 bg-indigo-50/50"
            : "border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50"
        }`}
        id="drag-drop-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          className="hidden"
          onChange={handleFileChange}
        />

        {isAnalyzing ? (
          <div className="flex flex-col items-center py-2">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-800">Analyzing Material Specs...</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md text-center">
              Gemini AI is parsing technical material descriptions to intelligently estimate Copper, Steel, and Aluminum weights.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-2 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-3 text-indigo-600 border border-indigo-100">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Drag & drop your Excel file here, or <span className="text-indigo-600 hover:underline">browse</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports .xlsx, .xls, and .csv files. Missing commodity percentages will be estimated by AI.
            </p>
          </div>
        )}
      </div>

      {uploadStatus && (
        <div
          className={`mt-4 p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
            uploadStatus.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
          id="upload-status-alert"
        >
          {uploadStatus.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <div>
            <span className="font-semibold">{uploadStatus.type === "success" ? "Upload Completed: " : "Upload Failed: "}</span>
            {uploadStatus.message}
          </div>
        </div>
      )}
    </div>
  );
}
