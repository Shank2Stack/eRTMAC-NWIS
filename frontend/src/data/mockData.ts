import type {
  Well,
  Formation,
  CasingShoe,
  BHAComponent,
  SensorReading,
  TimelineEvent,
  ShapFeature,
  AnomalyRecord,
} from '../types';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const now = Date.now();
const mins = (n: number) => n * 60_000;

function genTelemetry(
  count: number,
  baseRop: number,
  baseWob: number,
  baseRpm: number,
  baseTorque: number,
  baseSpp: number,
  baseEcd: number,
  baseFlowIn: number,
  baseGas: number,
): SensorReading[] {
  return Array.from({ length: count }, (_, i) => {
    const jitter = (range: number) => (Math.random() - 0.5) * range;
    return {
      timestamp: now - mins(count - i),
      rop: Math.max(0, baseRop + jitter(8)),
      wob: Math.max(0, baseWob + jitter(4)),
      rpm: Math.max(0, baseRpm + jitter(6)),
      torque: Math.max(0, baseTorque + jitter(1.2)),
      spp: Math.max(0, baseSpp + jitter(80)),
      ecd: baseEcd + jitter(0.05),
      flowIn: Math.max(0, baseFlowIn + jitter(15)),
      flowOut: Math.max(0, baseFlowIn - 4 + jitter(10)),
      pitLevel: 920 + jitter(20),
      gasUnits: Math.max(0, baseGas + jitter(6)),
      porePress: 9.2 + jitter(0.1),
      fractureGrad: 14.8 + jitter(0.1),
    };
  });
}

// ─── Formations ────────────────────────────────────────────────────────────────

const kgFormations: Formation[] = [
  { name: 'Godavari Clay',  topDepth: 0,    bottomDepth: 850,  lithology: 'shale',     color: '#7D6E56' },
  { name: 'Raghavapuram',   topDepth: 850,  bottomDepth: 1800, lithology: 'sandstone', color: '#C9A460' },
  { name: 'Gollapalli',     topDepth: 1800, bottomDepth: 2600, lithology: 'limestone', color: '#A0B0C0' },
  { name: 'Tirupati Sands', topDepth: 2600, bottomDepth: 3400, lithology: 'sandstone', color: '#D4A96A' },
  { name: 'Nannilam',       topDepth: 3400, bottomDepth: 4200, lithology: 'shale',     color: '#6B7280' },
  { name: 'Endrakunta',     topDepth: 4200, bottomDepth: 4800, lithology: 'dolomite',  color: '#9CA3AF' },
];

const vindhyaFormations: Formation[] = [
  { name: 'Alluvium',        topDepth: 0,    bottomDepth: 400,  lithology: 'shale',     color: '#7D6E56' },
  { name: 'Kaimur Fm',       topDepth: 400,  bottomDepth: 1200, lithology: 'sandstone', color: '#C9A460' },
  { name: 'Rohtas Limestone', topDepth: 1200, bottomDepth: 2100, lithology: 'limestone', color: '#A0B0C0' },
  { name: 'Semri Group',     topDepth: 2100, bottomDepth: 3000, lithology: 'sandstone', color: '#D4A96A' },
  { name: 'Bijawar',         topDepth: 3000, bottomDepth: 3800, lithology: 'dolomite',  color: '#9CA3AF' },
];

const cbFormations: Formation[] = [
  { name: 'Recent Sediments', topDepth: 0,    bottomDepth: 600,  lithology: 'shale',     color: '#7D6E56' },
  { name: 'Babaguru Fm',      topDepth: 600,  bottomDepth: 1500, lithology: 'sandstone', color: '#C9A460' },
  { name: 'Kalol Sands',      topDepth: 1500, bottomDepth: 2200, lithology: 'sandstone', color: '#D4A96A' },
  { name: 'Olpad Fm',         topDepth: 2200, bottomDepth: 2900, lithology: 'limestone', color: '#A0B0C0' },
  { name: 'Pataparru',        topDepth: 2900, bottomDepth: 3500, lithology: 'salt',      color: '#E5E7EB' },
  { name: 'Bhuvan Sands',     topDepth: 3500, bottomDepth: 4100, lithology: 'sandstone', color: '#C9A460' },
];

// ─── Casings ───────────────────────────────────────────────────────────────────

const kgCasings: CasingShoe[] = [
  { name: 'Conductor', depth: 150,  od: 30,    id_: 28.5, weight: 218,  grade: 'K-55' },
  { name: 'Surface',   depth: 900,  od: 20,    id_: 18.73, weight: 133, grade: 'K-55' },
  { name: 'Intermediate', depth: 2800, od: 13.375, id_: 12.415, weight: 68, grade: 'N-80' },
  { name: 'Production', depth: 4500, od: 9.625, id_: 8.835, weight: 47, grade: 'P-110' },
];

