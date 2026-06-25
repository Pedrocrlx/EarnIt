import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { AuthContext } from "@/context/auth-context";
import type { AuthStatus, FamilyProfile } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { clearProfileSelection } from "@/lib/profile-selection";

const fetchFamilyProfile = () => apiFetch<FamilyProfile>("/profiles/family");
const SESSION_HINT_STORAGE_KEY = "earnit.hasAuthenticatedSession";

const AUTH_PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/verification",
  "/forgot-password",
  "/forgot-password/verify",
  "/reset-password",
]);

const hasSessionHint = () => {
  try {
    return window.localStorage.getItem(SESSION_HINT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const setSessionHint = (isAuthenticated: boolean) => {
  try {
    if (isAuthenticated) {
      window.localStorage.setItem(SESSION_HINT_STORAGE_KEY, "true");
    } else {
      window.localStorage.removeItem(SESSION_HINT_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable in restrictive browser modes.
  }
};

const shouldRestoreSession = () => {
  const path = window.location.pathname;

  if (AUTH_PUBLIC_PATHS.has(path)) {
    return false;
  }

  return path !== "/" || hasSessionHint();
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const restoreSessionOnMount = shouldRestoreSession();
  const [status, setStatus] = useState<AuthStatus>(
    restoreSessionOnMount ? "loading" : "unauthenticated",
  );
  const [familyProfile, setFamilyProfile] = useState<FamilyProfile | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const profile = await fetchFamilyProfile();
      setSessionHint(true);
      setFamilyProfile(profile);
      setStatus("authenticated");
      return profile;
    } catch {
      setSessionHint(false);
      setFamilyProfile(null);
      setStatus("unauthenticated");
      return null;
    }
  }, []);

  useEffect(() => {
    // Public authentication screens do not need a family profile before the
    // user authenticates. Skipping restoration there avoids an expected 401.
    if (!restoreSessionOnMount) {
      return;
    }

    let isMounted = true;

    const loadSession = async () => {
      try {
        const profile = await fetchFamilyProfile();
        if (isMounted) {
          setSessionHint(true);
          setFamilyProfile(profile);
          setStatus("authenticated");
        }
      } catch {
        if (isMounted) {
          setSessionHint(false);
          setFamilyProfile(null);
          setStatus("unauthenticated");
        }
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [restoreSessionOnMount]);

  const login = useCallback(async () => {
    setStatus("loading");
    return refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      clearProfileSelection();
      setSessionHint(false);
      setFamilyProfile(null);
      setStatus("unauthenticated");
    }
  }, []);

  const value = useMemo(
    () => ({
      status,
      isAuthenticated: status === "authenticated",
      familyProfile,
      login,
      logout,
      refreshSession,
    }),
    [familyProfile, login, logout, refreshSession, status],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
