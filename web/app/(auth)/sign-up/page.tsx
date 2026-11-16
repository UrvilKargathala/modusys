"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser, useSessionResolved } from "@/lib/session";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Lock, Building2, Store, Factory, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/auth/icon-input";
import { OrgTypeCard } from "@/components/auth/org-type-card";
import { PasswordRequirements, passwordMeetsAllRequirements } from "@/components/auth/password-requirements";
import { mockSignUp } from "@/lib/auth/mock";

const signUpSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().refine(passwordMeetsAllRequirements, "Password doesn't meet all requirements"),
  companyName: z.string().min(1, "Company name is required"),
  orgType: z.enum(["retailer", "manufacturer"], {
    message: "Select an organization type",
  }),
});

type SignUpValues = z.infer<typeof signUpSchema>;

export default function SignUpPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const sessionResolved = useSessionResolved();
  useEffect(() => {
    if (sessionResolved && currentUser.id) router.replace("/dashboard");
  }, [sessionResolved, currentUser.id, router]);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors, isSubmitting, isValid },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: "onChange",
  });

  const password = watch("password") ?? "";
  const orgType = watch("orgType");

  const onSubmit = async () => {
    await mockSignUp();
    // replace, not push — so Back doesn't return to the sign-up page.
    router.replace("/dashboard");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-heading text-xl font-semibold text-grey-900">Create your account</h1>
        <p className="text-sm font-body text-grey-400">Start managing your furniture quotations</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <IconInput
          icon={User}
          label="Full Name"
          placeholder="Your full name"
          error={errors.fullName?.message}
          disabled={isSubmitting}
          {...register("fullName")}
        />
        <IconInput
          icon={Mail}
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          disabled={isSubmitting}
          {...register("email")}
        />
        <div className="flex flex-col gap-1.5">
          <IconInput
            icon={Lock}
            label="Password"
            type="password"
            placeholder="••••••••"
            error={password && errors.password ? errors.password.message : undefined}
            disabled={isSubmitting}
            {...register("password")}
          />
          <PasswordRequirements value={password} />
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-grey-100" />
          <span className="text-xs font-body font-medium tracking-wide text-grey-300">
            COMPANY DETAILS
          </span>
          <div className="h-px flex-1 bg-grey-100" />
        </div>

        <IconInput
          icon={Building2}
          label="Company Name"
          placeholder="Your company name"
          error={errors.companyName?.message}
          helperText="To join an existing company, enter the exact company name"
          disabled={isSubmitting}
          {...register("companyName")}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-body font-medium text-grey-700">Organization Type</span>
          <div className="flex gap-3">
            <OrgTypeCard
              icon={Store}
              label="Retailer"
              description="Create & send quotes"
              selected={orgType === "retailer"}
              onSelect={() => {
                setValue("orgType", "retailer", { shouldValidate: true });
                trigger("orgType");
              }}
            />
            <OrgTypeCard
              icon={Factory}
              label="Manufacturer"
              description="Receive quotes"
              selected={orgType === "manufacturer"}
              onSelect={() => {
                setValue("orgType", "manufacturer", { shouldValidate: true });
                trigger("orgType");
              }}
            />
          </div>
          {errors.orgType && (
            <span className="text-xs font-body text-error">{errors.orgType.message}</span>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting || !isValid}
          className="mt-1 w-full font-body font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            "Create Account"
          )}
        </Button>
      </form>
    </div>
  );
}