const cbCasings: CasingShoe[] = [
  { name: 'Conductor', depth: 120,  od: 26,    id_: 24.5, weight: 194,  grade: 'K-55' },
  { name: 'Surface',   depth: 750,  od: 18.625, id_: 17.5, weight: 87.5, grade: 'K-55' },
  { name: 'Intermediate', depth: 2400, od: 13.375, id_: 12.415, weight: 54.5, grade: 'N-80' },
  { name: 'Production', depth: 3800, od: 9.625, id_: 8.835, weight: 40, grade: 'P-110' },
];

// ─── BHA ───────────────────────────────────────────────────────────────────────

const standardBHA: BHAComponent[] = [
  { name: 'PDC Bit 8.5"',      od: 8.5,   length: 0.83,  type: 'bit',        description: 'Smith M616 6-blade PDC' },
  { name: 'RSS Tool',          od: 6.75,  length: 9.2,   type: 'motor',      description: 'AutoTrak Curve' },
  { name: 'MWD/LWD Tool',      od: 6.75,  length: 10.5,  type: 'mwd',        description: 'OnTrak with azimuthal gamma' },
  { name: 'Float Sub',         od: 6.75,  length: 0.6,   type: 'collar',     description: 'Conventional float' },
  { name: 'Non-Mag HWDP',      od: 5,     length: 30,    type: 'hwdp',       description: '5" S-135 NM HWDP' },
  { name: 'Jar',               od: 6.5,   length: 5.4,   type: 'jar',        description: 'Hydraulic Jar — Weatherford' },
  { name: 'HWDP x4 stands',    od: 5,     length: 120,   type: 'hwdp',       description: '5" S-135' },
  { name: 'Upper Stabilizer',  od: 8.375, length: 1.8,   type: 'stabilizer', description: 'Integral blade' },
];

const cbBHA: BHAComponent[] = [
  { name: 'PDC Bit 6.75"',     od: 6.75,  length: 0.6,   type: 'bit',        description: 'Halliburton DB56 PDC' },
  { name: 'Mud Motor 5"',      od: 5.0,   length: 8.2,   type: 'motor',      description: '5" Positive Displacement Motor' },
  { name: 'MWD System',        od: 4.75,  length: 9.8,   type: 'mwd',        description: 'Sperry EMS plus gamma' },
  { name: 'Stabilizer',        od: 6.625, length: 1.6,   type: 'stabilizer', description: 'String stab' },
  { name: 'HWDP x3 stands',    od: 4,     length: 90,    type: 'hwdp',       description: '4" S-135' },
  { name: 'Drilling Jar',      od: 5.0,   length: 4.8,   type: 'jar',        description: 'Mechanical Jar' },
];

// ─── Timeline Events ───────────────────────────────────────────────────────────

const kiranTimeline: TimelineEvent[] = [
  { id: 'e1', timestamp: now - mins(180), severity: 'info',     description: 'Bit on bottom — resumed drilling at 3,812 ft.', parameter: 'Depth', value: 3812 },
  { id: 'e2', timestamp: now - mins(142), severity: 'info',     description: 'ECD stabilized at 11.4 ppg after flow rate adjustment.', parameter: 'ECD', value: 11.4 },
  { id: 'e3', timestamp: now - mins(94),  severity: 'warning',  description: 'WOB spike detected — torque oscillation began, indicative of stick-slip.', parameter: 'WOB', value: 38.2 },
  { id: 'e4', timestamp: now - mins(71),  severity: 'warning',  description: 'Gas units elevated to 42 — pumping slug, monitoring pit gain.', parameter: 'Gas', value: 42 },
  { id: 'e5', timestamp: now - mins(48),  severity: 'critical', description: 'Anomaly flag raised — composite risk score exceeded 80%. Notification dispatched to Drilling Superintendent.', parameter: 'Risk', value: 84 },
  { id: 'e6', timestamp: now - mins(20),  severity: 'warning',  description: 'Flow check in progress — bit off bottom. Flow out reducing.', parameter: 'FlowOut', value: 562 },
];

const brahmaTimeline: TimelineEvent[] = [
  { id: 'b1', timestamp: now - mins(240), severity: 'info',    description: 'Intermediate casing cemented — WOC in progress.' },
  { id: 'b2', timestamp: now - mins(180), severity: 'info',    description: 'POOH complete. BHA dressed and run-in-hole.' },
  { id: 'b3', timestamp: now - mins(90),  severity: 'info',    description: 'Drilling resumed. ROP 38 ft/hr. All parameters nominal.' },
  { id: 'b4', timestamp: now - mins(30),  severity: 'info',    description: 'Formation change — entering Olpad Fm. Mud weight adjusted to 10.2 ppg.' },
];

