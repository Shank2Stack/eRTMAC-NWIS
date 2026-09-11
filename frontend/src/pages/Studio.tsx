import React, { useState } from 'react';
import { Layers, X, Grid3x3 } from 'lucide-react';
import { useWell } from '../context/WellContext';
import { useTheme } from '../context/ThemeContext';
import StudioScene from '../components/three/StudioScene';

interface Layer {
  key: 'showCasing' | 'showFormations' | 'showTrajectory' | 'showBHA';
  label: string;
}

const LAYERS: Layer[] = [
  { key: 'showCasing',     label: 'Casing Strings' },
  { key: 'showFormations', label: 'Formation Horizons' },
  { key: 'showTrajectory', label: 'Wellbore Trajectory' },
  { key: 'showBHA',        label: 'BHA Assembly' },
];

export default function Studio() {
  const { activeWell } = useWell();
  const { isDark } = useTheme();

  const [layers, setLayers] = useState({
    showCasing:     true,
    showFormations: true,
    showTrajectory: true,
    showBHA:        true,
  });
  const [wireframe, setWireframe] = useState(false);
  // Mobile: layer panel toggleable via floating button
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);

  const well = activeWell;
  const toggleLayer = (key: Layer['key']) =>
    setLayers((l) => ({ ...l, [key]: !l[key] }));

  const currentDepth = well?.latest_depth_m || 3200;
  const totalDepth = Math.max(currentDepth * 1.25, 4500);
  const formations = [
    { name: 'Nordland Claystone', topDepth: 0, bottomDepth: 1000, lithology: 'shale' as const, color: '#7D6E56' },
    { name: 'Utsira Sandstone', topDepth: 1000, bottomDepth: 1800, lithology: 'sandstone' as const, color: '#C9A460' },
    { name: 'Hordaland Carbonate', topDepth: 1800, bottomDepth: 2600, lithology: 'limestone' as const, color: '#8FA8B8' },
    { name: 'Skade Reservoir', topDepth: 2600, bottomDepth: 3500, lithology: 'sandstone' as const, color: '#C9A460' },
    { name: 'Ty Formation', topDepth: 3500, bottomDepth: 4500, lithology: 'dolomite' as const, color: '#9CA3AF' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-night-950">

      {/* ── Full-screen 3D Canvas ──────────────────────────────────────────── */}
      <div className="flex-1 relative min-w-0 touch-none">
        {well ? (
          <StudioScene
            formations={formations}
            totalDepth={totalDepth}
            currentDepth={currentDepth}
            isDark={isDark}
            {...layers}
            wireframe={wireframe}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-night-500 text-[13px]">
            Select a well to visualize.
          </div>
        )}

        {/* ── Canvas top-left: well name ─────────────────────────────────── */}
        {well && (
          <div className="absolute top-4 left-4 bg-night-900/80 backdrop-blur-sm border border-night-700 rounded-sm px-3 py-2">
            <p className="section-label text-night-500">Well</p>
            <p className="text-[13px] font-semibold text-ivory-100 leading-tight">{well.name}</p>
            <p className="num text-[10px] text-night-500">{well.field}</p>
          </div>
        )}

        {/* ── Canvas bottom-left: controls ──────────────────────────────── */}
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          <button
            onClick={() => setWireframe((w) => !w)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-semibold
              border transition-colors
              ${wireframe
                ? 'bg-gold border-gold text-night-950'
                : 'bg-night-900/80 border-night-700 text-night-400 hover:text-ivory-200 hover:border-night-600 backdrop-blur-sm'
              }
            `}
          >
            <Grid3x3 size={12} />
            Wireframe
          </button>

          {/* Mobile: toggle layer panel */}
          <button
            onClick={() => setLayerPanelOpen((o) => !o)}
            className="
              lg:hidden
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-semibold
              border border-night-700 bg-night-900/80 backdrop-blur-sm
              text-night-400 hover:text-ivory-200 transition-colors
            "
          >
            <Layers size={12} />
            Layers
          </button>
        </div>

        {/* ── Camera hint (desktop only) ─────────────────────────────────── */}
        <div className="hidden lg:block absolute bottom-4 right-56 text-[10px] text-night-600 space-y-0.5 text-right">
          <p>Orbit — drag</p>
          <p>Pan — right-drag</p>
          <p>Zoom — scroll</p>
        </div>
      </div>

      {/* ── Mobile Layer Panel Overlay ─────────────────────────────────────── */}
      {layerPanelOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setLayerPanelOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-night-900 border-t border-night-700 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-semibold text-ivory-100">Layers</p>
              <button onClick={() => setLayerPanelOpen(false)} className="text-night-500 hover:text-ivory-200">
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LAYERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleLayer(key)}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-sm border text-[12px] font-medium
                    transition-colors
                    ${layers[key]
                      ? 'bg-gold/10 border-gold/30 text-gold'
                      : 'bg-night-800 border-night-700 text-night-400'
                    }
                  `}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${layers[key] ? 'bg-gold' : 'bg-night-600'}`} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Layer Panel (right sidebar) ───────────────────────────── */}
      <div className="hidden lg:flex w-48 shrink-0 bg-night-900 border-l border-night-700 flex-col p-4 gap-5">
        <div>
          <p className="section-label text-night-500 mb-3">Layers</p>
          <div className="space-y-1">
            {LAYERS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2.5 py-1.5 cursor-pointer group"
              >
                <div
                  className={`
                    w-4 h-4 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors
                    ${layers[key]
                      ? 'bg-gold border-gold'
                      : 'border-night-600 bg-night-800 group-hover:border-night-500'
                    }
                  `}
                  onClick={() => toggleLayer(key)}
                >
                  {layers[key] && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4L3 6L7 2" stroke="#111110" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={layers[key]}
                  onChange={() => toggleLayer(key)}
                  className="sr-only"
                />
                <span className="text-[12px] text-night-400 group-hover:text-ivory-200 transition-colors leading-none">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="divider dark:border-night-700" />

        <div>
          <p className="section-label text-night-500 mb-3">Camera</p>
          <div className="space-y-1 text-[11px] text-night-500">
            <p>Orbit — Left drag</p>
            <p>Pan — Right drag</p>
            <p>Zoom — Scroll</p>
            <p>Touch — Two-finger</p>
          </div>
        </div>

        {well && (
          <>
            <div className="divider dark:border-night-700" />
            <div>
              <p className="section-label text-night-500 mb-2">Depth</p>
              <p className="num text-[13px] font-semibold text-ivory-100">
                {currentDepth.toLocaleString()} m
              </p>
              <p className="text-[10px] text-night-500 mt-0.5">
                of {totalDepth.toLocaleString()} m TD
              </p>
              <div className="mt-2 h-1 bg-night-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full"
                  style={{ width: `${(currentDepth / totalDepth) * 100}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
