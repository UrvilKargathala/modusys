const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*";

function pick(pool: string) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// Generates a password that trivially satisfies passwordMeetsAllRequirements
// (8+ chars, upper/lower/digit/special) by guaranteeing one of each first,
// then filling the rest randomly from the combined pool.
export function generateSecurePassword(length = 12): string {
  const pool = UPPER + LOWER + DIGITS + SPECIAL;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  for (let i = chars.length; i < length; i++) chars.push(pick(pool));
  // Shuffle so the guaranteed chars aren't always in the same first 4 slots.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
