import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { AuthContext } from "@/context/auth-context";
import type { AuthStatus, FamilyProfile } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";

const fetchFamilyProfile = () => apiFetch<FamilyProfile>("/profiles/family");

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [familyProfile, setFamilyProfile] = useState<FamilyProfile | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const profile = await fetchFamilyProfile();
      setFamilyProfile(profile);
      setStatus("authenticated");
      return profile;
    } catch {
      setFamilyProfile(null);
      setStatus("unauthenticated");
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const profile = await fetchFamilyProfile();
        if (isMounted) {
          setFamilyProfile(profile);
          setStatus("authenticated");
        }
      } catch {
        if (isMounted) {
          setFamilyProfile(null);
          setStatus("unauthenticated");
        }
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async () => {
    setStatus("loading");
    return refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
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
