import { useState, useRef, useEffect, FormEvent, KeyboardEvent, ClipboardEvent } from "react";
import { Mail, Keyboard, ChevronRight, Lock, Key, AlertCircle, Sparkles } from "lucide-react";
import { AuthSession, LogEntry } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface OtpLoginFormProps {
  onLoginSuccess: (session: AuthSession) => void;
  onLog: (log: LogEntry) => void;
}

export default function OtpLoginForm({ onLoginSuccess, onLog }: OtpLoginFormProps) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [otpCells, setOtpCells] = useState<string[]>(Array(6).fill(""));
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [demoActiveCode, setDemoActiveCode] = useState<string | null>(null);

  const cellRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset focus on mount or status step shift
  useEffect(() => {
    if (step === "otp" && cellRefs.current[0]) {
      cellRefs.current[0].focus();
    }
  }, [step]);

  // Handle email submission
  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please input a valid email address.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setDemoMessage(null);
    setDemoActiveCode(null);

    const logEntry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      method: "POST",
      endpoint: "/api/auth/send-otp",
      payload: { email },
      status: 0,
      response: null
    };

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      logEntry.status = response.status;
      logEntry.response = data;

      if (!response.ok) {
        logEntry.isError = true;
        throw new Error(data.error || "Failed to deliver OTP request.");
      }

      onLog(logEntry);

      if (data.mode === "demo") {
        setDemoMessage(data.message);
        setDemoActiveCode(data.code);
        // Autofill first digit for easier demo testing or just prompt beautifully
      }

      setStep("otp");
    } catch (err: any) {
      setError(err.message || "Connection refused to OTP server.");
      logEntry.isError = true;
      logEntry.response = { error: err.toString() };
      onLog(logEntry);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle passcode cells logic
  const handleCellChange = (value: string, index: number) => {
    // Only accept numbers
    const cleanValue = value.replace(/[^0-9]/g, "");
    if (!cleanValue) {
      const newOtp = [...otpCells];
      newOtp[index] = "";
      setOtpCells(newOtp);
      return;
    }

    // Take current single digit
    const digit = cleanValue.substring(cleanValue.length - 1);
    const newOtp = [...otpCells];
    newOtp[index] = digit;
    setOtpCells(newOtp);

    // Auto-focus next cell
    if (index < 5 && cellRefs.current[index + 1]) {
      cellRefs.current[index + 1]?.focus();
    }
  };

  const handleCellKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (otpCells[index] === "") {
        // If current cell is empty, delete previous and move focus back
        if (index > 0) {
          const newOtp = [...otpCells];
          newOtp[index - 1] = "";
          setOtpCells(newOtp);
          cellRefs.current[index - 1]?.focus();
          e.preventDefault();
        }
      } else {
        // Clear current cell
        const newOtp = [...otpCells];
        newOtp[index] = "";
        setOtpCells(newOtp);
      }
    }
  };

  // Allow pasting 6 digits
  const handleCellPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setOtpCells(digits);
      // Focus last item
      cellRefs.current[5]?.focus();
    }
  };

  // Triggers verification
  const handleVerifyOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const fullCode = otpCells.join("");
    if (fullCode.length < 6) {
      setError("Please enter the complete 6-digit passcode.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const logEntry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      method: "POST",
      endpoint: "/api/auth/verify-otp",
      payload: { email, code: fullCode },
      status: 0,
      response: null
    };

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode })
      });

      const data = await response.json();
      logEntry.status = response.status;
      logEntry.response = data;

      if (!response.ok) {
        logEntry.isError = true;
        throw new Error(data.error || "Incorrect code details or expired OTP.");
      }

      onLog(logEntry);

      // On successful login
      onLoginSuccess({
        token: data.token,
        user: data.user,
        mode: data.mode
      });

    } catch (err: any) {
      setError(err.message || "Failed to confirm passcode.");
      logEntry.isError = true;
      logEntry.response = { error: err.toString() };
      onLog(logEntry);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto trigger verification when all cells are filled
  useEffect(() => {
    if (otpCells.join("").length === 6 && step === "otp") {
      handleVerifyOtp();
    }
  }, [otpCells, step]);

  return (
    <div id="otp-login-card" className="bg-white/[0.02] border border-white/10 rounded-sm p-6 lg:p-8 shadow-2xl backdrop-blur-md">
      
      {/* Visual Header / Brand Icon */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-12 h-12 bg-white/[0.02] border border-white/10 rounded-full flex items-center justify-center text-white mb-4">
          {step === "email" ? (
            <Mail className="w-5 h-5 shrink-0 text-white/80" />
          ) : (
            <Lock className="w-5 h-5 shrink-0 text-white animate-pulse" />
          )}
        </div>
        <h3 className="font-serif italic font-light text-3xl text-white tracking-tight">
          {step === "email" ? "Sign into your account" : "Enter Secure Passcode"}
        </h3>
        <p className="text-white/40 text-xs mt-2 max-w-xs leading-relaxed">
          {step === "email" 
            ? "We will email you a secure, 6-digit passcode. No passwords required." 
            : `We mailed a temporary access code to ${email}`}
        </p>
      </div>

      {/* Error Output Banner */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-rose-950/20 border border-rose-900/30 text-rose-200 rounded-sm flex gap-3 text-xs leading-relaxed"
        >
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-rose-400">Verification Failure:</span> {error}
          </div>
        </motion.div>
      )}

      {/* Demo Active Credentials Warning */}
      {demoMessage && step === "otp" && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 p-5 bg-white/[0.02] border border-white/10 rounded-sm text-white/95 flex flex-col gap-3"
        >
          <div className="flex gap-2 text-xs font-semibold uppercase tracking-widest text-emerald-400">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Simulated Mailbox Packet:</span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed font-normal">
            Your dynamic 6-digit OTP passcode generated by node-backend is:
          </p>
          <div className="py-2 flex justify-center">
            <button 
              id="autofill-otp-demo-btn"
              onClick={() => {
                if (demoActiveCode) {
                  setOtpCells(demoActiveCode.split(""));
                }
              }}
              className="py-2 px-5 bg-white text-black font-mono font-bold tracking-widest rounded-sm hover:bg-neutral-200 transition-colors flex items-center gap-2.5 cursor-pointer text-xs"
            >
              <Key className="w-4 h-4 text-black/50" />
              <span>{demoActiveCode}</span>
              <span className="text-[9px] font-sans bg-black/10 px-1.5 py-0.5 rounded uppercase font-semibold">Click to Autofill</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Forms Area */}
      <AnimatePresence mode="wait">
        {step === "email" ? (
          <motion.form 
            key="email-form"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleRequestOtp} 
            className="space-y-4"
          >
            <div>
              <label htmlFor="auth-email-input" className="block text-[10px] uppercase tracking-widest font-semibold text-white/40 mb-2">
                Your Email Address
              </label>
              <div className="relative rounded-sm focus-within:ring-1 focus-within:ring-white/20 transition-all bg-white/[0.02] border border-white/10">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/30">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-transparent text-white text-sm focus:outline-none placeholder:text-white/20 border-0"
                />
              </div>
            </div>

            <button
              id="send-otp-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-white text-black hover:bg-neutral-200 text-xs font-bold uppercase tracking-widest rounded-sm disabled:bg-white/10 disabled:text-white/20 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? "Generating Code..." : "Receive Access Code"}
              {!isLoading && <ChevronRight className="w-4 h-4" />}
            </button>
          </motion.form>
        ) : (
          <motion.form 
            key="otp-form"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleVerifyOtp} 
            className="space-y-5"
          >
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-semibold text-white/40 mb-2 text-center">
                6-Digit Secure Entrance Key
              </label>
              
              <div className="flex gap-2 justify-center py-2">
                {otpCells.map((val, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { cellRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleCellChange(e.target.value, idx)}
                    onKeyDown={(e) => handleCellKeyDown(e, idx)}
                    onPaste={handleCellPaste}
                    className="w-11 h-13 sm:w-12 sm:h-14 font-mono font-bold text-xl sm:text-2xl text-center border border-white/10 focus:border-white/40 focus:ring-1 focus:ring-white/20 rounded-sm outline-none transition-all uppercase bg-white/[0.02] text-white"
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 py-2">
              <button
                id="verify-otp-btn"
                type="submit"
                disabled={isLoading || otpCells.join("").length < 6}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-widest rounded-sm disabled:bg-white/10 disabled:text-white/20 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? "Authorizing Security Token..." : "Confirm Entrance Code"}
              </button>

              <button
                id="resend-nav-back-button"
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtpCells(Array(6).fill(""));
                  setError(null);
                }}
                className="w-full text-center text-[10px] uppercase tracking-widest font-semibold text-white/40 hover:text-white/80 py-1"
              >
                ← Back to email input
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-8 border-t border-white/5 pt-5 text-center">
        <p className="text-[10px] text-white/30 font-mono tracking-widest uppercase">
          SECURE PASSPORT PORTAL • WEB TOKEN TIMED AT 24H
        </p>
      </div>

    </div>
  );
}
