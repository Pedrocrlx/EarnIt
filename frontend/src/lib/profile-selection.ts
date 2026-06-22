export const PARENT_PROFILE_ID = "parent";
export const SELECTED_PROFILE_STORAGE_KEY = "earnit:selected-profile";

export const getSelectedProfileId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SELECTED_PROFILE_STORAGE_KEY);
};

export const selectedProfileIsParent = () =>
  getSelectedProfileId() === PARENT_PROFILE_ID;
