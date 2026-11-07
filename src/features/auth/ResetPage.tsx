import { authCopy } from "./copy";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Check, LoaderCircle, Link2Off } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/campio/Field";
import { PasswordInput, StrengthMeter } from "@/components/campio/PasswordField";
import { authService } from "@/services/auth";
import { useT } from "@/i18n";
import { AuthFrame, AuthHeading, FormError } from "./AuthFrame";

const schema = z
  .object({
    password: z.string().min(8, authCopy.passwordMinError),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: authCopy.passwordMismatch,
  });
export default function ResetPage({ token }: { token?: string }) {
  const t = useT();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = useQuery({
    queryKey: ["auth", "reset-token", token],
    queryFn: () => authService.validateResetToken(token),
    retry: false,
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });
  const submit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await authService.resetPassword(token ?? "", password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.empty.error);
    }
  });
  if (state.isPending)
    return (
      <AuthFrame>
        <div role="status" className="flex items-center gap-3">
          <LoaderCircle className="animate-spin" />
          {t.auth.resetChecking}
        </div>
      </AuthFrame>
    );
  if (state.isError)
    return (
      <AuthFrame>
        <AuthHeading title={authCopy.resetErrorTitle} sub={t.empty.error} />
        <Button onClick={() => state.refetch()}>{authCopy.retry}</Button>
      </AuthFrame>
    );
  if (done)
    return (
      <AuthFrame>
        <span className="mb-6 grid size-16 place-items-center rounded-3xl bg-success-tint text-success-ink">
          <Check className="size-7" />
        </span>
        <AuthHeading title={t.auth.resetSuccessTitle} sub={t.auth.resetSuccess} />
        <Link to="/login" className={buttonVariants({ variant: "coral", size: "lg" })}>
          {t.auth.signIn}
          <ArrowRight className="size-4" />
        </Link>
      </AuthFrame>
    );
  if (state.data !== "valid")
    return (
      <AuthFrame>
        <span className="mb-6 grid size-16 place-items-center rounded-3xl bg-coral-tint">
          <Link2Off className="size-7" />
        </span>
        <AuthHeading
          title={state.data === "expired" ? t.auth.resetExpiredTitle : t.auth.resetInvalidTitle}
          sub={state.data === "expired" ? t.auth.resetExpired : t.auth.resetInvalid}
        />
        <Link to="/forgot-password" className={buttonVariants({ variant: "coral", size: "lg" })}>
          {t.auth.resetNewLink}
          <ArrowRight className="size-4" />
        </Link>
      </AuthFrame>
    );
  return (
    <AuthFrame>
      <AuthHeading title={t.auth.resetTitle} sub={t.auth.resetSub} />
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field
          id="password"
          label={t.auth.passwordNew}
          {...(form.formState.errors.password?.message
            ? { error: form.formState.errors.password.message }
            : {})}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.password}
            {...form.register("password")}
          />
          <StrengthMeter password={form.watch("password")} />
        </Field>
        <Field
          id="confirm"
          label={t.auth.passwordConfirm}
          {...(form.formState.errors.confirm?.message
            ? { error: form.formState.errors.confirm.message }
            : {})}
        >
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            aria-invalid={!!form.formState.errors.confirm}
            {...form.register("confirm")}
          />
        </Field>
        <FormError message={error} />
        <Button
          type="submit"
          size="lg"
          variant="coral"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && <LoaderCircle className="animate-spin" />}
          {t.auth.resetCta}
          <ArrowRight />
        </Button>
      </form>
    </AuthFrame>
  );
}
