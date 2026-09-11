// ─── Domain Types ──────────────────────────────────────────────────────────────

export type RiskLevel = 'critical' | 'warning' | 'normal' | 'offline';
export type WellStatus = 'active' | 'critical' | 'offline' | 'completed';
export type Lithology =
  | 'sandstone'
  | 'shale'
  | 'limestone'
  | 'dolomite'
  | 'salt'
  | 'anhydrite';
export type BHAType =
  | 'bit'
  | 'motor'
  | 'mwd'
  | 'hwdp'
  | 'stabilizer'
  | 'jar'
  | 'collar';
export type IncidentSeverity = 'info' | 'warning' | 'critical';

// ─── Geological ────────────────────────────────────────────────────────────────

export interface Formation {
  name: string;
  topDepth: number;     // ft TVD
  bottomDepth: number;  // ft TVD
  lithology: Lithology;
  color: string;        // hex for Three.js
}

// ─── Well Engineering ──────────────────────────────────────────────────────────

export interface CasingShoe {
  name: string;
  depth: number;   // ft
  od: number;      // outer diameter, inches
  id_: number;     // inner diameter, inches (id is reserved)
  weight: number;  // lb/ft
  grade: string;
}

export interface BHAComponent {
  name: string;
  od: number;       // inches
  length: number;   // ft
  type: BHAType;
  description: string;
}

// ─── Telemetry ─────────────────────────────────────────────────────────────────

export interface SensorReading {
  timestamp: number;    // unix ms
  rop: number;          // ft/hr
  wob: number;          // klbs
  rpm: number;
  torque: number;       // ft-lbs ×1000
  spp: number;          // standpipe pressure psi
  ecd: number;          // equivalent circulating density ppg
  flowIn: number;       // gpm
  flowOut: number;      // gpm
  pitLevel: number;     // bbls
  gasUnits: number;     // total gas units
  porePress: number;    // ppg equivalent
  fractureGrad: number; // ppg equivalent
}

// ─── Risk & AI ─────────────────────────────────────────────────────────────────

export interface WellRisk {
  composite: number;   // 0–100
  anomalyProb: number; // 0–1
  confidence: number;  // 0–1
  level: RiskLevel;
}

export interface ShapFeature {
  name: string;
  shapValue: number; // negative = reduces risk, positive = increases risk
}

// ─── Events ────────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  timestamp: number;
  severity: IncidentSeverity;
  description: string;
  parameter?: string;
  value?: number;
}

export interface AnomalyRecord {
  id: string;
  detectedAt: number;
  severity: 'low' | 'medium' | 'high';
  suspectedCause: string;
  affectedParameter: string;
  description: string;
}

// ─── Well ──────────────────────────────────────────────────────────────────────

export interface Well {
  id: string;
  name: string;
  field: string;
  operator: string;
  rigName: string;
  totalDepth: number;    // ft TVD
  currentDepth: number;  // ft TVD
  targetFormation: string;
  coordinates: { lat: number; lng: number };
  status: WellStatus;
  risk: WellRisk;
  formations: Formation[];
  casingShoes: CasingShoe[];
  bha: BHAComponent[];
  telemetry: SensorReading[];
  timeline: TimelineEvent[];
  anomaly: AnomalyRecord | null;
  shap: ShapFeature[];
}

export * from './api';
