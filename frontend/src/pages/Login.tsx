import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ShieldCheck, Key, User, ArrowRight, Sun, Moon, Radio, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import StatusDot from '../components/ui/StatusDot';

export default function Login() {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Lead Subsurface Engineer' | 'Drilling Superintendent' | 'Real-Time SCADA Operator'>(
    'Lead Subsurface Engineer'
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!empId.trim()) {
      setError('Please provide your Employee ID.');
      return;
    }

    if (!password.trim()) {
      setError('Please provide your Access PIN / Password.');
      return;
    }

    setLoading(true);
    try {
      await login(empId.trim(), password.trim(), role);
      navigate('/wells');
    } catch (err: any) {
      setError(err?.message || 'Invalid Employee ID or Password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-ivory-100 dark:bg-night-950 text-ink-900 dark:text-ivory-100 p-4 sm:p-8 transition-colors">
      
      {/* ── Top Bar with Theme Toggle & SCADA Live ───────────────────────── */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-sm bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Compass size={16} className="text-gold" />
          </div>
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-ink-900 dark:text-ivory-100">
            eRTMAC-NWIS
          </span>
          <span className="badge bg-gold/10 text-gold border border-gold/20 text-[9px] px-1.5 py-0.5">
            v2.4
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-sm bg-white dark:bg-night-900 border border-ivory-300 dark:border-night-700">
            <StatusDot level="online" pulse size="sm" />
            <span className="num text-[10px] text-ink-400 dark:text-night-500">GATEWAY 200 OK</span>
          </div>

          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-sm bg-white dark:bg-night-900 border border-ivory-300 dark:border-night-700 text-ink-600 dark:text-night-400 hover:text-gold transition-colors"
            title="Toggle theme"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* ── Center Login Card ────────────────────────────────────────────── */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="card p-6 sm:p-8 shadow-sm border border-ivory-300 dark:border-night-700 bg-white dark:bg-night-900 rounded-sm">
          
          {/* Header */}
          <div className="mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <span className="section-label">Subsurface Intelligence Access</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink-900 dark:text-ivory-100">
              National Well System
            </h1>
            <p className="text-xs text-ink-400 dark:text-night-500 mt-1">
              Sign in to monitor real-time telemetry, 3D wellbore twins, and SCADA anomalies.
            </p>
          </div>

          {/* Operational Access Notice */}
          <div className="mb-5 p-2.5 bg-ivory-50 dark:bg-night-800/60 rounded-sm border border-ivory-200 dark:border-night-700/60 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-ink-700 dark:text-ivory-300 truncate">
                Operational Access: <span className="text-ink-500 dark:text-night-400">Authorized Personnel Only</span>
              </p>
            </div>
            <span className="text-[10px] num px-2 py-0.5 rounded bg-gold/10 text-gold border border-gold/20">
              JWT SECURE
            </span>
          </div>

          {/* Error notice */}
          {error && (
            <div className="mb-5 px-3 py-2 text-[12px] bg-risk-high/10 text-risk-high border border-risk-high/30 rounded-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Employee ID */}
            <div>
              <label className="section-label block mb-1.5" htmlFor="empId">
                Employee Identification
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-ink-400 dark:text-night-500">
                  <User size={14} />
                </span>
                <input
                  id="empId"
                  type="text"
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  placeholder="e.g. EMP-0042"
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-ivory-50 dark:bg-night-800 border border-ivory-300 dark:border-night-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-gold text-ink-900 dark:text-ivory-100 placeholder:text-ink-400 dark:placeholder:text-night-500 num"
                />
              </div>
            </div>

            {/* Access Password / Security PIN */}
            <div>
              <label className="section-label block mb-1.5" htmlFor="password">
                Security Passcode
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-ink-400 dark:text-night-500">
                  <Key size={14} />
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-[13px] bg-ivory-50 dark:bg-night-800 border border-ivory-300 dark:border-night-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-gold text-ink-900 dark:text-ivory-100 placeholder:text-ink-400 dark:placeholder:text-night-500 num"
                />
              </div>
            </div>

            {/* Operational Role Selector */}
            <div>
              <label className="section-label block mb-1.5" htmlFor="role">
                Operational Clearance
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 text-[12px] bg-ivory-50 dark:bg-night-800 border border-ivory-300 dark:border-night-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-gold text-ink-900 dark:text-ivory-100 cursor-pointer"
              >
                <option value="Lead Subsurface Engineer">Lead Subsurface Engineer (Full Ops)</option>
                <option value="Drilling Superintendent">Drilling Superintendent (Fleet Supervisory)</option>
                <option value="Real-Time SCADA Operator">Real-Time SCADA Operator (Sensor Feed Only)</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full mt-2 inline-flex items-center justify-center gap-2
                py-2.5 px-4 rounded-sm text-[13px] font-semibold tracking-wide
                bg-gold hover:bg-gold-600 text-night-950
                transition-all duration-150 disabled:opacity-50
                cursor-pointer shadow-sm
              "
            >
              {loading ? (
                <span className="num">AUTHENTICATING...</span>
              ) : (
                <>
                  Connect To Subsurface Telemetry <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Security badge footer */}
          <div className="mt-6 pt-4 border-t border-ivory-200 dark:border-night-800 flex items-center justify-between text-[10px] text-ink-400 dark:text-night-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-risk-low" /> 256-bit TLS Encrypted
            </span>
            <span className="num">SERVER NODE #09</span>
          </div>

        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between text-[11px] text-ink-400 dark:text-night-500 gap-2 py-2">
        <p>© 2026 National Well Information System (NWIS). All rights reserved.</p>
        <p className="num">eRTMAC Secure Operational Platform · v2.4</p>
      </div>

    </div>
  );
}
