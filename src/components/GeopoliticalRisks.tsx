import React from "react";
import { Material, GeopoliticalRisk } from "../types";
import { AlertTriangle, ShieldCheck, Globe, HelpCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

interface GeopoliticalRisksProps {
  materials: Material[];
  riskCatalog: GeopoliticalRisk[];
}

export default function GeopoliticalRisks({ materials, riskCatalog }: GeopoliticalRisksProps) {
  // Aggregate materials spend and vendors by country
  const countryAggregation: { [key: string]: { spend: number; vendors: Set<string>; count: number } } = {};
  let totalSpend = 0;

  materials.forEach((m) => {
    const spend = m.volume * m.unitPrice;
    totalSpend += spend;
    const country = m.vendorCountry || "Global";

    if (!countryAggregation[country]) {
      countryAggregation[country] = { spend: 0, vendors: new Set<string>(), count: 0 };
    }

    countryAggregation[country].spend += spend;
    countryAggregation[country].vendors.add(m.vendorName);
    countryAggregation[country].count += 1;
  });

  // Blend aggregation with static geopolitical risks catalog
  const processedRisks = Object.keys(countryAggregation).map((country) => {
    const catalogItem = riskCatalog.find(c => c.country.toLowerCase() === country.toLowerCase()) || {
      riskScore: 2,
      status: "Stable" as const,
      description: "Standard risk tier. Baseline monitoring advised."
    };

    const agg = countryAggregation[country];
    return {
      country,
      spend: agg.spend,
      spendShare: (agg.spend / totalSpend) * 100,
      vendorCount: agg.vendors.size,
      materialCount: agg.count,
      riskScore: catalogItem.riskScore,
      status: catalogItem.status,
      description: catalogItem.description
    };
  }).sort((a, b) => b.spend - a.spend);

  const formatUSD = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(num);
  };

  // Find concentration issues: e.g. Country with risk >= 3 representing > 15% of spend
  const criticalConcentrations = processedRisks.filter(r => r.riskScore >= 3 && r.spendShare > 10);

  // Chart data
  const chartData = processedRisks.map(r => ({
    country: r.country,
    Spend: r.spend,
    "Spend Share %": parseFloat(r.spendShare.toFixed(1)),
    riskScore: r.riskScore
  }));

  // Colors based on risk score
  const getRiskColor = (score: number) => {
    if (score >= 4) return "#f43f5e"; // rose-500
    if (score >= 3) return "#f97316"; // orange-500
    return "#10b981"; // emerald-500
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6" id="geopolitical-panel">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-600" />
          SAP Sourcing Risk & Geopolitical Exposure
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Review concentration of procurement spend across sovereign borders and associated supply-chain security profiles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Risk Alerts & Narrative (5/12) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Supply Risk Summary</h3>
            
            {criticalConcentrations.length > 0 ? (
              <div className="space-y-3">
                {criticalConcentrations.map((c, idx) => (
                  <div key={idx} className="p-3.5 rounded-lg bg-orange-50 border border-orange-200 text-xs">
                    <div className="flex items-center gap-2 text-orange-700 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      Risk Concentration Warning: {c.country}
                    </div>
                    <p className="text-slate-700 mt-1.5 leading-relaxed">
                      Your business routes <strong className="text-slate-900 font-bold font-mono">{c.spendShare.toFixed(1)}% ({formatUSD(c.spend)})</strong> of total external procurement through <strong className="text-slate-900 font-bold">{c.country}</strong>, which maintains a cautionary geopolitical risk level of <strong className="text-slate-900 font-bold">{c.riskScore}/5</strong>.
                    </p>
                    <p className="text-slate-500 text-[10px] mt-1.5 italic">
                      Advice: Cultivate active backup suppliers in Stable regions to hedge against trade/tariff blockages.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs flex items-start gap-2.5 text-emerald-800">
                <ShieldCheck className="w-4.5 h-4.5 shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <span className="font-bold">Diversified Sourcing Landscape</span>
                  <p className="text-slate-600 mt-1 leading-relaxed">
                    Sourcing channels are highly secure. No cautionary or high-risk countries exceed the standard 10% risk-concentration budget ceiling.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* List of Countries */}
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {processedRisks.map((r, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:border-slate-300 hover:shadow-sm transition-all shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{r.country}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      r.riskScore >= 4 
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : r.riskScore >= 3 
                        ? "bg-orange-50 border-orange-200 text-orange-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700"
                    }`}>
                      Risk Score: {r.riskScore}/5
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 max-w-xs truncate" title={r.description}>{r.description}</p>
                </div>

                <div className="text-right font-mono shrink-0">
                  <div className="font-bold text-slate-800">{formatUSD(r.spend)}</div>
                  <div className="text-[10px] text-slate-400 font-semibold">{r.spendShare.toFixed(1)}% Share • {r.vendorCount} {r.vendorCount === 1 ? "vendor" : "vendors"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Sourcing Chart (7/12) */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Procurement Spend by Sovereign Country</h3>

            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                >
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="country" type="category" stroke="#64748b" fontSize={10} width={80} />
                  <Tooltip
                    formatter={(value) => [formatUSD(Number(value)), "Spend"]}
                    contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", color: "#1e293b" }}
                  />
                  <Bar dataKey="Spend" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getRiskColor(entry.riskScore)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex gap-4 text-[10px] text-slate-400 justify-end pt-3 border-t border-slate-100 font-bold font-mono">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Stable (Score 1-2)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                Caution (Score 3)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                High Risk (Score 4-5)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