// ─── SHAP Features ─────────────────────────────────────────────────────────────

const kiranShap: ShapFeature[] = [
  { name: 'WOB Variability',         shapValue: +2.8 },
  { name: 'Torque Oscillation',      shapValue: +2.4 },
  { name: 'Gas Units (24hr trend)',   shapValue: +1.9 },
  { name: 'ECD vs Pore Press Margin', shapValue: +1.4 },
  { name: 'Flow-Out Deficit',        shapValue: +1.1 },
  { name: 'Offset Well Analogy',     shapValue: -0.6 },
  { name: 'ROP Stability',           shapValue: -0.9 },
  { name: 'Mud Weight Margin',       shapValue: -1.2 },
];

const brahmaShap: ShapFeature[] = [
  { name: 'ROP Stability',           shapValue: -2.1 },
  { name: 'ECD vs Pore Press Margin', shapValue: -1.8 },
  { name: 'Mud Weight Margin',       shapValue: -1.5 },
  { name: 'Gas Units Low',           shapValue: -1.2 },
  { name: 'WOB Stability',           shapValue: -0.8 },
  { name: 'Bit Wear Index',          shapValue: +0.4 },
  { name: 'Formation Uncertainty',   shapValue: +0.6 },
];

// ─── Wells ─────────────────────────────────────────────────────────────────────

