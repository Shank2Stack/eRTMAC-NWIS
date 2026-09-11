import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Info, AlertTriangle, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import * as wellsApi from '../api/wellsApi';
import type { Evidence, Prediction } from '../types/api';
import { useWell } from '../context/WellContext';
import { useTheme } from '../context/ThemeContext';
import WellBreadcrumb from '../components/layout/WellBreadcrumb';
import SectionHeader from '../components/ui/SectionHeader';

export default function WhyAI() {
  const { id } = useParams<{ id: string }>();
  const { activeWell, setActiveWellId } = useWell();
  const { isDark } = useTheme();

  const wellId = id || activeWell?.well_id || '';

  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wellId && activeWell?.well_id !== wellId) {
      setActiveWellId(wellId);
    }
  }, [wellId, activeWell?.well_id, setActiveWellId]);

  const loadData = useCallback(async () => {
    if (!wellId) return;
    setLoading(true);
    setError(null);
    try {
      const [evData, predData] = await Promise.all([
        wellsApi.getEvidence(wellId),
        wellsApi.getPrediction(wellId),
      ]);
      setEvidence(evData);
      setPrediction(predData);
    } catch (err: any) {
      setError(err?.message || 'Failed to load explainability evidence for this well.');
    } finally {
      setLoading(false);
    }
  }, [wellId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const gridColor = isDark ? '#2E2E2B' : '#ECEAE3';
  const axisColor = isDark ? '#4A4A45' : '#B8B4A8';
  const tooltipBg = isDark ? '#1C1C1A' : '#FFFFFF';
  const tooltipBorder = isDark ? '#2E2E2B' : '#D6D3CB';

  if (loading && !evidence) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 text-ink-600 dark:text-night-400">
          <RefreshCw className="animate-spin text-gold" size={20} />
          <span className="text-[13px] font-medium">Computing anomaly indicators & feature contributions…</span>
        </div>
      </div>
    );
  }

  if (error && !evidence) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="card p-6 max-w-md w-full text-center space-y-4 border-risk-high/30">
          <AlertCircle className="mx-auto text-risk-high" size={28} />
          <p className="text-[13px] text-ink-700 dark:text-ivory-200">{error}</p>
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-night-950 text-[12px] font-semibold rounded-sm hover:bg-gold-600 transition-colors"
          >
            <RefreshCw size={13} /> Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const contributions = evidence?.feature_contributions || prediction?.feature_contributions || [];
  const sortedContributions = [...contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  const condition = prediction?.condition || 'Normal';
  const score = prediction?.anomaly_score ?? 0;

  const conditionBadgeClass =
    condition === 'Critical'
      ? 'bg-risk-high/10 text-risk-high border-risk-high/30'
      : condition === 'Elevated'
      ? 'bg-risk-med/10 text-risk-med border-risk-med/30'
      : 'bg-risk-low/10 text-risk-low border-risk-low/30';

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 space-y-6 bg-ivory-100 dark:bg-night-950 min-h-screen">
      <WellBreadcrumb />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SectionHeader
          title="Explainable Anomaly Evidence"
          sub={`${wellId} · Isolation Forest Anomaly Analysis`}
        />
        <button
          onClick={() => loadData()}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-gold self-start sm:self-auto"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Evidence
        </button>
      </div>

      {/* ── Summary KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4">
          <p className="section-label mb-1">Drilling Condition</p>
          <span className={`inline-block text-[13px] font-semibold px-2.5 py-0.5 rounded border mt-0.5 ${conditionBadgeClass}`}>
            {condition}
          </span>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-1">Operational State</p>
        </div>

        <div className="card p-4">
          <p className="section-label mb-1">Anomaly Score</p>
          <p className="num text-2xl font-semibold text-ink-900 dark:text-ivory-100">
            {score.toFixed(3)}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Scale 0.0 – 1.0</p>
        </div>

        <div className="card p-4">
          <p className="section-label mb-1">Features Analyzed</p>
          <p className="num text-2xl font-semibold text-gold">
            {prediction?.features_used?.length ?? sortedContributions.length}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Standardized vectors</p>
        </div>

        <div className="card p-4">
          <p className="section-label mb-1">Model Engine</p>
          <p className="text-[13px] font-semibold text-ink-700 dark:text-ivory-300 truncate mt-1">
            {prediction?.model_version || 'IsolationForest v1.0'}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Unsupervised Detector</p>
        </div>
      </div>

      {/* ── Model Note & Disclaimer Banner ───────────────────────────────── */}
      <div className="card p-4 sm:p-5 bg-gold/5 border-gold/20 flex items-start gap-3">
        <Info size={18} className="text-gold shrink-0 mt-0.5" />
        <div className="text-[12px] space-y-1">
          <p className="font-semibold text-ink-900 dark:text-ivory-100">
            {evidence?.note || 'Anomaly Evidence Note'}
          </p>
          <p className="text-ink-600 dark:text-night-400 leading-relaxed">
            {prediction?.disclaimer ||
              'Anomaly score produced by IsolationForest on historical drilling data. This is NOT a failure probability. Use as one input among many.'}
          </p>
        </div>
      </div>

      {/* ── Feature Contributions Chart ──────────────────────────────────── */}
      <div className="card p-4 sm:p-5">
        <SectionHeader
          title="Feature Divergence & Importance"
          sub="Relative impact of each drilling parameter on the anomaly indicator"
          className="mb-5"
        />

        {sortedContributions.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedContributions}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  stroke={axisColor}
                  tick={{ fontSize: 11, fill: axisColor }}
                />
                <YAxis
                  type="category"
                  dataKey="feature"
                  stroke={axisColor}
                  tick={{ fontSize: 11, fill: axisColor }}
                  width={90}
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
                        <p className="text-ink-500 dark:text-night-400">Current Value: <span className="num font-semibold text-gold">{d.value}</span></p>
                        <p className="text-ink-500 dark:text-night-400">Contribution: <span className="num font-semibold">{d.contribution?.toFixed(4)}</span></p>
                        <p className="text-ink-400 dark:text-night-500 mt-1 italic">{d.description}</p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine x={0} stroke={axisColor} />
                <Bar dataKey="contribution" radius={[0, 2, 2, 0]}>
                  {sortedContributions.map((entry, index) => {
                    const color = entry.contribution > 0 ? '#C0392B' : '#2E7D4F';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-[12px] text-ink-400 dark:text-night-500 py-8 text-center">
            No feature contribution data available for this well.
          </p>
        )}
      </div>

      {/* ── Supporting Historical Records ────────────────────────────────── */}
      {evidence?.supporting_records && evidence.supporting_records.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-ivory-300 dark:border-night-700">
            <SectionHeader
              title="Supporting Historical Observations"
              sub="Nearest historical drilling baseline observations matched by the model"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-ivory-300 dark:border-night-700 bg-ivory-50 dark:bg-night-800/40">
                  {Object.keys(evidence.supporting_records[0]).slice(0, 6).map((k) => (
                    <th key={k} className="px-4 py-2.5 text-left section-label uppercase text-[10px]">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evidence.supporting_records.slice(0, 5).map((rec, i) => (
                  <tr
                    key={i}
                    className="border-b border-ivory-200 dark:border-night-800 hover:bg-ivory-50 dark:hover:bg-night-800/30 transition-colors"
                  >
                    {Object.entries(rec).slice(0, 6).map(([k, val], vi) => (
                      <td key={vi} className="px-4 py-2 num text-ink-700 dark:text-ivory-300">
                        {typeof val === 'number' ? val.toFixed(2) : String(val ?? '—')}
                      </td>
                    ))}
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
