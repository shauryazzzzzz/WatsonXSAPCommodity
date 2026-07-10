import React, { useState } from "react";
import { Material, ProcurementAction } from "../types";
import { FileText, Calendar, RefreshCw, Sparkles, AlertCircle, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";

interface StrategyAdvisoryProps {
  materials: Material[];
  rates: { copper: number; steel: number; aluminum: number; nickel: number };
  onRefreshReport: () => Promise<void>;
  strategyMemo: string;
  isGenerating: boolean;
}

export default function StrategyAdvisory({
  materials,
  rates,
  onRefreshReport,
  strategyMemo,
  isGenerating
}: StrategyAdvisoryProps) {
  const [activeTab, setActiveTab] = useState<"memo" | "timeline">("memo");

  // Calculate dynamic action recommendations locally based on material sub-weights and simulated price rates
  const getActionRecommendations = (): ProcurementAction[] => {
    const actions: ProcurementAction[] = [];
    const dateOpts = ["Aug 2026", "Sep 2026", "Oct 2026", "Hold Current"];

    materials.forEach((m, idx) => {
      const spend = m.volume * m.unitPrice;
      
      // Determine primary commodity
      const w = m.commodityWeights;
      const comps = [
        { name: "Copper", val: w.copper, rate: rates.copper, trend: 9.5 },
        { name: "Steel", val: w.steel, rate: rates.steel, trend: -5.8 },
        { name: "Aluminum", val: w.aluminum, rate: rates.aluminum, trend: 6.9 },
        { name: "Nickel", val: w.nickel, rate: rates.nickel, trend: -6.6 }
      ];

      const primary = comps.reduce((prev, current) => (prev.val > current.val ? prev : current));

      if (primary.val < 15) return; // skip if very low exposure

      let recommendation: "BUY_ADVANCE" | "POSTPONE" | "HOLD" = "HOLD";
      let reason = "Baseline commodity values are tracking flat. Procure standard monthly volumes.";
      let suggestedActionDate = "Standard Cycle";
      let confidence = 75;

      // Decide recommendation based on simulated rate or projected quarterly trend
      const effectiveTrend = primary.rate !== 0 ? primary.rate : primary.trend;

      if (effectiveTrend > 5) {
        recommendation = "BUY_ADVANCE";
        reason = `Primary component is ${primary.name} (${primary.val}% weight), which is facing a projected price hike of ${effectiveTrend.toFixed(0)}%. Procurement in advance of requirement will hedge risk.`;
        suggestedActionDate = "Immediate Release";
        confidence = Math.min(98, 80 + Math.round(primary.val * 0.15));
      } else if (effectiveTrend < -4) {
        recommendation = "POSTPONE";
        reason = `Primary component is ${primary.name} (${primary.val}% weight), with a projected supply surplus dropping values by ${Math.abs(effectiveTrend).toFixed(0)}%. Delay PO releases to capture capital savings.`;
        suggestedActionDate = "Delay by 45 Days";
        confidence = Math.min(95, 75 + Math.round(primary.val * 0.1));
      }

      actions.push({
        materialId: m.id,
        materialName: m.name,
        category: m.category,
        totalValue: spend,
        primaryCommodity: primary.name,
        primaryWeight: primary.val,
        exposureValue: spend * (primary.val / 100),
        forecastTrend: effectiveTrend,
        recommendation,
        confidence,
        reason,
        suggestedActionDate
      });
    });

    return actions.sort((a, b) => b.exposureValue - a.exposureValue);
  };

  const recommendationsList = getActionRecommendations();

  // Simple clean markdown parser to translate headings, lists and bold items into beautiful Tailwind styling
  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      
      // Headers
      if (trimmed.startsWith("# ")) {
        return <h1 key={idx} className="text-xl font-bold text-indigo-600 mt-6 mb-3 border-b border-slate-200 pb-2">{trimmed.slice(2)}</h1>;
      }
      if (trimmed.startsWith("## ")) {
        return <h2 key={idx} className="text-base font-bold text-slate-800 mt-5 mb-2.5 flex items-center gap-2">{trimmed.slice(3)}</h2>;
      }
      if (trimmed.startsWith("### ")) {
        return <h3 key={idx} className="text-sm font-bold text-slate-700 mt-4 mb-2">{trimmed.slice(4)}</h3>;
      }

      // Blockquotes
      if (trimmed.startsWith(">")) {
        return (
          <blockquote key={idx} className="border-l-2 border-indigo-600 bg-indigo-50/40 p-3 rounded-r-lg my-3 text-slate-700 italic">
            {trimmed.slice(1).trim()}
          </blockquote>
        );
      }

      // Bullet Lists
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        // Handle bold inside list items
        const rawContent = trimmed.slice(2);
        const parsedContent = parseBoldText(rawContent);
        return (
          <ul key={idx} className="list-disc pl-5 my-1.5 text-slate-600 text-xs space-y-1">
            <li>{parsedContent}</li>
          </ul>
        );
      }

      // Ordered Lists
      if (/^\d+\.\s/.test(trimmed)) {
        const rawContent = trimmed.replace(/^\d+\.\s/, "");
        const parsedContent = parseBoldText(rawContent);
        return (
          <ol key={idx} className="list-decimal pl-5 my-1.5 text-slate-600 text-xs space-y-1">
            <li>{parsedContent}</li>
          </ol>
        );
      }

      // Empty Lines
      if (trimmed === "") {
        return <div key={idx} className="h-2" />;
      }

      // General Paragraph
      return <p key={idx} className="text-xs text-slate-600 leading-relaxed my-2">{parseBoldText(trimmed)}</p>;
    });
  };

  // Sub-helper to extract **bold** markers
  const parseBoldText = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-slate-900 font-bold">{part}</strong>;
      }
      return part;
    });
  };

  const formatUSD = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden" id="strategy-panel">
      {/* Tabs and Refresh Header */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("memo")}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "memo"
                ? "bg-indigo-600 text-white shadow-sm font-bold"
                : "text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 shadow-xs"
            }`}
            id="tab-btn-strategy-report"
          >
            <FileText className="w-3.5 h-3.5" />
            AI Sourcing Strategy Memo
          </button>
          
          <button
            onClick={() => setActiveTab("timeline")}
            className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === "timeline"
                ? "bg-indigo-600 text-white shadow-sm font-bold"
                : "text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 shadow-xs"
            }`}
            id="tab-btn-timeline-timeline"
          >
            <Calendar className="w-3.5 h-3.5" />
            Strategic Buy Actions
          </button>
        </div>

        <button
          onClick={onRefreshReport}
          disabled={isGenerating}
          className="flex items-center gap-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2.5 shadow-sm transition-all cursor-pointer border border-indigo-700 font-sans"
          id="btn-rebuild-report"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Rebuilding SAP Advisory...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Re-evaluate Sourcing Strategy
            </>
          )}
        </button>
      </div>

      {/* Main Panel Content */}
      <div className="p-6">
        {activeTab === "memo" ? (
          /* Strategic Report (Gemini-generated output) */
          <div className="relative">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">Generating Strategic SAP Report...</p>
                  <p className="text-xs text-slate-500 max-w-md">
                    Gemini AI is examining current commodity rates, geopolitical vendor risk factors, and custom weighted materials to formulate a secure hedge program.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 font-sans max-h-[500px] overflow-y-auto pr-3 leading-relaxed selection:bg-indigo-500/20 text-slate-800">
                {renderMarkdown(strategyMemo)}
              </div>
            )}
          </div>
        ) : (
          /* Timeline Action List */
          <div className="space-y-4">
            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 text-slate-700">
                <span className="font-bold text-indigo-950">SAP Hedge Procurement Engine</span>
                <p className="leading-relaxed">
                  Decisions are generated by cross-correlating your Material Master's weighted raw components with either NYMEX/LME quarterly forecast futures or your active simulator sliders.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendationsList.map((rec, idx) => {
                const isBuy = rec.recommendation === "BUY_ADVANCE";
                const isDelay = rec.recommendation === "POSTPONE";

                return (
                  <div
                    key={idx}
                    className={`p-5 rounded-xl border flex flex-col justify-between space-y-4 transition-all ${
                      isBuy
                        ? "bg-rose-50/40 border-rose-200 hover:bg-rose-50/70"
                        : isDelay
                        ? "bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50/70"
                        : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-indigo-600">{rec.materialId}</span>
                          <h4 className="text-xs font-bold text-slate-800 mt-0.5 truncate max-w-[200px]" title={rec.materialName}>
                            {rec.materialName}
                          </h4>
                        </div>

                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          isBuy
                            ? "bg-rose-100 border-rose-300 text-rose-700"
                            : isDelay
                            ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                            : "bg-slate-100 border-slate-300 text-slate-600"
                        }`}>
                          {rec.recommendation.replace("_", " ")}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{rec.reason}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-[10px] font-semibold font-mono text-slate-500">
                      <div>
                        <span className="text-slate-400 block font-medium uppercase text-[9px]">Sourcing value</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">{formatUSD(rec.totalValue)}</span>
                      </div>
                      
                      <div>
                        <span className="text-slate-400 block font-medium uppercase text-[9px]">Metal Exposure</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">
                          {rec.primaryCommodity} ({rec.primaryWeight}%)
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block font-medium uppercase text-[9px]">Action date</span>
                        <span className="font-bold text-indigo-600 mt-0.5 block flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                          {rec.suggestedActionDate}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