export const wells: Well[] = [
  // ── KIRAN-1 (Warning / Elevated risk) ───────────────────────────────────────
  {
    id: 'kiran-1',
    name: 'Kiran-1',
    field: 'KG-DWN-98/2',
    operator: 'ONGC Ltd.',
    rigName: 'Sagar Bhushan',
    totalDepth: 4800,
    currentDepth: 3924,
    targetFormation: 'Endrakunta Dolomite',
    coordinates: { lat: 15.82, lng: 81.34 },
    status: 'critical',
    risk: { composite: 84, anomalyProb: 0.81, confidence: 0.91, level: 'critical' },
    formations: kgFormations,
    casingShoes: kgCasings,
    bha: standardBHA,
    telemetry: genTelemetry(60, 34, 34, 72, 13.2, 2840, 11.4, 570, 38),
    timeline: kiranTimeline,
    shap: kiranShap,
    anomaly: {
      id: 'anom-k1',
      detectedAt: now - mins(48),
      severity: 'high',
      suspectedCause: 'Differential Sticking / Kick Potential',
      affectedParameter: 'WOB, Torque, Gas Units',
      description:
        'Concurrent stick-slip torque oscillations and elevated gas units suggest a differential pressure imbalance at 3,900 ft. Flow-out deficit of ~8 gpm corroborates early influx.',
    },
  },

  // ── DELTA-7 (Normal / healthy) ───────────────────────────────────────────────
  {
    id: 'delta-7',
    name: 'Delta-7',
    field: 'KG-DWN-98/3',
    operator: 'ONGC Ltd.',
    rigName: 'Sagar Vijay',
    totalDepth: 4200,
    currentDepth: 2180,
    targetFormation: 'Tirupati Sands',
    coordinates: { lat: 16.01, lng: 81.52 },
    status: 'active',
    risk: { composite: 28, anomalyProb: 0.19, confidence: 0.88, level: 'normal' },
    formations: kgFormations.slice(0, 4),
    casingShoes: kgCasings.slice(0, 3),
    bha: standardBHA,
    telemetry: genTelemetry(60, 52, 28, 84, 11.8, 2640, 10.9, 610, 12),
    timeline: [
      { id: 'd1', timestamp: now - mins(120), severity: 'info', description: 'Running 13-3/8" intermediate casing. Depth 2180 ft.' },
      { id: 'd2', timestamp: now - mins(60), severity: 'info', description: 'Cement job complete. Waiting on cement.' },
    ],
    shap: [
      { name: 'ROP Stability',    shapValue: -2.4 },
      { name: 'Low Gas Baseline', shapValue: -1.9 },
      { name: 'ECD Margin',       shapValue: -1.5 },
      { name: 'WOB Control',      shapValue: -1.1 },
      { name: 'Bit Wear Index',   shapValue: +0.3 },
    ],
    anomaly: null,
  },

  // ── BRAHMA-3 (Safe) ──────────────────────────────────────────────────────────
  {
    id: 'brahma-3',
    name: 'Brahma-3',
    field: 'CB-ONN-2003/2',
    operator: 'Gujarat State Petroleum',
    rigName: 'Aban Abraham',
    totalDepth: 3800,
    currentDepth: 3245,
    targetFormation: 'Bhuvan Sands',
    coordinates: { lat: 22.31, lng: 72.74 },
    status: 'active',
    risk: { composite: 22, anomalyProb: 0.14, confidence: 0.93, level: 'normal' },
    formations: cbFormations,
    casingShoes: cbCasings,
    bha: cbBHA,
    telemetry: genTelemetry(60, 38, 22, 76, 10.4, 2450, 10.6, 540, 8),
    timeline: brahmaTimeline,
    shap: brahmaShap,
    anomaly: null,
  },

  // ── VINDHYA-2 (Offline) ──────────────────────────────────────────────────────
  {
    id: 'vindhya-2',
    name: 'Vindhya-2',
    field: 'VIN/ONN-2004/1',
    operator: 'ONGC Ltd.',
    rigName: 'Land Rig VR-09',
    totalDepth: 3200,
    currentDepth: 1840,
    targetFormation: 'Semri Group',
    coordinates: { lat: 24.58, lng: 82.14 },
    status: 'offline',
    risk: { composite: 0, anomalyProb: 0, confidence: 0, level: 'offline' },
    formations: vindhyaFormations,
    casingShoes: [
      { name: 'Conductor', depth: 100, od: 20, id_: 18.5, weight: 133, grade: 'K-55' },
      { name: 'Surface',   depth: 600, od: 13.375, id_: 12.415, weight: 68, grade: 'K-55' },
    ],
    bha: cbBHA,
    telemetry: [],
    timeline: [
      { id: 'v1', timestamp: now - mins(2880), severity: 'warning', description: 'Rig demobilised for maintenance. SCADA offline.' },
    ],
    shap: [],
    anomaly: null,
  },

  // ── GANGA-NORTH-4 (Warning) ──────────────────────────────────────────────────
  {
    id: 'ganga-n4',
    name: 'Ganga-North-4',
    field: 'GN-ON-A/1',
    operator: 'OIL India Ltd.',
    rigName: 'Rig Master II',
    totalDepth: 3600,
    currentDepth: 2760,
    targetFormation: 'Kaimur Sands',
    coordinates: { lat: 26.87, lng: 94.13 },
    status: 'active',
    risk: { composite: 61, anomalyProb: 0.57, confidence: 0.82, level: 'warning' },
    formations: vindhyaFormations,
    casingShoes: [
      { name: 'Conductor', depth: 120, od: 26, id_: 24.5, weight: 194, grade: 'K-55' },
      { name: 'Surface',   depth: 800, od: 18.625, id_: 17.5, weight: 87.5, grade: 'K-55' },
      { name: 'Intermediate', depth: 2400, od: 13.375, id_: 12.415, weight: 54.5, grade: 'N-80' },
    ],
    bha: standardBHA,
    telemetry: genTelemetry(60, 42, 30, 80, 12.1, 2720, 11.1, 580, 24),
    timeline: [
      { id: 'g1', timestamp: now - mins(300), severity: 'info',    description: 'Formation change — entering Kaimur Sands. Core sample requested.' },
      { id: 'g2', timestamp: now - mins(160), severity: 'warning', description: 'Tight hole observed. Reaming 30 ft to bottom. Possible shale swelling.' },
      { id: 'g3', timestamp: now - mins(80),  severity: 'warning', description: 'Slow drilling: ROP dropped to 28 ft/hr. WOB increased to maintain progress.' },
    ],
    shap: [
      { name: 'Tight Hole Indicator',  shapValue: +2.1 },
      { name: 'ROP Decline',           shapValue: +1.6 },
      { name: 'Shale Activity Index',  shapValue: +1.3 },
      { name: 'Mud Inhibition Level',  shapValue: -0.7 },
      { name: 'Standpipe Pressure',    shapValue: +0.9 },
      { name: 'Offset Well Analogy',   shapValue: -1.0 },
    ],
    anomaly: {
      id: 'anom-gn4',
      detectedAt: now - mins(160),
      severity: 'medium',
      suspectedCause: 'Shale Swelling / Tight Hole',
      affectedParameter: 'ROP, WOB, Hole Caliper',
      description:
        'Progressive ROP decline with elevated WOB requirements indicates reactive shale swelling in the Semri Group. Risk of stuck pipe if condition persists.',
    },
  },
];

export const getWell = (id: string): Well | undefined =>
  wells.find((w) => w.id === id);
