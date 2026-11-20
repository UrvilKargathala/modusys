// Field rules for the customer form, shared by the website and the phone app so both reject the same input.
// Plain TypeScript (no packages): each check returns true when the value is fine; an empty value is always fine
// because these fields are optional (the form itself requires the Name).

export const CUSTOMER_RULE_MESSAGES = {
  name: "Name is required",
  mobile: "Enter a valid 10-digit Indian mobile number",
  email: "Enter a valid email address",
  postcode: "Postcode must be numeric",
} as const;

// A 10-digit Indian mobile starting 6-9, optionally with +91 in front; spaces are ignored.
export const isIndianMobile = (v: string) => v === "" || /^(\+91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/\s/g, ""));

// The same pattern zod's .email() uses, so the website's earlier check keeps accepting the same addresses.
const EMAIL = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
export const isEmail = (v: string) => v === "" || EMAIL.test(v);

export const isPostcode = (v: string) => v === "" || /^\d+$/.test(v);
