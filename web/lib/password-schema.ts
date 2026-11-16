import { z, type ZodRawShape } from "zod";
import { passwordMeetsAllRequirements } from "@/components/auth/password-requirements";

// Shared by any form with a password + confirmPassword pair (Invite New
// User, Set Password) — spreads the field definitions into that form's own
// shape, then adds the match check via superRefine (can't use a bare
// z.object(...).refine() here since the caller needs to merge in its own
// fields like name/email/role first).
export function withPasswordFields<T extends ZodRawShape>(shape: T) {
  return z
    .object({
      ...shape,
      password: z.string().refine(passwordMeetsAllRequirements, "Password doesn't meet all requirements"),
      confirmPassword: z.string(),
    })
    .superRefine((values, ctx) => {
      const v = values as { password: string; confirmPassword: string };
      if (v.password !== v.confirmPassword) {
        ctx.addIssue({ code: "custom", message: "Passwords don't match", path: ["confirmPassword"] });
      }
    });
}
