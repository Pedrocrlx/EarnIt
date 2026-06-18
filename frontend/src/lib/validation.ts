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
    return "Introduza o seu email.";
  }

  if (!emailPattern.test(trimmedEmail)) {
    return "Introduza um email válido.";
  }

  return "";
};

export const getPasswordRequirements = (
  password: string,
): PasswordRequirement[] => [
  {
    id: "length",
    label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
    met: password.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "uppercase",
    label: "Uma letra maiúscula",
    met: /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "Uma letra minúscula",
    met: /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "Um número",
    met: /\d/.test(password),
  },
  {
    id: "special",
    label: "Um carácter especial",
    met: specialCharacterPattern.test(password),
  },
];

export const validatePassword = (password: string) => {
  if (!password) {
    return "Introduza uma palavra-passe.";
  }

  if (getPasswordRequirements(password).some((requirement) => !requirement.met)) {
    return "A palavra-passe não cumpre todos os requisitos.";
  }

  return "";
};

export const validateVerificationCode = (code: string) => {
  if (!code) {
    return "Introduza o seu código de verificação.";
  }

  if (!new RegExp(`^[A-Z0-9]{${VERIFICATION_CODE_LENGTH}}$`).test(code)) {
    return `Introduza o código de ${VERIFICATION_CODE_LENGTH} caracteres enviado por email.`;
  }

  return "";
};

export const validatePin = (pin: string) => {
  if (!pin) {
    return "Introduza um PIN.";
  }

  if (!new RegExp(`^\\d{${PARENT_PIN_LENGTH}}$`).test(pin)) {
    return `Introduza um PIN de ${PARENT_PIN_LENGTH} dígitos.`;
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
