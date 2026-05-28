import { useState, useEffect } from "react";
import { User, LogEntry, AuthSession } from "../types";
import { 
  LogOut, 
  ShieldCheck, 
  Copy, 
  Check, 
  Clock, 
  Fingerprint, 
  UserCircle2, 
  Sparkles,
  Award
} from "lucide-react";

interface UserProfileProps {
  session: AuthSession;
  onLogout: () => void;
  onLog: (log: LogEntry) => void;
}

export default function UserProfile({ session, onLogout, onLog }: UserProfileProps) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [profileData, setProfileData] = useState<User | null>(session.user);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(session.token);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 1500);
  };

  // Run a test call to /api/auth/me on mount to prove bearer validation works
  useEffect(() => {
    const fetchMe = async () => {
      setIsRefreshing(true);
      const logEntry: LogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        method: "GET",
        endpoint: "/api/auth/me",
        payload: null,
        status: 0,
        response: null
      };

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            "Authorization": `Bearer ${session.token}`
          }
        });
        const data = await response.json();
        logEntry.status = response.status;
        logEntry.response = data;
        
        if (response.ok && data.success) {
          setProfileData(data.user);
        } else {
          logEntry.isError = true;
        }
        onLog(logEntry);
      } catch (err: any) {
        logEntry.isError = true;
        logEntry.response = { error: err.toString() };
        onLog(logEntry);
      } finally {
        setIsRefreshing(false);
      }
    };

    fetchMe();
  }, [session.token]);

  return (
    <div id="user-profile-panel" className="bg-white/[0.02] border border-white/10 rounded-sm overflow-hidden shadow-2xl backdrop-blur-md">
      
      {/* Banner */}
      <div className="bg-white/[0.03] border-b border-white/10 px-6 py-8 text-white relative">
        <div className="absolute top-4 right-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-[9px] font-mono font-bold uppercase tracking-widest ${
            session.mode === "live" 
              ? "bg-green-500/10 text-green-300 border border-green-500/20" 
              : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
          }`}>
            <span className={`w-1 h-1 rounded-full ${session.mode === "live" ? "bg-green-400" : "bg-amber-400"}`} />
            {session.mode === "live" ? "Supabase Live" : "Sandbox Demo"}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/[0.02] rounded-full border border-white/15 flex items-center justify-center text-white shrink-0">
            <UserCircle2 className="w-8 h-8 text-white/70" />
          </div>
          <div>
            <h3 className="font-serif italic font-light text-2xl tracking-tight text-white m-0">
              Session Verified
            </h3>
            <p className="text-white/40 text-[10px] mt-1 font-mono">
              Passport Record ID: {profileData?.id || "checking..."}
            </p>
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-6 lg:p-8 space-y-6">
        
        {/* Core Profile Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Email Item */}
          <div className="p-4 bg-white/[0.01] border border-white/5 rounded-sm space-y-1">
            <span className="text-[9px] font-semibold text-white/40 uppercase tracking-widest">Signed in as</span>
            <div className="font-mono text-xs text-white/90 truncate">{profileData?.email || session.user.email}</div>
          </div>

          {/* Account Created Item */}
          <div className="p-4 bg-white/[0.01] border border-white/5 rounded-sm space-y-1">
            <span className="text-[9px] font-semibold text-white/40 uppercase tracking-widest">Last Transaction</span>
            <div className="font-serif italic text-base text-white/90 flex items-center gap-1.5 truncate">
              <Clock className="w-3.5 h-3.5 text-white/30" />
              <span>{profileData?.last_login ? new Date(profileData.last_login).toLocaleTimeString() : "Just now"}</span>
            </div>
          </div>
        </div>

        {/* Database Identity Status Card */}
        <div className="p-4 border border-emerald-500/10 rounded-sm bg-emerald-500/[0.03] flex gap-3 text-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-serif italic text-emerald-300 text-base">User Profile Record Confirmed</div>
            <p className="text-xs text-white/50 leading-relaxed font-sans">
              Your profile is verified and active on database indexing. In Live Mode, this corresponds directly to a row inside your Supabase <code className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-1 py-0.25 rounded font-mono">profiles</code> schema relation.
            </p>
          </div>
        </div>

        {/* Session Token Copy Box */}
        <div className="space-y-2">
          <label className="block text-[10px] uppercase tracking-widest font-semibold text-white/40">
            Authorization Passport (Session Token)
          </label>
          <div className="flex rounded-sm overflow-hidden border border-white/10">
            <div className="bg-white/[0.02] px-3 flex items-center border-r border-white/10 font-mono text-[10px] text-white/30 shrink-0 select-none uppercase tracking-widest font-semibold">
              Bearer
            </div>
            <div className="flex-1 min-w-0 bg-black/40 text-white/70 px-4 py-2.5 font-mono text-xs truncate leading-relaxed">
              {session.token}
            </div>
            <button
              id="copy-session-token-btn"
              onClick={handleCopyToken}
              className="bg-white/[0.02] hover:bg-white/[0.06] border-l border-white/10 px-4 py-2.5 text-white/50 hover:text-white transition-colors shrink-0 flex items-center justify-center cursor-pointer"
            >
              {copiedToken ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            This token contains a secure passport issued by the Node.js Express server to identify and protect route requests (such as <code className="bg-white/[0.03] text-white/70 px-1 py-0.5 rounded-sm font-mono">/api/auth/me</code>).
          </p>
        </div>

        {/* Sign Out Button */}
        <div className="pt-5 border-t border-white/5 flex items-center justify-between">
          <div className="text-[9px] uppercase tracking-widest text-white/30 font-mono">
            SECURE CLIENT PERSISTED
          </div>
          <button
            id="sign-out-btn"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-semibold uppercase tracking-wider rounded-sm transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Terminate Passport Session</span>
          </button>
        </div>

      </div>

    </div>
  );
}
