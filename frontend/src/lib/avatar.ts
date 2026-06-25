export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const AVATAR_CONTENT_TYPES = new Set(AVATAR_ACCEPT.split(","));

export const validateAvatarFile = (file: File): string | null => {
  if (!AVATAR_CONTENT_TYPES.has(file.type)) {
    return "O avatar deve ser uma imagem JPEG, PNG ou WebP.";
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return "O avatar não pode exceder 5 MB.";
  }

  return null;
};
