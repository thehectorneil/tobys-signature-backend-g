export interface AuthStatus {
  config: {
    supabaseUrl: string;
    supabaseConfigured: boolean;
    resendConfigured: boolean;
    resendFromEmail: string;
    isFullyConfigured: boolean;
  };
  checks: {
    supabaseConnected: boolean;
    resendConnected: boolean;
    otpsTableExists: boolean;
    profilesTableExists: boolean;
    usingDemoMode: boolean;
    errorMessage: string | null;
    sqlSetupScript: string;
  };
}

export interface User {
  id: string;
  email: string;
  created_at: string;
  last_login?: string;
}

export interface AuthSession {
  token: string;
  user: User;
  mode: "demo" | "live";
}

export interface LogEntry {
  timestamp: string;
  method: string;
  endpoint: string;
  status: number;
  payload: any;
  response: any;
  isError?: boolean;
}
