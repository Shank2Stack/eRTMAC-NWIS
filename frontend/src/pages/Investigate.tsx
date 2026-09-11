import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { AlertOctagon, RefreshCw, AlertCircle, Search, Layers, Clock } from 'lucide-react';
import * as wellsApi from '../api/wellsApi';
import type { InvestigationResponse, TimelinePoint } from '../types/api';
import { useWell } from '../context/WellContext';
import { useTheme } from '../context/ThemeContext';
import WellBreadcrumb from '../components/layout/WellBreadcrumb';
import SectionHeader from '../components/ui/SectionHeader';

export default function Investigate() {
  const { id } = useParams<{ id: string }>();
  const { activeWell, setActiveWellId } = useWell();
  const { isDark } = useTheme();

  const wellId = id || activeWell?.well_id || '';

  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<TimelinePoint | null>(null);

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
      const data = await wellsApi.getInvestigation(wellId);
      setInvestigation(data);
      if (data.anomaly_points?.length > 0) {
        setSelectedPoint(data.anomaly_points[0]);
      } else if (data.timeline?.length > 0) {
        setSelectedPoint(data.timeline[data.timeline.length - 1]);
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to retrieve root cause investigation timeline.');
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

  if (loading && !investigation) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 text-ink-600 dark:text-night-400">
          <RefreshCw className="animate-spin text-gold" size={20} />
          <span className="text-[13px] font-medium">Reconstructing historical investigation timeline…</span>
        </div>
      </div>
    );
  }

  if (error && !investigation) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="card p-6 max-w-md w-full text-center space-y-4 border-risk-high/30">
          <AlertCircle className="mx-auto text-risk-high" size={28} />
          <p className="text-[13px] text-ink-700 dark:text-ivory-200">{error}</p>
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-night-950 text-[12px] font-semibold rounded-sm hover:bg-gold-600 transition-colors"
          >
            <RefreshCw size={13} /> Retry Investigation
          </button>
        </div>
      </div>
    );
  }

  const timeline = investigation?.timeline || [];
  const anomalyPoints = investigation?.anomaly_points || [];

  const chartData = timeline.map((p, i) => ({
    index: i,
    time: p.timestamp ? p.timestamp.split('T')[1]?.slice(0, 5) || p.timestamp.slice(11, 16) || `T-${i}` : `${i}`,
    depth: p.depth_m != null ? +p.depth_m.toFixed(1) : undefined,
    rop: p.ROP != null ? +p.ROP.toFixed(1) : 0,
    wob: p.WOB != null ? +p.WOB.toFixed(1) : 0,
    torque: p.Torque != null ? +p.Torque.toFixed(1) : 0,
    score: p.anomaly_score != null ? +(p.anomaly_score * 100).toFixed(1) : 0,
    condition: p.condition || 'Normal',
  }));

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 space-y-6 bg-ivory-100 dark:bg-night-950 min-h-screen">
      <WellBreadcrumb />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SectionHeader
          title="Forensic Root Cause Investigation"
          sub={`${wellId} · Temporal Sensor Reconstruction without Lookahead Leakage`}
        />
        <button
          onClick={() => loadData()}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-gold self-start sm:self-auto"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Investigation
        </button>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4">
          <p className="section-label mb-1">Timeline Points</p>
          <p className="num text-2xl font-semibold text-ink-900 dark:text-ivory-100">
            {timeline.length}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Chronological steps</p>
        </div>

        <div className="card p-4">
          <p className="section-label mb-1">Anomalous Points</p>
          <p className={`num text-2xl font-semibold ${anomalyPoints.length > 0 ? 'text-risk-high' : 'text-risk-low'}`}>
            {anomalyPoints.length}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Divergent observations</p>
        </div>

        <div className="card p-4">
          <p className="section-label mb-1">Depth Horizon</p>
          <p className="num text-lg font-semibold text-gold mt-1 truncate">
            {investigation?.depth_range?.min_depth != null && investigation?.depth_range?.max_depth != null
              ? `${Math.round(investigation.depth_range.min_depth)}m – ${Math.round(investigation.depth_range.max_depth)}m`
              : 'Continuous'}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Observation interval</p>
        </div>

        <div className="card p-4">
          <p className="section-label mb-1">Investigation Scope</p>
          <p className="text-[12px] font-medium text-ink-700 dark:text-ivory-300 mt-1 truncate">
            Causal Timeline
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500 mt-0.5">Zero lookahead bias</p>
        </div>
      </div>

      {/* ── Investigation Narrative Note ─────────────────────────────────── */}
      {investigation?.note && (
        <div className="card p-4 sm:p-5 bg-gold/5 border-gold/20 flex items-start gap-3">
          <AlertOctagon size={18} className="text-gold shrink-0 mt-0.5" />
          <div className="text-[12px] space-y-1">
            <p className="font-semibold text-ink-900 dark:text-ivory-100">Forensic Investigation Record</p>
            <p className="text-ink-600 dark:text-night-400 leading-relaxed">{investigation.note}</p>
          </div>
        </div>
      )}

      {/* ── Multi-Parameter Timeline Chart ───────────────────────────────── */}
      <div className="card p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <SectionHeader
              title="Temporal Drilling Parameters & Anomaly Trajectory"
              sub="Tracking ROP, WOB, Torque and ML anomaly index chronologically"
            />
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke={axisColor} tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis yAxisId="left" stroke={axisColor} tick={{ fontSize: 11, fill: axisColor }} />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#C0392B"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#C0392B' }}
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
                      <p className="font-semibold text-ink-900 dark:text-ivory-100">Timestamp: {d.time}</p>
                      {d.depth && <p className="text-ink-500">Depth: {d.depth} m</p>}
                      <p className="text-[#C9A84C]">ROP: {d.rop} m/h</p>
                      <p className="text-[#2E7D4F]">WOB: {d.wob} kN</p>
                      <p className="text-[#8FA8B8]">Torque: {d.torque} kNm</p>
                      <p className="font-semibold text-risk-high">Anomaly Index: {d.score}% ({d.condition})</p>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line yAxisId="left" type="monotone" dataKey="rop" name="ROP (m/h)" stroke="#C9A84C" dot={false} strokeWidth={2} />
              <Line yAxisId="left" type="monotone" dataKey="wob" name="WOB (kN)" stroke="#2E7D4F" dot={false} strokeWidth={1.5} />
              <Line yAxisId="left" type="monotone" dataKey="torque" name="Torque (kNm)" stroke="#8FA8B8" dot={false} strokeWidth={1.5} />
              <Line yAxisId="right" type="monotone" dataKey="score" name="Anomaly Score %" stroke="#C0392B" dot={false} strokeWidth={2.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Detected Anomalous Observations Table ────────────────────────── */}
      {anomalyPoints.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-ivory-300 dark:border-night-700">
            <SectionHeader
              title="Flagged Anomaly Points"
              sub="Chronological timeline steps with elevated or critical divergence"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-ivory-300 dark:border-night-700 bg-ivory-50 dark:bg-night-800/40">
                  <th className="px-4 py-2.5 text-left section-label uppercase text-[10px]">Timestamp</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">Depth (m)</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">ROP (m/h)</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">WOB (kN)</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">Torque (kNm)</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">Condition</th>
                  <th className="px-4 py-2.5 text-right section-label uppercase text-[10px]">Anomaly Score</th>
                </tr>
              </thead>
              <tbody>
                {anomalyPoints.map((pt, i) => (
                  <tr
                    key={i}
                    className="border-b border-ivory-200 dark:border-night-800 hover:bg-ivory-50 dark:hover:bg-night-800/30 transition-colors"
                  >
                    <td className="px-4 py-2 num font-medium text-ink-900 dark:text-ivory-100">
                      {pt.timestamp ? pt.timestamp.split('T')[0] + ' ' + (pt.timestamp.split('T')[1]?.slice(0, 8) || '') : `Point #${i + 1}`}
                    </td>
                    <td className="px-4 py-2 text-right num text-ink-700 dark:text-ivory-300">
                      {pt.depth_m != null ? pt.depth_m.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right num text-gold font-medium">
                      {pt.ROP != null ? pt.ROP.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right num text-ink-700 dark:text-ivory-300">
                      {pt.WOB != null ? pt.WOB.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right num text-ink-700 dark:text-ivory-300">
                      {pt.Torque != null ? pt.Torque.toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className={`badge text-[10px] px-2 py-0.5 border ${
                        pt.condition === 'Critical'
                          ? 'bg-risk-high/10 text-risk-high border-risk-high/30'
                          : 'bg-risk-med/10 text-risk-med border-risk-med/30'
                      }`}>
                        {pt.condition || 'Elevated'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right num font-semibold text-risk-high">
                      {pt.anomaly_score != null ? pt.anomaly_score.toFixed(3) : '—'}
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
