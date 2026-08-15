const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Minimal duration-string parser for the handful of formats we actually use
 * for JWT_ACCESS_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN (e.g. "15m", "7d").
 * Deliberately hand-rolled instead of pulling in the `ms` package, which
 * isn't part of the dependency set the architecture doc specified.
 */
export default function ms(value: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Unsupported duration format: "${value}" (expected e.g. "15m", "7d")`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
