import { createContext } from "react";

export type ChildProfile = {
  id: string;
  name: string;
  birth_date: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export type FamilyProfile = {
  id: string;
  family_name: string | null;
  onboarding_completed: boolean;
  children: ChildProfile[];
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthContextType {
  status: AuthStatus;
  isAuthenticated: boolean;
  familyProfile: FamilyProfile | null;
  login: () => Promise<FamilyProfile | null>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<FamilyProfile | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
