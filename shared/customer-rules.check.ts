import assert from "node:assert/strict";
import { isEmail, isIndianMobile, isPostcode } from "./customer-rules";

// Mobile: 10 digits starting 6-9, +91 allowed, spaces ignored, empty allowed.
for (const ok of ["", "9876543210", "+91 98765 43210", "+91-9876543210", "6000000000"]) assert.equal(isIndianMobile(ok), true, ok);
for (const bad of ["5876543210", "98765", "98765432101", "abcdefghij"]) assert.equal(isIndianMobile(bad), false, bad);
// Email: zod's pattern.
for (const ok of ["", "a@b.co", "first.last+tag@the-furn.co.in"]) assert.equal(isEmail(ok), true, ok);
for (const bad of ["a@b", ".a@b.co", "a..b@c.co", "a b@c.co"]) assert.equal(isEmail(bad), false, bad);
// Postcode: digits only.
assert.equal(isPostcode("395009"), true);
assert.equal(isPostcode("39 5009"), false);
console.log("customer-rules.check: ok");
