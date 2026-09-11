import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, RefreshCw, AlertCircle, Compass, HardHat } from 'lucide-react';
import * as wellsApi from '../api/wellsApi';
import type { WellSummary, WellState } from '../types/api';
import { useWell } from '../context/WellContext';
import WellBreadcrumb from '../components/layout/WellBreadcrumb';
import SectionHeader from '../components/ui/SectionHeader';

export default function Specs() {
  const { id } = useParams<{ id: string }>();
  const { activeWell, setActiveWellId } = useWell();

  const wellId = id || activeWell?.well_id || '';

  const [wellSummary, setWellSummary] = useState<WellSummary | null>(null);
  const [wellState, setWellState] = useState<WellState | null>(null);
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
      const [summary, state] = await Promise.all([
        wellsApi.getWell(wellId),
        wellsApi.getWellData(wellId),
      ]);
      setWellSummary(summary);
      setWellState(state);
    } catch (err: any) {
      setError(err?.message || 'Failed to load rig and well specifications.');
    } finally {
      setLoading(false);
    }
  }, [wellId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !wellSummary) {
    return (
      <div className="p-4 pt-14 md:p-8 md:pt-8 min-h-screen bg-ivory-100 dark:bg-night-950 flex flex-col items-center justify-center">
        <div className="flex items-center gap-3 text-ink-600 dark:text-night-400">
          <RefreshCw className="animate-spin text-gold" size={20} />
          <span className="text-[13px] font-medium">Retrieving well engineering program & casing specs…</span>
        </div>
      </div>
    );
  }

  if (error && !wellSummary) {
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

  const casingProgram = [
    { name: 'Marine Conductor', depth: 120, od: 30, id_: 28.0, weight: 310, grade: 'X-52' },
    { name: 'Surface Casing', depth: 850, od: 20, id_: 18.73, weight: 133, grade: 'K-55' },
    { name: 'Intermediate Casing', depth: 2150, od: 13.375, id_: 12.415, weight: 68, grade: 'L-80' },
    { name: 'Production Liner', depth: Math.round(wellSummary?.latest_depth_m || 3400), od: 9.625, id_: 8.681, weight: 47, grade: 'P-110' },
  ];

  const bhaComponents = [
    { name: '8½" PDC Drill Bit (Matrix Body)', od: 8.5, length: 1.2, type: 'Bit', status: 'In Service' },
    { name: '6¾" Rotary Steerable System (RSS)', od: 6.75, length: 6.4, type: 'Steering', status: 'Nominal' },
    { name: '6¾" LWD / MWD Telemetry Pulse Collar', od: 6.75, length: 9.1, type: 'MWD/LWD', status: 'Active Pulsing' },
    { name: '6½" Hydraulic Drilling Jar', od: 6.5, length: 8.5, type: 'Safety', status: 'Armed' },
    { name: 'Heavy Weight Drill Pipe (HWDP)', od: 5.0, length: 120.0, type: 'Drill String', status: 'Nominal' },
  ];

  return (
    <div className="p-4 pt-14 md:p-8 md:pt-8 space-y-6 bg-ivory-100 dark:bg-night-950 min-h-screen">
      <WellBreadcrumb />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SectionHeader
          title="Rig & Well Specifications"
          sub={`${wellId} · Mærsk Inspirer Jack-up Rig · Block 15/9`}
        />
        <button
          onClick={() => loadData()}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-500 hover:text-gold self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh Specs
        </button>
      </div>

      {/* ── Overview Metadata Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3.5">
          <p className="section-label">Field / Location</p>
          <p className="text-[13px] font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            Volve Field
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500">North Sea (Equinor)</p>
        </div>

        <div className="card p-3.5">
          <p className="section-label">Well Type</p>
          <p className="text-[13px] font-semibold text-gold mt-1">
            {wellSummary?.well_type || 'OP - Production'}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500">Operational Profile</p>
        </div>

        <div className="card p-3.5">
          <p className="section-label">Target Depth</p>
          <p className="num text-lg font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            {wellSummary?.latest_depth_m != null ? `${wellSummary.latest_depth_m.toLocaleString()} m` : 'N/A'}
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500">Measured Depth (MD)</p>
        </div>

        <div className="card p-3.5">
          <p className="section-label">Rig Asset</p>
          <p className="text-[13px] font-semibold text-ink-900 dark:text-ivory-100 mt-1">
            Mærsk Inspirer
          </p>
          <p className="text-[10px] text-ink-400 dark:text-night-500">Ultra-harsh Jack-up</p>
        </div>
      </div>

      {/* ── Casing Program Table ─────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-ivory-300 dark:border-night-700">
          <SectionHeader
            title="Wellbore Architecture & Casing Strings"
            sub="Standardized casing shoe depths and metallurgical grades"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[500px]">
            <thead>
              <tr className="border-b border-ivory-300 dark:border-night-700 bg-ivory-50 dark:bg-night-800/40">
                {['String Description', 'Shoe Depth (m)', 'OD (in)', 'ID (in)', 'Nominal Weight (lb/ft)', 'Steel Grade'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left section-label whitespace-nowrap text-[10px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {casingProgram.map((c, i) => (
                <tr
                  key={i}
                  className="border-b border-ivory-200 dark:border-night-800 hover:bg-ivory-50 dark:hover:bg-night-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-ink-900 dark:text-ivory-100">{c.name}</td>
                  <td className="px-4 py-3 num text-ink-700 dark:text-ivory-300">{c.depth.toLocaleString()} m</td>
                  <td className="px-4 py-3 num text-ink-700 dark:text-ivory-300">{c.od}"</td>
                  <td className="px-4 py-3 num text-ink-700 dark:text-ivory-300">{c.id_}"</td>
                  <td className="px-4 py-3 num text-ink-700 dark:text-ivory-300">{c.weight}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-ink-900/5 text-ink-700 border border-ink-200 dark:bg-night-700/50 dark:text-night-300 dark:border-night-600 text-[10px]">
                      {c.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bottom Hole Assembly (BHA) Table ─────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-ivory-300 dark:border-night-700">
          <SectionHeader
            title="Downhole Bottom Hole Assembly (BHA)"
            sub="Directional drilling, telemetry, and drill bit tool string"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[500px]">
            <thead>
              <tr className="border-b border-ivory-300 dark:border-night-700 bg-ivory-50 dark:bg-night-800/40">
                {['Component', 'Outer Diameter', 'Length (m)', 'Subsystem Type', 'Telemetry Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left section-label whitespace-nowrap text-[10px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bhaComponents.map((b, i) => (
                <tr
                  key={i}
                  className="border-b border-ivory-200 dark:border-night-800 hover:bg-ivory-50 dark:hover:bg-night-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-ink-900 dark:text-ivory-100">{b.name}</td>
                  <td className="px-4 py-3 num text-ink-700 dark:text-ivory-300">{b.od}"</td>
                  <td className="px-4 py-3 num text-ink-700 dark:text-ivory-300">{b.length} m</td>
                  <td className="px-4 py-3 text-ink-600 dark:text-night-400">{b.type}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-gold/10 text-gold border border-gold/20 text-[10px]">
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
