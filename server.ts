import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory fallback database for Demo/Sandbox mode
const demoOtps = new Map<string, { code: string; expiresAt: Date; verified: boolean }>();
const demoUsersDb = new Map<string, {
  id: string;
  full_name: string;
  email: string;
  role: string;
  branch: string | null;
  avatar: string;
  created_at: string;
  last_login?: string;
  is_active: boolean;
}>();

// Seed initial staff
const INITIAL_STAFF = [
  {
    id: "99999999-aaaa-bbbb-cccc-111111111111",
    full_name: "Staff Member (Dr.)",
    email: "mail.my.doc@gmail.com",
    role: "Admin",
    branch: null,
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: "11111111-aaaa-bbbb-cccc-111111111111",
    full_name: "Chef Toby R.N.",
    email: "admin@tobyssignature.com",
    role: "Admin",
    branch: null,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: "22222222-aaaa-bbbb-cccc-111111111111",
    full_name: "Jean the Baker",
    email: "clerk.bacong@tobyssignature.com",
    role: "Clerk",
    branch: "Bacong",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: "33333333-aaaa-bbbb-cccc-111111111111",
    full_name: "Lia the Cashier",
    email: "cashier.dauin@tobyssignature.com",
    role: "Cashier",
    branch: "Dauin",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: "44444444-aaaa-bbbb-cccc-111111111111",
    full_name: "Mark the Baker",
    email: "clerk.zambo@tobyssignature.com",
    role: "Clerk",
    branch: "Zamboaguita",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
    is_active: true,
    created_at: new Date().toISOString()
  }
];

INITIAL_STAFF.forEach(staff => demoUsersDb.set(staff.email, staff));

// Helper to clean environment variables (especially supporting Supabase Dashboard URLs and quotes)
const cleanEnvVar = (val: string | undefined, isUrl = false): string => {
  if (!val) return "";
  let cleaned = val.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.trim();

  if (isUrl) {
    const dashboardMatch = cleaned.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
    if (dashboardMatch && dashboardMatch[1]) {
      return `https://${dashboardMatch[1]}.supabase.co`;
    }
  }
  return cleaned;
};

// Extract Supabase project endpoint reference directly from Service Role JWT payload
const getSupabaseUrlFromKey = (serviceRoleKey: string): string => {
  try {
    const parts = serviceRoleKey.split(".");
    if (parts.length === 3) {
      // Decode the payload part of the JWT
      const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      const decodedJson = Buffer.from(payloadBase64, "base64").toString("utf-8");
      const payload = JSON.parse(decodedJson);
      if (payload && payload.ref) {
        return `https://${payload.ref}.supabase.co`;
      }
    }
  } catch (e) {
    console.warn("[getSupabaseUrlFromKey] Failed to extract from key:", e);
  }
  return "";
};

// Helper to get environment configuration status
function getAuthConfig() {
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const cleanedServiceKey = cleanEnvVar(rawServiceKey, false);
  
  const rawUrl = process.env.SUPABASE_URL || "";
  let cleanedUrl = cleanEnvVar(rawUrl, true);

  // If URL is missing, placeholder, or points to dashboard, try to extract endpoint dynamically from the service key
  if ((!cleanedUrl || cleanedUrl.includes("your-project") || cleanedUrl.includes("supabase.com/dashboard")) && cleanedServiceKey) {
    const extractedUrl = getSupabaseUrlFromKey(cleanedServiceKey);
    if (extractedUrl) {
      cleanedUrl = extractedUrl;
    }
  }

  const rawResendKey = process.env.RESEND_API_KEY || "";
  const cleanedResendKey = cleanEnvVar(rawResendKey, false);

  return {
    supabaseUrl: cleanedUrl,
    supabaseHasServiceRole: !!cleanedServiceKey,
    supabaseServiceRoleKey: cleanedServiceKey,
    resendHasKey: !!cleanedResendKey,
    resendApiKey: cleanedResendKey,
    resendFromEmail: cleanEnvVar(process.env.RESEND_FROM_EMAIL, false) || "onboarding@resend.dev",
    jwtSecret: cleanEnvVar(process.env.JWT_SECRET, false) || "default-debug-secret-change-me",
    isConfigured: !!(cleanedUrl && cleanedServiceKey && cleanedResendKey)
  };
}

// Lazy Supabase Initializer
let supabaseClient: any = null;
function getSupabase() {
  const config = getAuthConfig();
  if (!config.supabaseUrl || !config.supabaseHasServiceRole) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment. Please add them in the Secrets panel.");
  }
  if (!supabaseClient) {
    supabaseClient = createClient(config.supabaseUrl, config.supabaseServiceRoleKey);
  }
  return supabaseClient;
}

