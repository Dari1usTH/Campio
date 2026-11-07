import { authCopy } from "./copy";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, ArrowRight, LoaderCircle, MailCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, TextInput } from "@/components/campio/Field";
import { authService } from "@/services/auth";
import { USE_MOCKS } from "@/services/api";
import { fmt, useT } from "@/i18n";
import { AuthFrame, AuthHeading, FormError } from "./AuthFrame";

const schema = z.object({ email: z.string().trim().email(authCopy.emailError) });
export default function ForgotPage() {
  const t = useT();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });
  const submit = form.handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.empty.error);
    }
  });
  return (
    <AuthFrame>
      {sent ? (
        <>
          <span className="mb-6 grid size-16 place-items-center rounded-3xl bg-coral-tint">
            <MailCheck className="size-7" />
          </span>
          <AuthHeading
            title={t.auth.forgotSentTitle}
            sub={
              USE_MOCKS
                ? fmt(authCopy.resetSentDemo, { email: form.getValues("email") })
                : t.auth.forgotSent
            }
          />
          <p className="mb-6 text-sm text-muted-foreground">
            {USE_MOCKS ? authCopy.resetDemoNote : t.auth.forgotSentNote}
          </p>
          {USE_MOCKS && (
            <Link
              to="/reset-password"
              search={{ token: "demo-valid" }}
              className={buttonVariants({ variant: "coral", size: "lg", className: "mb-3" })}
            >
              {authCopy.resetDemo} <ArrowRight className="size-4" />
            </Link>
          )}
        </>
      ) : (
        <>
          <AuthHeading title={t.auth.forgotTitle} sub={t.auth.forgotSub} />
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
                {...form.register("email")}
                aria-invalid={!!form.formState.errors.email}
              />
            </Field>
            <FormError message={error} />
            <Button
              size="lg"
              variant="coral"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && <LoaderCircle className="animate-spin" />}
              {t.auth.forgotSend}
              <ArrowRight />
            </Button>
          </form>
        </>
      )}
      <Link
        to="/login"
        className="mt-6 flex min-h-11 items-center justify-center gap-2 text-sm font-medium"
      >
        <ArrowLeft className="size-4" />
        {t.auth.backToLogin}
      </Link>
    </AuthFrame>
  );
}
