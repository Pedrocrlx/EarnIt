// In-progress onboarding input, kept in sessionStorage so nothing is written to
// the backend until the user confirms on step 3. Cleared on completion. If the
// tab/session ends mid-flow the draft is simply lost and the user refills.

const DRAFT_KEY = "earnit:onboarding:draft";

// Onboarding tops out at 5 children (the picker's "5+"); a parent can add any
// extra ones afterwards in Perfis, up to the backend's per-account limit.
export const ONBOARDING_MAX_CHILDREN = 5;

export type DraftChild = {
  clientId: number;
  firstName: string;
  birthDate: string;
  backendId?: string;
};

export type OnboardingDraft = {
  familyName: string;
  childCount: number;
  children: DraftChild[];
};

export const readDraft = (): Partial<OnboardingDraft> => {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<OnboardingDraft>) : {};
  } catch {
    return {};
  }
};

export const writeDraft = (patch: Partial<OnboardingDraft>): void => {
  const next = { ...readDraft(), ...patch };
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
};

export const clearDraft = (): void => {
  window.sessionStorage.removeItem(DRAFT_KEY);
};
