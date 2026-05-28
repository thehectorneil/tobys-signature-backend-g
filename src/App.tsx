import { useState, useEffect } from "react";
import { AuthStatus, AuthSession, LogEntry } from "./types";
import DiagnosticConsole from "./components/DiagnosticConsole";
import OtpLoginForm from "./components/OtpLoginForm";
import UserProfile from "./components/UserProfile";
import { 
  ShieldAlert, 
  Terminal, 
  Trash2, 
  RefreshCw, 
  Link2, 
  Activity, 
  Cpu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing session on initial mount
  useEffect(() => {
    const saved = localStorage.getItem("auth_otp_session");
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem("auth_otp_session");
      }
    }
    // Fetch initial diagnostic checks
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setServerOnline(true);
      } else {
        setServerOnline(false);
      }
    } catch (e) {
      setServerOnline(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    localStorage.setItem("auth_otp_session", JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem("auth_otp_session");
    
    // Log the transaction
    addLog({
      timestamp: new Date().toLocaleTimeString(),
      method: "CLIENT",
      endpoint: "session_terminate",
      payload: {},
      status: 200,
      response: { message: "Client session cleared from local storage." }
    });
  };

  const addLog = (newLog: LogEntry) => {
    setLogs((prev) => [newLog, ...prev].slice(0, 30)); // Keep last 30 logs
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-[#050505] text-white antialiased font-sans selection:bg-white/20 flex flex-col justify-between p-6 sm:p-12">
      
      <div className="max-w-7xl mx-auto w-full space-y-10 flex-1 flex flex-col justify-between">
        
        {/* Elegant Serif & Upper Navigation Header */}
        <header id="app-primary-header" className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline border-b border-white/10 pb-8 mb-4">
          <div className="flex flex-col">
            <h1 className="text-4xl font-serif italic font-light tracking-tight text-white">SecureAuth Node</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mt-2">Authentication Orchestrator • Node.js + Resend + Supabase</p>
          </div>
          <div className="flex gap-4 sm:gap-8 text-[11px] uppercase tracking-widest text-white/60 mt-4 sm:mt-0">
            <span className="flex items-center gap-1.5">
              Operational Status:{" "}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono tracking-wider font-semibold ${
                serverOnline 
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" 
                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
              }`}>
                {serverOnline ? "Healthy" : "Offline"}
              </span>
            </span>
            <span>v2.4.0</span>
          </div>
        </header>

        {/* Main Content Grid Area */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start flex-1 w-full my-4">
          
          {/* Left Column: Visual Login Controls / User Session Card */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-8">
            <AnimatePresence mode="wait">
              {session ? (
                <motion.div
                  key="user-profile-zone"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.2 }}
                >
                  <UserProfile 
                    session={session} 
                    onLogout={handleLogout} 
                    onLog={addLog}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="otp-login-zone"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <OtpLoginForm 
                    onLoginSuccess={handleLoginSuccess} 
                    onLog={addLog}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Live Sophisticated Dark Terminal Feed */}
          <div className="lg:col-span-6 xl:col-span-5 space-y-6">
            <div id="live-terminal-panel" className="bg-white/[0.02] border border-white/10 rounded-sm overflow-hidden flex flex-col h-[520px] shadow-2xl relative">
              
              {/* Terminal Title Header */}
              <div className="bg-white/[0.04] px-5 py-4 flex items-center justify-between border-b border-white/10 select-none shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span className="font-mono text-[10px] tracking-widest text-white/50 uppercase font-bold">
                    Live Session Transaction Logs
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  {logs.length > 0 && (
                    <button
                      id="clear-logs-btn"
                      onClick={clearLogs}
                      title="Clear terminal logs"
                      className="p-1 text-white/40 hover:text-white/80 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Logs Stream */}
              <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-4 scroll-smooth">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/30 text-center space-y-2 py-12">
                    <Activity className="w-6 h-6 text-white/10 stroke-[1.2] animate-pulse" />
                    <p className="max-w-xs leading-relaxed text-xs">
                      Terminal listening... Request an OTP or check credentials below to begin capturing incoming JSON packets.
                    </p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {logs.map((log, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-4 rounded-sm border leading-normal transition-all ${
                          log.isError 
                            ? "bg-rose-950/20 text-rose-350 border-rose-900/30" 
                            : "bg-white/[0.02] text-white/80 border-white/5"
                        }`}
                      >
                        {/* Summary Header */}
                        <div className="flex justify-between items-center mb-2 border-b border-white/[0.03] pb-1.5 font-semibold text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${log.isError ? "bg-rose-500" : "bg-emerald-500"}`} />
                            <span className={log.isError ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                              {log.method}
                            </span>
                            <span className="text-white/40 font-mono text-[10px]">{log.endpoint}</span>
                          </span>
                          <span className="text-[10px] text-white/30">
                            {log.timestamp} • Code {log.status}
                          </span>
                        </div>

                        {/* Payload / Context */}
                        <div className="space-y-3 font-mono">
                          {log.payload && Object.keys(log.payload).length > 0 && (
                            <div>
                              <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Payload:</span>
                              <pre className="mt-1 max-h-24 overflow-y-auto p-2 bg-black/40 rounded-sm border border-white/5 block text-white/50 text-[10px] leading-relaxed select-all">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                          <div>
                            <span className="text-[9px] text-white/30 uppercase tracking-widest font-bold">Response:</span>
                            <pre className="mt-1 max-h-48 overflow-y-auto p-2 bg-black/40 rounded-sm border border-white/5 block text-white/80 text-[10px] leading-relaxed select-all">
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Terminal Stats Footer */}
              <div className="bg-white/[0.04] px-4 py-2.5 flex items-center justify-between border-t border-white/10 text-[10px] text-white/30 select-none font-mono">
                <span className="flex items-center gap-1">
                  <Cpu className="w-3 h-3 text-white/20" />
                  <span>Node.js express.v4 Host</span>
                </span>
                <span>Active Captures: {logs.length}</span>
              </div>

            </div>
          </div>

        </main>

        {/* Full Width Sophisticated Diagnostic Console Section */}
        <div id="diagnostic-console-section" className="pt-6 border-t border-white/10">
          <DiagnosticConsole 
            status={status}
            serverOnline={serverOnline}
            onRefresh={fetchStatus}
            isLoading={isLoading}
          />
        </div>

        {/* Brand Theme Footer Alignment */}
        <footer className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-12">
          <div className="flex flex-wrap gap-x-12 gap-y-4">
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-1">Resend Domain Relay</span>
              <span className="text-xs font-mono text-white/70">
                {status?.config?.resendFromEmail || "onboarding@resend.dev"}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-[0.15em] text-white/30 mb-1">Supabase Target Table</span>
              <span className="text-xs font-mono text-white/70">public.profiles_auth</span>
            </div>
          </div>
          <button
            onClick={() => {
              const element = document.getElementById("diagnostic-console-section");
              if (element) element.scrollIntoView({ behavior: "smooth" });
            }}
            className="bg-white text-black text-[10px] px-6 py-2.5 rounded-full uppercase tracking-widest font-semibold hover:bg-neutral-200 transition-colors cursor-pointer text-center font-sans"
          >
            Diagnostics & Migration View
          </button>
        </footer>

      </div>

    </div>
  );
}
