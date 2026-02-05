import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AUTH_SESSION_KEY,
  AUTH_STORAGE_KEY,
  AUTH_UNAUTHORIZED_EVENT,
  Membership
} from "../api";

interface AuthContextValue {
  token: string | null;
  setToken: (token: string | null) => void;
  session: AuthSession | null;
  setSession: (session: AuthSession | null) => void;
}

export interface AuthSession {
  userId: string;
  pessoaId: string;
  isPlatformAdmin: boolean;
  memberships: Membership[];
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parseJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as { exp?: number };
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [session, setSessionState] = useState<AuthSession | null>(null);

  // Load saved token on startup and drop it if already expired.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) return;

      if (isTokenExpired(stored)) {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        return;
      }

      setTokenState(stored);
      const storedSession = window.localStorage.getItem(AUTH_SESSION_KEY);
      if (storedSession) {
        setSessionState(JSON.parse(storedSession) as AuthSession);
      }
    } catch {
      // Ignore localStorage failures
    }
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setTokenState(null);
      setSessionState(null);
      try {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        window.localStorage.removeItem(AUTH_SESSION_KEY);
      } catch {
        // Ignore localStorage failures
      }
    };

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const setToken = (value: string | null) => {
    setTokenState(value);
    try {
      if (value) {
        window.localStorage.setItem(AUTH_STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // Ignore localStorage failures
    }
  };

  const setSession = (value: AuthSession | null) => {
    setSessionState(value);
    try {
      if (value) {
        window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(value));
      } else {
        window.localStorage.removeItem(AUTH_SESSION_KEY);
      }
    } catch {
      // Ignore localStorage failures
    }
  };

  return (
    <AuthContext.Provider value={{ token, setToken, session, setSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