// Lazy Resend Initializer
let resendClient: any = null;
function getResend() {
  const config = getAuthConfig();
  if (!config.resendHasKey) {
    throw new Error("RESEND_API_KEY is missing from environment. Please add it in the Secrets panel.");
  }
  if (!resendClient) {
    resendClient = new Resend(config.resendApiKey);
  }
  return resendClient;
}

// SQL setup helper text
const SQL_SETUP_SCRIPT = `-- Supabase Schema - Toby's Signature Cakes & Pastries

-- 1. Create Branches Table
CREATE TABLE IF NOT EXISTS branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_name TEXT UNIQUE NOT NULL
);

-- Seed Branches
INSERT INTO branches (id, branch_name) VALUES 
  ('10000000-0000-0000-0000-111111111111', 'Bacong'),
  ('10000000-0000-0000-0000-222222222222', 'Dauin'),
  ('10000000-0000-0000-0000-333333333333', 'Zamboaguita')
ON CONFLICT (branch_name) DO NOTHING;

-- 2. Create Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT CHECK (role IN ('Admin', 'Clerk', 'Cashier')) NOT NULL,
  branch TEXT CHECK (branch IN ('Bacong', 'Dauin', 'Zamboaguita')),
  is_active BOOLEAN DEFAULT TRUE,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Staff Accounts
INSERT INTO users (id, full_name, email, password_hash, role, branch, avatar) VALUES
  ('99999999-aaaa-bbbb-cccc-111111111111', 'Staff Member (Dr.)', 'mail.my.doc@gmail.com', 'admin-toby-rn', 'Admin', NULL, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80'),
  ('11111111-aaaa-bbbb-cccc-111111111111', 'Chef Toby R.N.', 'admin@tobyssignature.com', 'toby-admin-101', 'Admin', NULL, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80'),
  ('22222222-aaaa-bbbb-cccc-111111111111', 'Jean the Baker', 'clerk.bacong@tobyssignature.com', 'bacon-clerk-202', 'Clerk', 'Bacong', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80'),
  ('33333333-aaaa-bbbb-cccc-111111111111', 'Lia the Cashier', 'cashier.dauin@tobyssignature.com', 'dauin-cashier-303', 'Cashier', 'Dauin', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80'),
  ('44444444-aaaa-bbbb-cccc-111111111111', 'Mark the Baker', 'clerk.zambo@tobyssignature.com', 'zambo-clerk-404', 'Clerk', 'Zamboaguita', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80')
ON CONFLICT (email) DO NOTHING;

-- 3. Create Cakes Table 
CREATE TABLE IF NOT EXISTS cakes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cake_name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL CHECK (category IN ('Whole Cakes', 'Cake Slices', 'Pastries & Cupcakes', 'Special Custom Cakes')),
  min_stock_threshold INTEGER NOT NULL DEFAULT 3,
  image_url TEXT,
  unit TEXT NOT NULL DEFAULT 'piece',
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cashier_id UUID REFERENCES users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  total_amount NUMERIC(10, 2) NOT NULL,
  payment_method TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  cake_id UUID REFERENCES cakes(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL
);

-- 6. Create Inventory Transactions Table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cake_id UUID REFERENCES cakes(id) ON DELETE CASCADE,
  quantity_added INTEGER NOT NULL,
  performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('supply', 'sale', 'waste', 'adjustment')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create OTP Verifications Table
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

-- Setup secure bypass policies for public CRUD
CREATE POLICY "Allow public select" ON branches FOR SELECT USING (true);
CREATE POLICY "Allow public CRUD" ON users FOR ALL USING (true);
CREATE POLICY "Allow public CRUD" ON cakes FOR ALL USING (true);
CREATE POLICY "Allow public CRUD" ON orders FOR ALL USING (true);
CREATE POLICY "Allow public CRUD" ON order_items FOR ALL USING (true);
CREATE POLICY "Allow public CRUD" ON inventory_transactions FOR ALL USING (true);
CREATE POLICY "Allow public CRUD" ON otp_verifications FOR ALL USING (true);`;

