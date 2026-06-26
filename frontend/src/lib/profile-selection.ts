export const PARENT_PROFILE_ID = "parent";
export const SELECTED_PROFILE_STORAGE_KEY = "earnit:selected-profile";
const PARENT_UNLOCK_SESSION_KEY = "earnit:parent-pin-unlocked";

export const getSelectedProfileId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SELECTED_PROFILE_STORAGE_KEY);
};

export const selectedProfileIsParent = () =>
  getSelectedProfileId() === PARENT_PROFILE_ID;

export const parentPinIsUnlocked = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(PARENT_UNLOCK_SESSION_KEY) === "true";
};

export const unlockParentProfile = () => {
  window.sessionStorage.setItem(PARENT_UNLOCK_SESSION_KEY, "true");
};

export const lockParentProfile = () => {
  window.sessionStorage.removeItem(PARENT_UNLOCK_SESSION_KEY);
};

export const clearProfileSelection = () => {
  window.localStorage.removeItem(SELECTED_PROFILE_STORAGE_KEY);
  lockParentProfile();
};
