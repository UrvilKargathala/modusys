// Same rules as the web (~/modusys/components/auth/password-requirements.tsx).
// The server checks them again; this is only for showing ticks while typing.
export const passwordRequirements = [
  { label: 'Minimum 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { label: 'One number', test: (v: string) => /[0-9]/.test(v) },
  { label: 'One special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function passwordMeetsAllRequirements(value: string): boolean {
  return passwordRequirements.every(r => r.test(value));
}
