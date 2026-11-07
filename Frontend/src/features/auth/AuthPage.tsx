import { authCopy } from "./copy";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/campio/Field";
import { PasswordInput, StrengthMeter } from "@/components/campio/PasswordField";
import { authService } from "@/services/auth";
import { useT } from "@/i18n";
import { AuthFrame, AuthHeading, FormError } from "./AuthFrame";

const schema = z.object({
  email: z.string().trim().email(authCopy.emailError),
  password: z.string().min(8, authCopy.passwordMinError),
  terms: z.boolean(),
});
type Values = z.infer<typeof schema>;

export default function AuthPage({ mode }: { mode: "signup" | "login" }) {
  const t = useT();
  const signup = mode === "signup";
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legal, setLegal] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(
      signup
        ? schema.refine((v) => v.terms, { path: ["terms"], message: t.auth.errors.terms })
        : schema.extend({ password: z.string().min(1, t.auth.errors.required) }),
    ),
    defaultValues: { email: "", password: "", terms: false },
  });
  const busy = form.formState.isSubmitting || googleLoading;
  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await authService[mode]({ email: values.email, password: values.password });
      await navigate({ to: "/verify-2fa" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.empty.error);
    }
  });
  async function google() {
    if (signup && !form.getValues("terms")) {
      form.setError("terms", { message: t.auth.errors.terms });
      return;
    }
    setGoogleLoading(true);
    setError(null);
    try {
      await authService.google();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.empty.error);
    } finally {
      setGoogleLoading(false);
    }
  }
  return (
    <AuthFrame>
      <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full bg-coral-tint px-3 py-1.5 text-xs font-medium">
        <ShieldCheck className="size-3.5" />
        {authCopy.firstStep}{" "}
      </span>
      <AuthHeading
        title={signup ? t.auth.signupTitle : t.auth.loginTitle}
        sub={signup ? t.auth.signupSub : t.auth.loginSub}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full bg-card"
        disabled={busy}
        onClick={google}
      >
        {googleLoading ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.52h3.24c1.9-1.75 2.98-4.32 2.98-7.37Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.05v2.6A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.39 13.89a6 6 0 0 1 0-3.78v-2.6H3.05a10 10 0 0 0 0 8.98l3.34-2.6Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.95 5.51l3.34 2.6A5.99 5.99 0 0 1 12 5.98Z"
            />
          </svg>
        )}
        {t.auth.google}
      </Button>
      <div className="my-6 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {authCopy.emailAlternative} <span className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field
          id="email"
          label={t.auth.email}
          {...(form.formState.errors.email?.message
            ? { error: form.formState.errors.email.message }
            : {})}
        >
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.auth.emailPh}
            aria-invalid={!!form.formState.errors.email}
            aria-describedby={form.formState.errors.email ? "email-error" : undefined}
            {...form.register("email")}
          />
        </Field>
        <Field
          id="password"
          label={t.auth.password}
          {...(form.formState.errors.password?.message
            ? { error: form.formState.errors.password.message }
            : {})}
          aside={
            !signup ? (
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-coral-ink hover:underline"
              >
                {t.auth.forgot}
              </Link>
            ) : undefined
          }
        >
          <PasswordInput
            id="password"
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={signup ? authCopy.newPasswordPlaceholder : authCopy.passwordPlaceholder}
            aria-invalid={!!form.formState.errors.password}
            aria-describedby={form.formState.errors.password ? "password-error" : undefined}
            {...form.register("password")}
          />
          {signup && <StrengthMeter password={form.watch("password")} />}
        </Field>
        {signup && (
          <div>
            <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-navy"
                {...form.register("terms")}
              />
              <span>
                {authCopy.agree}{" "}
                <button
                  type="button"
                  onClick={() => setLegal(true)}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {authCopy.terms}{" "}
                </button>
                .
              </span>
            </label>
            {form.formState.errors.terms && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {form.formState.errors.terms.message}
              </p>
            )}
          </div>
        )}
        <FormError message={error} />
        <Button variant="coral" size="lg" className="w-full" type="submit" disabled={busy}>
          {form.formState.isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
          {signup ? t.auth.createAccount : t.auth.signIn}
          <ArrowRight />
        </Button>
      </form>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        {signup ? t.auth.haveAccount : t.auth.noAccount}{" "}
        <Link
          to={signup ? "/login" : "/signup"}
          className="font-semibold text-foreground underline decoration-coral decoration-2 underline-offset-4"
        >
          {signup ? t.auth.signIn : t.auth.createAccount}
        </Link>
      </p>
      <Dialog open={legal} onOpenChange={setLegal}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-auto rounded-[28px]">
          <DialogTitle>{authCopy.legalTitle}</DialogTitle>
          <DialogDescription>{authCopy.legalSub}</DialogDescription>
          <p className="text-sm leading-6">{authCopy.legalBody} </p>
          <Button onClick={() => setLegal(false)}>{authCopy.understood}</Button>
        </DialogContent>
      </Dialog>
    </AuthFrame>
  );
}
