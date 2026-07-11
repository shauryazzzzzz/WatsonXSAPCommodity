import React from "react";
import { Sliders, RotateCcw, AlertTriangle, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Material, CommodityMarket } from "../types";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface SimulationControlsProps {
  materials: Material[];
  commodities: CommodityMarket[];
  rates: { copper: number; steel: number; aluminum: number; nickel: number };
  onRateChange: (rates: { copper: number; steel: number; aluminum: number; nickel: number }) => void;
  industry?: string;
}

export default function SimulationControls({
  materials,
  commodities,
  rates,
  onRateChange,
  industry = "automobile"
}: SimulationControlsProps) {

  // Dynamic names
  const getCommodityName = (id: "copper" | "steel" | "aluminum" | "nickel") => {
    const found = commodities.find(c => c.id === id);
    if (found) return found.name;
    // fallback
    if (id === "copper") return "Copper (LME)";
    if (id === "steel") return "Steel HRC (NYMEX)";
    if (id === "aluminum") return "Aluminum (LME)";
    if (id === "nickel") return "Nickel (LME)";
    return id;
  };

  // Calculate exposures
  let totalPortfolioValue = 0;
  let copperExposure = 0;
  let steelExposure = 0;
  let aluminumExposure = 0;
  let nickelExposure = 0;
  let otherExposure = 0;

  materials.forEach((m) => {
    const val = m.volume * m.unitPrice;
    totalPortfolioValue += val;
    copperExposure += val * ((m.commodityWeights?.copper || 0) / 100);
    steelExposure += val * ((m.commodityWeights?.steel || 0) / 100);
    aluminumExposure += val * ((m.commodityWeights?.aluminum || 0) / 100);
    nickelExposure += val * ((m.commodityWeights?.nickel || 0) / 100);
    otherExposure += val * ((m.commodityWeights?.other || 0) / 100);
  });

  // Calculate simulated increases
  const copperDelta = copperExposure * (rates.copper / 100);
  const steelDelta = steelExposure * (rates.steel / 100);
  const aluminumDelta = aluminumExposure * (rates.aluminum / 100);
  const nickelDelta = nickelExposure * (rates.nickel / 100);
  const totalDelta = copperDelta + steelDelta + aluminumDelta + nickelDelta;
  const simulatedPortfolioValue = totalPortfolioValue + totalDelta;
  const percentageImpact = (totalDelta / totalPortfolioValue) * 100;

  const handleSliderChange = (commodity: "copper" | "steel" | "aluminum" | "nickel", val: number) => {
    onRateChange({
      ...rates,
      [commodity]: val
    });
  };

  const handleReset = () => {
    onRateChange({ copper: 0, steel: 0, aluminum: 0, nickel: 0 });
  };

  // Pie chart data
  const pieData = [
    { name: `${getCommodityName("copper")} Exposure`, value: copperExposure, color: "#f97316" }, // amber
    { name: `${getCommodityName("steel")} Exposure`, value: steelExposure, color: "#64748b" }, // slate
    { name: `${getCommodityName("aluminum")} Exposure`, value: aluminumExposure, color: "#38bdf8" }, // sky
    { name: `${getCommodityName("nickel")} Exposure`, value: nickelExposure, color: "#a855f7" }, // purple
    { name: "Other Sub-assemblies", value: otherExposure, color: "#1e293b" } // dark slate
  ].filter(item => item.value > 0);

  // Formatter for currency
  const formatUSD = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6" id="simulation-panel">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Sliders className="w-5 h-5 text-indigo-600" />
          SAP Procurement Cost Simulator
        </h2>
        {(rates.copper !== 0 || rates.steel !== 0 || rates.aluminum !== 0 || rates.nickel !== 0) && (
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            id="btn-reset-simulation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Rates
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sliders (7 columns) */}
        <div className="lg:col-span-7 space-y-5">
          <p className="text-xs text-slate-500 leading-relaxed">
            Simulate a percentage fluctuation in raw commodity traded values and observe the weighted financial impacts across your procurement portfolio.
          </p>

          {/* Copper Slider */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100" id="slider-group-copper">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-orange-600 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                {getCommodityName("copper")} Adjuster
              </span>
              <span className={`text-xs font-bold font-mono ${rates.copper > 0 ? "text-rose-600" : rates.copper < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                {rates.copper > 0 ? "+" : ""}{rates.copper}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={rates.copper}
              onChange={(e) => handleSliderChange("copper", parseInt(e.target.value))}
              className="w-full accent-orange-500 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>-50% Bearish</span>
              <span>Baseline</span>
              <span>+50% Spike</span>
            </div>
          </div>

          {/* Steel Slider */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100" id="slider-group-steel">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                {getCommodityName("steel")} Adjuster
              </span>
              <span className={`text-xs font-bold font-mono ${rates.steel > 0 ? "text-rose-600" : rates.steel < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                {rates.steel > 0 ? "+" : ""}{rates.steel}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={rates.steel}
              onChange={(e) => handleSliderChange("steel", parseInt(e.target.value))}
              className="w-full accent-slate-500 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>-50% Bearish</span>
              <span>Baseline</span>
              <span>+50% Spike</span>
            </div>
          </div>

          {/* Aluminum Slider */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100" id="slider-group-aluminum">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-sky-600 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                {getCommodityName("aluminum")} Adjuster
              </span>
              <span className={`text-xs font-bold font-mono ${rates.aluminum > 0 ? "text-rose-600" : rates.aluminum < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                {rates.aluminum > 0 ? "+" : ""}{rates.aluminum}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={rates.aluminum}
              onChange={(e) => handleSliderChange("aluminum", parseInt(e.target.value))}
              className="w-full accent-sky-500 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>-50% Bearish</span>
              <span>Baseline</span>
              <span>+50% Spike</span>
            </div>
          </div>

          {/* Nickel Slider */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100" id="slider-group-nickel">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-purple-600 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                {getCommodityName("nickel")} Adjuster
              </span>
              <span className={`text-xs font-bold font-mono ${rates.nickel > 0 ? "text-rose-600" : rates.nickel < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                {rates.nickel > 0 ? "+" : ""}{rates.nickel}%
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              value={rates.nickel}
              onChange={(e) => handleSliderChange("nickel", parseInt(e.target.value))}
              className="w-full accent-purple-500 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>-50% Bearish</span>
              <span>Baseline</span>
              <span>+50% Spike</span>
            </div>
          </div>
        </div>

        {/* Real-time Calculation Panel (5 columns) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Portfolio Financial Impact</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500">Simulated Spend Outlook</p>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold text-slate-800 font-mono">{formatUSD(simulatedPortfolioValue)}</span>
                  <span className="text-xs text-slate-500 font-mono">USD</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Variance Amount</p>
                  <p className={`text-sm font-bold font-mono flex items-center gap-1 mt-0.5 ${
                    totalDelta > 0 ? "text-rose-600" : totalDelta < 0 ? "text-emerald-600" : "text-slate-500"
                  }`}>
                    {totalDelta > 0 ? "+" : ""}{formatUSD(totalDelta)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Spend Variance %</p>
                  <p className={`text-sm font-bold font-mono flex items-center gap-1 mt-0.5 ${
                    percentageImpact > 0 ? "text-rose-600" : percentageImpact < 0 ? "text-emerald-600" : "text-slate-500"
                  }`}>
                    {totalDelta > 0 ? <TrendingUp className="w-4 h-4 text-rose-600 inline" /> : totalDelta < 0 ? <TrendingDown className="w-4 h-4 text-emerald-600 inline" /> : null}
                    {percentageImpact > 0 ? "+" : ""}{percentageImpact.toFixed(2)}%
                  </p>
                </div>
              </div>

              {Math.abs(percentageImpact) > 5 && (
                <div className={`p-3 rounded-lg border text-xs leading-relaxed flex gap-2 ${
                  percentageImpact > 0 
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    {percentageImpact > 0 
                      ? "High Risk Exposure! Raw metal spikes would drive substantial SAP budget overrides. Hedge procurement recommended."
                      : "Sourcing Deficit Window! Prices falling below baseline. Defer standard purchase releases to exploit drop."}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Exposure Weight Chart */}
          <div className="h-[120px] relative bg-white rounded-xl p-3 border border-slate-200 shadow-sm flex items-center justify-between">
            <div className="w-[100px] h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={28}
                    outerRadius={40}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatUSD(Number(value))}
                    contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "11px", color: "#1e293b" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="flex-1 pl-4 space-y-1.5 overflow-hidden">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Spend Share Exposure</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                {pieData.map((item, idx) => {
                  const share = (item.value / totalPortfolioValue) * 100;
                  return (
                    <div key={idx} className="flex items-center gap-1 text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="truncate">{item.name.replace(" Exposure", "")}:</span>
                      <span className="font-mono text-slate-800 font-bold ml-auto shrink-0">{share.toFixed(0)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
