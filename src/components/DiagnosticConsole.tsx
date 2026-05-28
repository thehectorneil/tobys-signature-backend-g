import { useState, useEffect } from "react";
import { 
  Database, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Copy, 
  Check, 
  Terminal, 
  Settings, 
  ChevronUp, 
  ChevronDown,
  RefreshCw
} from "lucide-react";
import { AuthStatus } from "../types";

const DEFAULT_SQL_SETUP_SCRIPT = `-- Execute this SQL in your Supabase SQL Editor:

-- 1. Create OTP table
CREATE TABLE IF NOT EXISTS otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE
);

-- 2. Create high-performance index
CREATE INDEX IF NOT EXISTS idx_otps_email_verified ON otps(email, verified);

-- 3. Create User Profile storage
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);`;

interface DiagnosticConsoleProps {
  status: AuthStatus | null;
  serverOnline: boolean;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function DiagnosticConsole({ status, serverOnline, onRefresh, isLoading }: DiagnosticConsoleProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleCopySql = () => {
    const sql = status?.checks?.sqlSetupScript || DEFAULT_SQL_SETUP_SCRIPT;
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isConfigured = status?.config?.isFullyConfigured ?? false;
  const otpsTableOk = status?.checks?.otpsTableExists ?? false;
  const profilesTableOk = status?.checks?.profilesTableExists ?? false;
  const isHealthyResult = serverOnline && isConfigured && otpsTableOk && profilesTableOk;

  return (
    <div 
      id="diagnostic-console-wrapper" 
      className="bg-white/[0.02] border border-white/10 rounded-sm overflow-hidden text-sm shadow-2xl"
    >
      {/* Header */}
      <div 
        id="diagnostic-header"
        className="flex items-center justify-between px-5 py-4 bg-white/[0.03] border-b border-white/10 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <Settings className="w-3.5 h-3.5 text-white/40 animate-spin-slow" />
          <h2 className="font-serif italic font-light text-xl text-white tracking-tight">
            Developer Integration Center
          </h2>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-[9px] font-mono font-bold uppercase tracking-widest ${
            isHealthyResult 
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" 
              : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
          }`}>
            <span className={`w-1 h-1 rounded-full ${isHealthyResult ? "bg-emerald-400" : "bg-amber-400"}`} />
            {isHealthyResult ? "Production Ready" : "Sandbox / Offline"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            id="refresh-diagnostics-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            disabled={isLoading}
            className="p-1 px-2.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-white/50 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </div>

      {isExpanded && (
        <div id="diagnostic-body" className="p-5 lg:p-6 space-y-6">
          {/* Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Server Online Card */}
            <div className="p-4 border border-white/5 rounded-sm bg-white/[0.01] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[9px] tracking-widest text-white/40 uppercase font-bold">Express Auth Server</span>
                <Terminal className="w-4 h-4 text-white/20" />
              </div>
              <div className="flex items-center gap-2">
                {serverOnline ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">Live & Listening</div>
                      <div className="text-xs text-white/40 font-mono mt-0.5">Port 3000 (Active Proxy)</div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-450 shrink-0" />
                    <div>
                      <div className="font-semibold text-rose-350">Booting / Offline</div>
                      <div className="text-xs text-rose-200/50 mt-0.5">Restarting backend daemon...</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Supabase Status Card */}
            <div className="p-4 border border-white/5 rounded-sm bg-white/[0.01] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[9px] tracking-widest text-white/40 uppercase font-bold">Supabase Client</span>
                <Database className="w-4 h-4 text-white/20" />
              </div>
              <div className="flex items-center gap-2 overflow-hidden">
                {status?.config?.supabaseConfigured ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="overflow-hidden">
                      <div className="font-semibold text-white">Connected & Secure</div>
                      <div className="text-xs text-white/40 font-mono mt-0.5 truncate">{status.config.supabaseUrl}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-amber-450 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">Variables Missing</div>
                      <div className="text-xs text-amber-300/60 mt-0.5">Running Sandbox fallbacks</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Resend Status Card */}
            <div className="p-4 border border-white/5 rounded-sm bg-white/[0.01] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[9px] tracking-widest text-white/40 uppercase font-bold">Resend Mail Delivery</span>
                <Mail className="w-4 h-4 text-white/20" />
              </div>
              <div className="flex items-center gap-2 overflow-hidden">
                {status?.config?.resendConfigured ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="overflow-hidden">
                      <div className="font-semibold text-white">Active Router</div>
                      <div className="text-xs text-white/40 font-mono mt-0.5 truncate">{status.config.resendFromEmail}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-amber-450 shrink-0" />
                    <div>
                      <div className="font-semibold text-white">Sandbox Delivery</div>
                      <div className="text-xs text-amber-300/60 mt-0.5">OTPs bypass to simulated console</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Database Setup Indicators */}
          {status?.config?.supabaseConfigured && (
            <div className="p-4 border border-white/5 bg-white/[0.01] rounded-sm">
              <h3 className="font-serif italic text-emerald-300 text-base flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-emerald-400" />
                Postgres Tables Health Audit
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  {otpsTableOk ? (
                    <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-300 px-3 py-1.5 rounded-sm font-medium border border-emerald-500/25">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      TABLE 'otp_verifications' REGISTERED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 bg-amber-500/15 text-amber-300 px-3 py-1.5 rounded-sm font-medium border border-amber-500/25">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      TABLE 'otp_verifications' NOT INDEXED
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {profilesTableOk ? (
                    <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-300 px-3 py-1.5 rounded-sm font-medium border border-emerald-500/25">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      TABLE 'users' REGISTERED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 bg-amber-500/15 text-amber-300 px-3 py-1.5 rounded-sm font-medium border border-amber-500/25">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      TABLE 'users' NOT INDEXED
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Demo Sandbox Alert */}
          {!isConfigured && (
            <div className="p-4 border border-amber-500/15 bg-amber-500/[0.02] text-amber-200 rounded-sm flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-450 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <div className="font-serif italic text-amber-300 text-base">Operating in Offline Developer Sandbox</div>
                <p className="text-xs text-white/50 leading-relaxed font-sans">
                  The credentials <code className="bg-amber-500/10 border border-amber-500/20 text-amber-250 px-1 py-0.5 rounded-sm font-mono">SUPABASE_URL</code>, <code className="bg-amber-500/10 border border-amber-500/20 text-amber-250 px-1 py-0.5 rounded-sm font-mono">SUPABASE_SERVICE_ROLE_KEY</code>, or <code className="bg-amber-500/10 border border-amber-500/20 text-amber-250 px-1 py-0.5 rounded-sm font-mono">RESEND_API_KEY</code> are not defined yet in your system backend secrets. 
                </p>
                <p className="text-xs text-white/60 leading-relaxed font-semibold font-sans">
                  You can still test and verify the entire login flow instantly! Requesting an OTP will generate a dynamic simulated passcode (rendered cleanly in the UI for autofilling), which goes through the exact token issuance, storage, and authorization verification channels locally.
                </p>
                <div className="text-xs text-white/40 pt-1 font-mono uppercase tracking-wide">
                  👉 Real Integration: Populate variables in the editor gear panel (Secrets), then restart development server.
                </div>
              </div>
            </div>
          )}

          {/* SQL Setup Migration Guide */}
          {(!otpsTableOk || !profilesTableOk || !isConfigured) && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] uppercase tracking-widest font-semibold text-white/40">
                  Supabase Database Setup Migration
                </label>
                <button
                  id="copy-sql-btn"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-neutral-200 text-black font-semibold text-xs rounded-sm transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-bold uppercase tracking-wider text-[10px]">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span className="uppercase tracking-wider text-[10px] font-bold">Copy SQL Script</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative rounded-sm overflow-hidden border border-white/10">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.02] border-b border-white/10 font-mono text-[10px] uppercase tracking-wider text-white/40">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>setup_migration.sql</span>
                </div>
                <pre className="p-4 bg-black/40 text-white/80 font-mono text-xs overflow-x-auto leading-relaxed max-h-64 select-all">
                  {status?.checks?.sqlSetupScript || DEFAULT_SQL_SETUP_SCRIPT}
                </pre>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">
                💡 Paste this DDL script block into the <strong>SQL Editor</strong> interface within your Supabase Console workspace, then press <strong>"Run"</strong>. This builds your data persistence schema immediately.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
