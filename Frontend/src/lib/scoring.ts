export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s) as PasswordStrength;
}