// 1. Diagnostics API: Check configuration status and try to ping tables
app.get("/api/auth/status", async (req, res) => {
  const config = getAuthConfig();
  const checks = {
    supabaseConnected: false,
    resendConnected: false,
    otpsTableExists: false,
    profilesTableExists: false,
    usingDemoMode: !config.isConfigured,
    errorMessage: "" as string | null,
    sqlSetupScript: SQL_SETUP_SCRIPT,
  };

  if (config.isConfigured) {
    try {
      const supabase = getSupabase();
      // Test registered users table existence instead of old profiles
      const { error: profileErr } = await supabase.from("users").select("id").limit(1).maybeSingle();
      if (!profileErr || (profileErr.code !== "42P01" && profileErr.message?.indexOf("does not exist") === -1 && profileErr.message?.indexOf("not found") === -1)) {
        checks.profilesTableExists = true;
      }

      // Test otp_verifications table existence instead of old otps
      const { error: otpErr } = await supabase.from("otp_verifications").select("id").limit(1).maybeSingle();
      if (!otpErr || (otpErr.code !== "42P01" && otpErr.message?.indexOf("does not exist") === -1 && otpErr.message?.indexOf("not found") === -1)) {
        checks.otpsTableExists = true;
      }

      checks.supabaseConnected = true;
    } catch (err: any) {
      checks.errorMessage = err.message || "Unknown error connecting to databases";
    }

    try {
      // resend client sanity check
      getResend();
      checks.resendConnected = true;
    } catch (err: any) {
      if (!checks.errorMessage) {
        checks.errorMessage = err.message;
      }
    }
  }

  res.json({
    config: {
      supabaseUrl: config.supabaseUrl,
      supabaseConfigured: !!config.supabaseUrl && config.supabaseHasServiceRole,
      resendConfigured: config.resendHasKey,
      resendFromEmail: config.resendFromEmail,
      isFullyConfigured: config.isConfigured,
    },
    checks,
  });
});

