export type FieldErrors<T extends string> = Partial<Record<T, string>>;

export type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const specialCharacterPattern = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export const VERIFICATION_CODE_LENGTH = 6;
export const PASSWORD_MIN_LENGTH = 12;
export const MAX_FAMILY_NAME_LENGTH = 150;
export const MAX_CHILD_NAME_LENGTH = 100;
export const MAX_CHILDREN_PER_USER = 10;
export const PARENT_PIN_LENGTH = 4;

export const validateRequired = (value: string, message: string) =>
  value.trim() ? "" : message;

export const validateMaxLength = (
  value: string,
  maxLength: number,
  message: string,
) => (value.trim().length <= maxLength ? "" : message);

export const validateEmail = (email: string) => {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    return "Enter your email address.";
  }

  if (!emailPattern.test(trimmedEmail)) {
    return "Enter a valid email address.";
  }

  return "";
};

export const getPasswordRequirements = (
  password: string,
): PasswordRequirement[] => [
  {
    id: "length",
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    met: password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    met: /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    met: /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    met: /\d/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    met: specialCharacterPattern.test(password),
  },
];

export const validatePassword = (password: string) => {
  if (!password) {
    return "Enter a password.";
  }

  if (getPasswordRequirements(password).some((requirement) => !requirement.met)) {
    return "Password does not meet all requirements.";
  }

  return "";
};

export const validateVerificationCode = (code: string) => {
  if (!code) {
    return "Enter your verification code.";
  }

  if (!new RegExp(`^[A-Z0-9]{${VERIFICATION_CODE_LENGTH}}$`).test(code)) {
    return `Enter the ${VERIFICATION_CODE_LENGTH}-character code from your email.`;
  }

  return "";
};

export const validatePin = (pin: string) => {
  if (!pin) {
    return "Enter a PIN.";
  }

  if (!new RegExp(`^\\d{${PARENT_PIN_LENGTH}}$`).test(pin)) {
    return `Enter a ${PARENT_PIN_LENGTH}-digit PIN.`;
  }

  return "";
};

export const isFutureDate = (value: string) => {
  if (!value) {
    return false;
  }

  const selectedDate = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selectedDate > today;
};
