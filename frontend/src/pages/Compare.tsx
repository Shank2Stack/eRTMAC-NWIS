import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { GitCompare, RefreshCw, AlertCircle, Info } from 'lucide-react';
import * as wellsApi from '../api/wellsApi';
import type { SimilarWell, CompareResponse, FeatureDiff } from '../types/api';
import { useWell } from '../context/WellContext';
import { useTheme } from '../context/ThemeContext';
import WellBreadcrumb from '../components/layout/WellBreadcrumb';
import SectionHeader from '../components/ui/SectionHeader';

export default function Compare() {
  const { id } = useParams<{ id: string }>();
  const { activeWell, setActiveWellId, allWells } = useWell();
  const { isDark } = useTheme();

  const wellId = id || activeWell?.well_id || '';

  const [similarWells, setSimilarWells] = useState<SimilarWell[]>([]);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>('');
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [method, setMethod] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingCompare, setLoadingCompare] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wellId && activeWell?.well_id !== wellId) {
      setActiveWellId(wellId);
    }
  }, [wellId, activeWell?.well_id, setActiveWellId]);

  // Load similar wells list
  const loadSimilarWells = useCallback(async () => {
    if (!wellId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await wellsApi.getSimilarWells(wellId, 5);
      setSimilarWells(data.similar_wells || []);
      setMethod(data.method);
      // Pick first similar well or another well from allWells
      if (data.similar_wells?.length > 0) {
        setSelectedBenchmarkId(data.similar_wells[0].well_id);
      } else {
        const other = allWells.find((w) => w.well_id !== wellId);
        if (other) setSelectedBenchmarkId(other.well_id);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to retrieve similar analogue wells.');
    } finally {
      setLoading(false);
    }
  }, [wellId, allWells]);

  useEffect(() => {
    loadSimilarWells();
  }, [loadSimilarWells]);

  // Load comparison when selectedBenchmarkId changes
  useEffect(() => {
    async function fetchComparison() {
      if (!wellId || !selectedBenchmarkId || wellId === selectedBenchmarkId) return;
      setLoadingCompare(true);
      try {
        const res = await wellsApi.compareWells(wellId, selectedBenchmarkId);
        setComparison(res);
      } catch (err: any) {
        console.error('Comparison error:', err);
      } finally {
        setLoadingCompare(false);
      }
    }

    fetchComparison();
  }, [wellId, selectedBenchmarkId]);

  const gridColor = isDark ? '#2E2E2B' : '#ECEAE3';
  const axisColor = isDark ? '#4A4A45' : '#B8B4A8';
  const tooltipBg = isDark ? '#1C1C1A' : '#FFFFFF';
  const tooltipBorder = isDark ? '#2E2E2B' : '#D6D3CB';

  if (loading && !comparison) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 text-ink-600 dark:text-night-400">
          <RefreshCw className="animate-spin text-gold" size={20} />
          <span className="text-[13px] font-medium">Calculating feature similarities across historical offset wells…</span>
        </div>
      </div>
    );
  }

  if (error && !comparison) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="card p-6 max-w-md w-full text-center space-y-4 border-risk-high/30">
          <AlertCircle className="mx-auto text-risk-high" size={28} />
          <p className="text-[13px] text-ink-700 dark:text-ivory-200">{error}</p>
          <button
            onClick={() => loadSimilarWells()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-night-950 text-[12px] font-semibold rounded-sm hover:bg-gold-600 transition-colors"
          >
            <RefreshCw size={13} /> Retry Analogue Search
          </button>
        </div>
      </div>
    );
  }

  const similarityPct = comparison?.similarity_score != null ? Math.round(comparison.similarity_score * 100) : 0;

  // Chart data of feature differences
  const diffChartData = (comparison?.feature_diffs || []).map((fd) => ({
    feature: fd.feature,
    current: fd.current_value != null ? +fd.current_value.toFixed(1) : 0,
    historical: fd.historical_value != null ? +fd.historical_value.toFixed(1) : 0,
    diff: fd.diff != null ? +fd.diff.toFixed(2) : 0,
    pct_diff: fd.pct_diff != null ? +fd.pct_diff.toFixed(1) : 0,
  }));

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 space-y-6 bg-ivory-100 dark:bg-night-950 min-h-screen">
      <WellBreadcrumb />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SectionHeader
          title="Offset Well Analogue Comparison"
          sub={`${wellId} vs ${selectedBenchmarkId || 'Historical Analogue'}`}
        />
        <button
          onClick={() => loadSimilarWells()}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-gold self-start sm:self-auto"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Analogue Engine
        </button>
      </div>

      {/* ── Benchmark Selector Card ───────────────────────────────────────── */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-wrap">
          <div>
            <p className="section-label mb-1.5">Historical Benchmark Well</p>
            <select
              value={selectedBenchmarkId}
              onChange={(e) => setSelectedBenchmarkId(e.target.value)}
              className="
                text-[12px] font-medium text-ink-900 dark:text-ivory-100
                bg-ivory-100 dark:bg-night-800
                border border-ivory-300 dark:border-night-700
                rounded-sm px-3 py-2
                focus:outline-none focus:ring-1 focus:ring-gold
                cursor-pointer min-w-[240px]
              "
            >
              {allWells
                .filter((w) => w.well_id !== wellId)
                .map((w) => {
                  const sim = similarWells.find((s) => s.well_id === w.well_id);
                  const simBadge = sim ? ` (Similarity: ${(sim.similarity_score * 100).toFixed(0)}%)` : '';
                  return (
                    <option key={w.well_id} value={w.well_id}>
                      {w.well_id}{simBadge}
                    </option>
                  );
                })}
            </select>
          </div>

          {comparison && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-wrap">
              <div className="hidden sm:block h-10 w-px bg-ivory-300 dark:border-night-700" />
              
              <div>
                <p className="section-label mb-1">Standardized Similarity</p>
                <div className="flex items-center gap-2">
                  <div className="w-28 h-2 bg-ivory-200 dark:bg-night-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${similarityPct}%` }} />
                  </div>
                  <span className="num text-[15px] font-semibold text-gold">{similarityPct}%</span>
                </div>
              </div>

              <div>
                <p className="section-label mb-1">Current Well State</p>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-ink-200 dark:border-night-700 bg-ivory-50 dark:bg-night-800 text-ink-800 dark:text-ivory-200">
                  {comparison.current_condition}
                </span>
              </div>

              <div>
                <p className="section-label mb-1">Historical State</p>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded border border-ink-200 dark:border-night-700 bg-ivory-50 dark:bg-night-800 text-ink-800 dark:text-ivory-200">
                  {comparison.historical_condition}
                </span>
              </div>
            </div>
          )}
        </div>

        {method && (
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-3 flex items-center gap-1.5">
            <Info size={11} className="text-gold shrink-0" />
            <span>Algorithm: {method}</span>
          </p>
        )}
      </div>

      {/* ── Feature Comparison Chart ─────────────────────────────────────── */}
      <div className="card p-4 sm:p-5">
        <SectionHeader
          title="Telemetry Feature Comparison"
          sub="Current well values vs historical offset well parameters"
          className="mb-5"
        />

        {diffChartData.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={diffChartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
              >
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis
                  dataKey="feature"
                  stroke={axisColor}
                  tick={{ fontSize: 11, fill: axisColor }}
                />
                <YAxis
                  stroke={axisColor}
                  tick={{ fontSize: 11, fill: axisColor }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div
                        className="card p-3 shadow-lg text-[11px] space-y-1"
                        style={{ backgroundColor: tooltipBg, borderColor: tooltipBorder }}
                      >
                        <p className="font-semibold text-ink-900 dark:text-ivory-100">{d.feature}</p>
                        <p className="text-gold">Current: {d.current}</p>
                        <p className="text-[#8FA8B8]">Historical: {d.historical}</p>
                        <p className="text-ink-400 dark:text-night-500">Diff: {d.diff > 0 ? `+${d.diff}` : d.diff} ({d.pct_diff}%)</p>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="current" name={`Current (${wellId})`} fill="#C9A84C" radius={[2, 2, 0, 0]} />
                <Bar dataKey="historical" name={`Historical (${selectedBenchmarkId})`} fill="#8FA8B8" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[12px] text-ink-400 dark:text-night-500 py-8 text-center">
            {loadingCompare ? 'Loading feature comparison…' : 'No feature diffs available.'}
          </p>
        )}
      </div>

      {/* ── Feature Diffs Table ──────────────────────────────────────────── */}
      {comparison?.feature_diffs && comparison.feature_diffs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-ivory-300 dark:border-night-700">
            <SectionHeader
              title="Standardized Feature Variance"
              sub="Detailed differential breakdown between active telemetry and historical analogue"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-ivory-300 dark:border-night-700 bg-ivory-50 dark:bg-night-800/40">
                  <th className="px-4 py-2.5 text-left section-label uppercase text-[10px]">Feature</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">Current</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">Historical</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">Absolute Diff</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">% Variance</th>
                </tr>
              </thead>
              <tbody>
                {comparison.feature_diffs.map((fd, i) => (
                  <tr
                    key={i}
                    className="border-b border-ivory-200 dark:border-night-800 hover:bg-ivory-50 dark:hover:bg-night-800/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-ink-900 dark:text-ivory-100">{fd.feature}</td>
                    <td className="px-4 py-2.5 text-right num text-gold font-medium">
                      {fd.current_value != null ? fd.current_value.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right num text-[#8FA8B8] font-medium">
                      {fd.historical_value != null ? fd.historical_value.toFixed(2) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right num text-ink-700 dark:text-ivory-300">
                      {fd.diff != null ? (fd.diff > 0 ? `+${fd.diff.toFixed(2)}` : fd.diff.toFixed(2)) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right num font-semibold">
                      <span className={fd.pct_diff && Math.abs(fd.pct_diff) > 20 ? 'text-risk-high' : 'text-ink-700 dark:text-ivory-300'}>
                        {fd.pct_diff != null ? `${fd.pct_diff.toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
