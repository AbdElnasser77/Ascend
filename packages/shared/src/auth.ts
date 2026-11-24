/**
 * Account rules shared by the API (which enforces them) and the web (which shows them as you type).
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_EMAIL = 254;
export const MIN_PASSWORD = 8;
/** bcrypt only reads the first 72 bytes, so longer passwords would silently collide */
export const MAX_PASSWORD_BYTES = 72;

export type PasswordRule = { id: string; label: string; test: (password: string, email: string) => boolean };

const byteLength = (s: string) => new TextEncoder().encode(s).length;

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: `At least ${MIN_PASSWORD} characters`, test: (p) => p.length >= MIN_PASSWORD },
  { id: "letter", label: "A letter", test: (p) => /\p{L}/u.test(p) },
  { id: "number", label: "A number", test: (p) => /\d/.test(p) },
  {
    id: "email",
    label: "Different from your email",
    test: (p, email) => {
      const e = email.trim().toLowerCase();
      const local = e.split("@")[0] ?? "";
      const pw = p.toLowerCase();
      return !e || (pw !== e && (local.length < 4 || !pw.includes(local)));
    },
  },
];

export function isValidEmail(email: string) {
  return email.length <= MAX_EMAIL && EMAIL_RE.test(email);
}

/** The first problem with a new password, or null if it's acceptable. */
export function passwordProblem(password: string, email = ""): string | null {
  if (byteLength(password) > MAX_PASSWORD_BYTES) return "That password is too long";
  const failed = PASSWORD_RULES.find((r) => !r.test(password, email));
  if (!failed) return null;
  return {
    length: `Use at least ${MIN_PASSWORD} characters`,
    letter: "Include at least one letter",
    number: "Include at least one number",
    email: "Don't use your email as your password",
  }[failed.id]!;
}

// ---------- Future you ----------

export const FUTURE_TRAITS = ["healthy", "skilled", "calm", "wealthy", "creative", "connected", "confident", "disciplined"] as const;
export type FutureTrait = (typeof FUTURE_TRAITS)[number];
export const FUTURE_YEARS = [1, 3, 5, 10] as const;
export const MAX_FUTURE_TRAITS = 3;
export const MAX_FUTURE_STATEMENT = 160;
