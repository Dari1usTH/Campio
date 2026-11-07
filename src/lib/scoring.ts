/** Panel score weights: click 50%, stop (oprire) 30%, share 20%. */
export const SCORE_WEIGHTS = { click: 0.5, stop: 0.3, share: 0.2 } as const;

export function computeMessageScore(m: { click: number; stop: number; share: number }): number {
  return Math.round(
    m.click * SCORE_WEIGHTS.click + m.stop * SCORE_WEIGHTS.stop + m.share * SCORE_WEIGHTS.share,
  );
}

export const DEFAULT_BUDGET_RON = 500;
export const COST_PER_CAMPAIGN_USD: [number, number] = [0.01, 0.02];

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
