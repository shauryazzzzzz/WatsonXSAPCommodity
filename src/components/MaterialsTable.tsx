import React, { useState } from "react";
import { Material } from "../types";
import { Search, Eye, Edit2, Cpu, Check, HelpCircle } from "lucide-react";

interface MaterialsTableProps {
  materials: Material[];
  onUpdateMaterial: (updated: Material) => void;
  selectedMaterialId: string | null;
  onSelectMaterial: (id: string | null) => void;
}

export default function MaterialsTable({
  materials,
  onUpdateMaterial,
  selectedMaterialId,
  onSelectMaterial
}: MaterialsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Local edit states
  const [editCopper, setEditCopper] = useState(0);
  const [editSteel, setEditSteel] = useState(0);
  const [editAluminum, setEditAluminum] = useState(0);
  const [editNickel, setEditNickel] = useState(0);
  const [editOther, setEditOther] = useState(0);

  const startEditing = (mat: Material) => {
    setEditingId(mat.id);
    setEditCopper(mat.commodityWeights.copper);
    setEditSteel(mat.commodityWeights.steel);
    setEditAluminum(mat.commodityWeights.aluminum);
    setEditNickel(mat.commodityWeights.nickel);
    setEditOther(mat.commodityWeights.other);
  };

  const saveEdit = (mat: Material) => {
    // Ensure sum <= 100
    const sum = editCopper + editSteel + editAluminum + editNickel;
    const finalOther = Math.max(0, 100 - sum);

    onUpdateMaterial({
      ...mat,
      commodityWeights: {
        copper: editCopper,
        steel: editSteel,
        aluminum: editAluminum,
        nickel: editNickel,
        other: finalOther
      }
    });
    setEditingId(null);
  };

  const filtered = materials.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.vendorCountry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatUSD = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden" id="materials-panel">
      {/* Search Header */}
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h3 className="text-base font-bold text-slate-800">SAP Material Master & BOM Mapping</h3>
          <p className="text-xs text-slate-500 mt-1">
            Configure composition weightages. These direct how changes in exchange prices impact overall pricing.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Search material, ID, category or vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
          />
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 xl:grid-cols-12">
        {/* Table View (8/12 cols) */}
        <div className="xl:col-span-8 overflow-x-auto border-r border-slate-200">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200 font-semibold font-mono">
                <th className="py-3.5 px-4">Material details</th>
                <th className="py-3.5 px-4">Procurement volume / price</th>
                <th className="py-3.5 px-4">Commodity sub-weightage breakdown</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400">
                    No materials found matching search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((mat) => {
                  const isSelected = selectedMaterialId === mat.id;
                  return (
                    <tr
                      key={mat.id}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isSelected ? "bg-indigo-50/30 hover:bg-indigo-50/40 border-l-2 border-l-indigo-600" : ""
                      }`}
                    >
                      {/* Name / ID / Category */}
                      <td className="py-4 px-4 max-w-xs">
                        <div className="font-mono text-[11px] font-bold text-indigo-600 flex items-center gap-1.5">
                          {mat.id}
                          {mat.isAiMapped && (
                            <span 
                              className="bg-purple-50 text-purple-700 border border-purple-200 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 font-bold" 
                              title={mat.isAiMapped ? "AI Mapping Estimated via Gemini: " + (mat as any).mappingExplanation : ""}
                            >
                              <Cpu className="w-2.5 h-2.5" />
                              AI Mapped
                            </span>
                          )}
                        </div>
                        <div className="font-semibold text-slate-800 mt-1 leading-snug">{mat.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-1 font-medium">
                          <span>{mat.category}</span>
                          <span>•</span>
                          <span>{mat.vendorName} ({mat.vendorCountry})</span>
                        </div>
                      </td>

                      {/* Spend / Price */}
                      <td className="py-4 px-4 font-mono">
                        <div className="text-slate-800 font-bold text-sm">{formatUSD(mat.volume * mat.unitPrice)}</div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {mat.volume.toLocaleString()} {mat.category === "Cables" ? "m" : mat.category === "Structures" ? "tons" : "units"} @ {formatUSD(mat.unitPrice)}
                        </div>
                      </td>

                      {/* Composition Bar */}
                      <td className="py-4 px-4 min-w-[180px]">
                        <div className="space-y-1.5">
                          {/* Segmented Bar */}
                          <div className="h-2 rounded-full overflow-hidden bg-slate-100 flex border border-slate-200">
                            {mat.commodityWeights.copper > 0 && (
                              <div
                                style={{ width: `${mat.commodityWeights.copper}%` }}
                                className="bg-orange-500 h-full"
                                title={`Copper: ${mat.commodityWeights.copper}%`}
                              />
                            )}
                            {mat.commodityWeights.steel > 0 && (
                              <div
                                style={{ width: `${mat.commodityWeights.steel}%` }}
                                className="bg-slate-400 h-full"
                                title={`Steel: ${mat.commodityWeights.steel}%`}
                              />
                            )}
                            {mat.commodityWeights.aluminum > 0 && (
                              <div
                                style={{ width: `${mat.commodityWeights.aluminum}%` }}
                                className="bg-sky-400 h-full"
                                title={`Aluminum: ${mat.commodityWeights.aluminum}%`}
                              />
                            )}
                            {mat.commodityWeights.nickel > 0 && (
                              <div
                                style={{ width: `${mat.commodityWeights.nickel}%` }}
                                className="bg-purple-500 h-full"
                                title={`Nickel: ${mat.commodityWeights.nickel}%`}
                              />
                            )}
                            {mat.commodityWeights.other > 0 && (
                              <div
                                style={{ width: `${mat.commodityWeights.other}%` }}
                                className="bg-slate-200 h-full"
                                title={`Other: ${mat.commodityWeights.other}%`}
                              />
                            )}
                          </div>
                          
                          {/* Legend Values */}
                          <div className="flex flex-wrap gap-x-2 text-[10px] font-mono font-bold">
                            {mat.commodityWeights.copper > 0 && <span className="text-orange-600">Cu:{mat.commodityWeights.copper}%</span>}
                            {mat.commodityWeights.steel > 0 && <span className="text-slate-500">Fe:{mat.commodityWeights.steel}%</span>}
                            {mat.commodityWeights.aluminum > 0 && <span className="text-sky-600">Al:{mat.commodityWeights.aluminum}%</span>}
                            {mat.commodityWeights.nickel > 0 && <span className="text-purple-600">Ni:{mat.commodityWeights.nickel}%</span>}
                          </div>
                        </div>
                      </td>

                      {/* Edit Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onSelectMaterial(isSelected ? null : mat.id)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isSelected 
                                ? "bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm"
                                : "text-slate-500 hover:text-indigo-600 border-slate-200 bg-white hover:bg-slate-50 shadow-sm"
                            }`}
                            title="Inspect geopolitical vendor and details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          
                          <button
                            onClick={() => startEditing(mat)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
                            title="Edit raw material composition override"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Edit/Inspect Panel (4/12 cols) */}
        <div className="xl:col-span-4 p-5 bg-slate-50/50 flex flex-col justify-between border-l border-slate-100" id="material-inspect-sidebar">
          {editingId ? (
            // Customizer / Edit Mode
            <div className="space-y-5 animate-fade-in">
              {(() => {
                const mat = materials.find(m => m.id === editingId)!;
                const totalWeights = editCopper + editSteel + editAluminum + editNickel;
                const calculatedOther = Math.max(0, 100 - totalWeights);

                return (
                  <>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-600">{mat.id}</span>
                      <h4 className="text-sm font-bold text-slate-800 mt-0.5 leading-tight">{mat.name}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">Custom Design Composition override</p>
                    </div>

                    <div className="space-y-4 pt-2">
                      {/* Copper Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-orange-600">Copper Weight %</span>
                          <span className="font-mono text-slate-700">{editCopper}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editCopper}
                          onChange={(e) => setEditCopper(parseInt(e.target.value))}
                          className="w-full accent-orange-500 bg-slate-200 h-1 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Steel Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-600">Steel Weight %</span>
                          <span className="font-mono text-slate-700">{editSteel}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editSteel}
                          onChange={(e) => setEditSteel(parseInt(e.target.value))}
                          className="w-full accent-slate-400 bg-slate-200 h-1 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Aluminum Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-sky-600">Aluminum Weight %</span>
                          <span className="font-mono text-slate-700">{editAluminum}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editAluminum}
                          onChange={(e) => setEditAluminum(parseInt(e.target.value))}
                          className="w-full accent-sky-400 bg-slate-200 h-1 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Nickel Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-purple-600">Nickel Weight %</span>
                          <span className="font-mono text-slate-700">{editNickel}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={editNickel}
                          onChange={(e) => setEditNickel(parseInt(e.target.value))}
                          className="w-full accent-purple-500 bg-slate-200 h-1 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-100 flex justify-between items-center text-xs shadow-sm">
                        <span className="text-slate-400 font-semibold">Other Sub-components (automatic)</span>
                        <span className="font-mono font-bold text-slate-700">{calculatedOther}%</span>
                      </div>

                      {totalWeights > 100 && (
                        <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                          ⚠️ Proportions sum exceeds 100% ({totalWeights}%). Please lower rates to fit total space.
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-3">
                      <button
                        onClick={() => saveEdit(mat)}
                        disabled={totalWeights > 100}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-lg transition-colors cursor-pointer flex justify-center items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Apply Custom override
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : selectedMaterialId ? (
            // Inspect Mode
            <div className="space-y-5 animate-fade-in">
              {(() => {
                const mat = materials.find(m => m.id === selectedMaterialId)!;
                const spend = mat.volume * mat.unitPrice;

                return (
                  <>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase">Material Inspector</span>
                      <h4 className="text-sm font-bold text-slate-800 mt-1 leading-tight">{mat.name}</h4>
                    </div>

                    <div className="space-y-4 pt-1 text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Annual Spend</p>
                          <p className="text-sm font-bold text-slate-800 mt-0.5 font-mono">{formatUSD(spend)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Unit Cost</p>
                          <p className="text-sm font-bold text-slate-800 mt-0.5 font-mono">{formatUSD(mat.unitPrice)}</p>
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Sourcing & Supplier Logistics</p>
                        <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 font-semibold">Contractor:</span>
                            <p className="text-slate-700 font-bold truncate">{mat.vendorName}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold">Origin Location:</span>
                            <p className="text-slate-700 font-bold">{mat.vendorCountry}</p>
                          </div>
                        </div>
                      </div>

                      {mat.isAiMapped && (
                        <div className="bg-purple-50 p-3.5 rounded-lg border border-purple-200 space-y-1">
                          <p className="text-[10px] text-purple-700 font-mono font-bold flex items-center gap-1">
                            <Cpu className="w-3.5 h-3.5 text-purple-600" />
                            GEMINI AI SPECIFICATION MAPPING
                          </p>
                          <p className="text-[11px] text-purple-800 italic leading-relaxed">
                            "{(mat as any).mappingExplanation || "Intelligently analyzed using the mechanical specifications for heavy utility components."}"
                          </p>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Absolute Metal Mass Share</p>
                        <div className="space-y-1 text-[11px] font-mono">
                          <div className="flex justify-between text-orange-600 font-semibold">
                            <span>Copper Exposure value:</span>
                            <span>{formatUSD(spend * (mat.commodityWeights.copper / 100))} ({mat.commodityWeights.copper}%)</span>
                          </div>
                          <div className="flex justify-between text-slate-500 font-semibold">
                            <span>Steel Exposure value:</span>
                            <span>{formatUSD(spend * (mat.commodityWeights.steel / 100))} ({mat.commodityWeights.steel}%)</span>
                          </div>
                          <div className="flex justify-between text-sky-600 font-semibold">
                            <span>Aluminum Exposure value:</span>
                            <span>{formatUSD(spend * (mat.commodityWeights.aluminum / 100))} ({mat.commodityWeights.aluminum}%)</span>
                          </div>
                          <div className="flex justify-between text-purple-600 font-semibold">
                            <span>Nickel Exposure value:</span>
                            <span>{formatUSD(spend * (mat.commodityWeights.nickel / 100))} ({mat.commodityWeights.nickel}%)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectMaterial(null)}
                      className="w-full bg-slate-200 hover:bg-slate-300 text-xs text-slate-700 font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
                    >
                      Close Inspector
                    </button>
                  </>
                );
              })()}
            </div>
          ) : (
            // Idle State
            <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400 space-y-3">
              <div className="w-10 h-10 rounded-full border border-dashed border-slate-200 flex items-center justify-center text-slate-300 bg-white">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500">Inspect Sourcing Details</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                  Click the eye icon on any material row to review sub-assembly allocations, vendor risks, and exact AI specification mappings.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
