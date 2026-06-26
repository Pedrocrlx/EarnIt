const avatarFiles = new Map<number, File>();

export const getOnboardingAvatar = (childId: number) =>
  avatarFiles.get(childId) ?? null;

export const setOnboardingAvatar = (childId: number, file: File) => {
  avatarFiles.set(childId, file);
};

export const removeOnboardingAvatar = (childId: number) => {
  avatarFiles.delete(childId);
};

export const clearOnboardingAvatars = () => {
  avatarFiles.clear();
};
