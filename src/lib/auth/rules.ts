// Shared by the server config and the browser forms; keep free of server imports.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const NAME_MAX_LENGTH = 100;

export const NETWORK_ERROR_MESSAGE = "Couldn’t reach SnapStart. Check your connection and try again.";

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= NAME_MAX_LENGTH;
}

const ACCOUNT_EXISTS = "An account with this email already exists. Log in instead.";

const MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: ACCOUNT_EXISTS,
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ACCOUNT_EXISTS,
  INVALID_EMAIL_OR_PASSWORD: "That email and password don’t match. Check them and try again.",
  PASSWORD_TOO_SHORT: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  PASSWORD_TOO_LONG: `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`,
  INVALID_EMAIL: "Enter an email like name@example.com.",
  INVALID_NAME: `Enter your name, up to ${NAME_MAX_LENGTH} characters.`,
};

// Plain-language message for an auth error; never shows raw server text
export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  if (error?.status === 429) return "Too many tries. Wait a moment, then try again.";
  return (error?.code && MESSAGES[error.code]) || "Something went wrong. Try again.";
}