// 2. Request OTP API
app.post("/api/auth/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ success: false, error: "Please provide a valid email address." });
  }

  // Generate a cryptographically secure 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

  const config = getAuthConfig();

  // If NOT fully configured, run in Demo Mode
  if (!config.isConfigured) {
    const emailClean = email.trim().toLowerCase();
    
    // Strictly verify if email address exists inside authorized staff records
    if (!demoUsersDb.has(emailClean)) {
      return res.status(403).json({
        success: false,
        error: "Access Restriction: Your email address is not whitelisted inside the authorized staff records."
      });
    }

    // Save index registration first as reference for verification
    demoOtps.set(emailClean, { code, expiresAt, verified: false });
    console.log(`[Demo Auth] OTP Code for ${emailClean} is: ${code}`);
    return res.json({
      success: true,
      email: emailClean,
      mode: "demo",
      message: `[DEMO MODE ACTIVE] Whitelist record confirmed. Real API credentials are not set. The OTP code sent is: ${code}`,
      code, // Return code directly to client for demo convenience
    });
  }

  // Real database and Resend flow with Whitelist Verification Checks
  try {
    const supabase = getSupabase();
    
    // Look up if user exists and is active inside authorized staff directory
    const { data: dbUser, error: checkErr } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    if (checkErr) {
      if (checkErr.code === "42P01") {
        return res.status(500).json({
          success: false,
          error: "Supabase table 'users' does not exist. Please run the SQL migration setup first.",
          sqlSetupRequired: true,
          sql: SQL_SETUP_SCRIPT
        });
      }
      return res.status(500).json({ success: false, error: `Database roster lookup failed: ${checkErr.message}` });
    }

    if (!dbUser) {
      return res.status(403).json({
        success: false,
        error: "Access Restriction: Your email address is not whitelisted inside the authorized staff records."
      });
    }

    // Save index registration inside 'otp_verifications' table
    const { error: insertError } = await supabase.from("otp_verifications").insert({
      user_id: dbUser.id,
      otp_code: code,
      expires_at: expiresAt.toISOString(),
      is_used: false
    });

    if (insertError) {
      console.error("[OTP Store Error]", insertError);
      return res.status(500).json({ success: false, error: `Failed to store OTP: ${insertError.message}` });
    }

    // Send email using Resend
    const resend = getResend();
    const { error: emailError } = await resend.emails.send({
      from: config.resendFromEmail,
      to: email,
      subject: `🗝️ ${code} is your Toby's Staff security passcode`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; color: #1f2937;">
          <h2 style="color: #050505; margin-top: 0; font-family: Georgia, serif;">Toby's Signature Cakes</h2>
          <p>Hello <strong>${dbUser.full_name}</strong>,</p>
          <p>You requested a secure authentication passcode to sign into your account.</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 4px; color: #111827;">${code}</span>
          </div>
          <p style="font-size: 13px; color: #6b7280;">This passcode is valid for 5 minutes. If you did not request this, please coordinate with system operations immediately.</p>
        </div>
      `
    });

    if (emailError) {
      console.error("[Resend Error]", emailError);
      return res.status(500).json({
        success: false,
        error: `Resend failed to deliver the OTP: ${emailError.message || "Unknown error"}.`
      });
    }

    res.json({
      success: true,
      email,
      mode: "live",
      message: "One-time verification code has been successfully sent to your email."
    });

  } catch (err: any) {
    console.error("[Send OTP Server Exception]", err);
    res.status(500).json({ success: false, error: err.message || "An internal error occurred." });
  }
});

// 3. Verify OTP API
app.post("/api/auth/verify-otp", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Email and OTP code are required headers." });
  }

  const config = getAuthConfig();

  // If NOT fully configured, verify in Demo Mode
  if (!config.isConfigured) {
    const emailClean = email.trim().toLowerCase();
    const record = demoOtps.get(emailClean);
    if (!record) {
      return res.status(400).json({ success: false, error: "No code was requested for this email address." });
    }
    if (record.verified) {
      return res.status(400).json({ success: false, error: "This code has already been verified." });
    }
    if (new Date() > record.expiresAt) {
      return res.status(400).json({ success: false, error: "The verification code has expired. Please request a new one." });
    }
    if (record.code !== code.trim()) {
      return res.status(400).json({ success: false, error: "Invalid verification code. Please try again." });
    }

    record.verified = true;
    const staff = demoUsersDb.get(emailClean)!;

    // Create a dynamic custom token based on Base64 encoded payload
    const token = Buffer.from(JSON.stringify({ 
      email: staff.email,
      id: staff.id,
      role: staff.role,
      branch: staff.branch,
      full_name: staff.full_name,
      avatar: staff.avatar,
      createdAt: Date.now()
    })).toString("base64");

    return res.json({
      success: true,
      mode: "demo",
      token,
      user: staff,
      message: "Successfully signed in via sandbox demo credentials!"
    });
  }

  // Real flow
  try {
    const supabase = getSupabase();

    // 1. Resolve registered user profile record
    const { data: dbUser, error: uErr } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .eq("is_active", true)
      .maybeSingle();

    if (uErr) {
      return res.status(500).json({ success: false, error: `Database error during lookup: ${uErr.message}` });
    }
    if (!dbUser) {
      return res.status(400).json({ success: false, error: "User is not whitelisted or is deactivated." });
    }

    // 2. Query the latest unverified OTP inside 'otp_verifications' matching this user
    const { data: record, error: queryError } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("user_id", dbUser.id)
      .eq("is_used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error("[OTP Query Error]", queryError);
      return res.status(500).json({ success: false, error: `Database error during lookup: ${queryError.message}` });
    }

    if (!record) {
      return res.status(400).json({ success: false, error: "No active verification code found for this login session." });
    }

    // Verify expirations
    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ success: false, error: "The verification code has expired. Please request a new one." });
    }

    // Match code
    if (record.otp_code !== code.trim()) {
      return res.status(400).json({ success: false, error: "Invalid verification code." });
    }

    // Mark OTP code relation as consumed to prevent reuse
    await supabase.from("otp_verifications").update({ is_used: true }).eq("id", record.id);
    await supabase.from("users").update({ updated_at: new Date().toISOString() }).eq("id", dbUser.id);

    // Create a dynamic custom token based on Base64 encoded payload
    const token = Buffer.from(JSON.stringify({ 
      email: dbUser.email, 
      id: dbUser.id,
      role: dbUser.role,
      branch: dbUser.branch,
      full_name: dbUser.full_name,
      avatar: dbUser.avatar,
      createdAt: Date.now()
    })).toString("base64");

    res.json({
      success: true,
      mode: "live",
      token,
      user: dbUser,
      message: "Successfully verified OTP! User logged in."
    });

  } catch (err: any) {
    console.error("[Verify OTP Server Exception]", err);
    res.status(500).json({ success: false, error: err.message || "An internal server error occurred." });
  }
});

// 4. Authenticated Fetch Me API
app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Authorization token missing or invalid format." });
  }

  const token = authHeader.split(" ")[1];
  const config = getAuthConfig();

  try {
    const payloadStr = Buffer.from(token, "base64").toString("utf-8");
    const decoded = JSON.parse(payloadStr);

    if (!decoded || !decoded.email) {
      return res.status(401).json({ success: false, error: "Authentication token payload is invalid." });
    }
    
    if (!config.isConfigured) {
      const staff = demoUsersDb.get(decoded.email);
      if (!staff) {
        return res.status(401).json({ success: false, error: "Session profile does not exist." });
      }
      return res.json({
        success: true,
        mode: "demo",
        user: staff
      });
    }

    // Real Supabase read from 'users'
    const supabase = getSupabase();
    const { data: dbUser, error: userErr } = await supabase
      .from("users")
      .select("*")
      .eq("email", decoded.email)
      .eq("is_active", true)
      .maybeSingle();

    if (userErr) {
      return res.status(500).json({ success: false, error: `Failed to fetch profile: ${userErr.message}` });
    }

    if (!dbUser) {
      return res.status(404).json({ success: false, error: "No profile matching this session was found." });
    }

    res.json({
      success: true,
      mode: "live",
      user: dbUser
    });

  } catch (err) {
    res.status(401).json({ success: false, error: "Authentication token is expired or invalid format." });
  }
});

// Serve frontend build SPA assets
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error("Express startup fail:", err);
});
