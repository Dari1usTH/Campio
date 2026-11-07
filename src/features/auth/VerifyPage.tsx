import { authCopy } from "./copy";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ArrowRight,
  LoaderCircle,
  Mail,
  Smartphone,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { OtpInput } from "@/components/campio/OtpInput";
import { CopyButton } from "@/components/campio/CopyButton";
import { authService, getChallenge } from "@/services/auth";
import { USE_MOCKS } from "@/services/api";
import type { Challenge, TwoFactorMethod } from "@/services/schemas";
import { fmt, useT } from "@/i18n";
import { AuthFrame, AuthHeading, FormError } from "./AuthFrame";

export default function VerifyPage() {
  const t = useT();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [ready, setReady] = useState(false);
  const [code, setCode] = useState("");
  const [timer, setTimer] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backup, setBackup] = useState<string[] | null>(null);
  useEffect(() => {
    setChallenge(getChallenge());
    setReady(true);
  }, []);
  useEffect(() => {
    if (timer <= 0) return;
    const id = window.setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);
  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authService.verify2fa(code);
      if (result.backupCodes?.length) setBackup(result.backupCodes);
      else await navigate({ to: "/app" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t.empty.error);
    } finally {
      setBusy(false);
    }
  }
  async function method(next: TwoFactorMethod) {
    setBusy(true);
    setError(null);
    try {
      setChallenge(await authService.setMethod(next));
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.empty.error);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await authService.resendCode();
      setTimer(30);
      toast.success(USE_MOCKS ? authCopy.resendDemo : t.auth.resent);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.empty.error);
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <AuthFrame>
        <div className="h-80 animate-pulse rounded-3xl bg-muted" aria-label={authCopy.verifying} />
      </AuthFrame>
    );
  if (backup)
    return (
      <AuthFrame>
        <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-success-tint text-success-ink">
          <ShieldCheck />
        </span>
        <AuthHeading
          title={t.auth.backupTitle}
          sub={USE_MOCKS ? authCopy.backupDemo : t.auth.backupSub}
        />
        <div className="grid grid-cols-2 gap-3 rounded-3xl bg-card p-5">
          {backup.map((s) => (
            <code key={s} className="rounded-xl bg-background px-2 py-3 text-center text-sm">
              {s}
            </code>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-3">
          <CopyButton text={backup.join("\n")} label={t.auth.backupCopy} />
          <Button size="lg" variant="coral" onClick={() => navigate({ to: "/app" })}>
            {t.auth.backupDone}
            <ArrowRight />
          </Button>
        </div>
      </AuthFrame>
    );
  if (!challenge)
    return (
      <AuthFrame>
        <AuthHeading title={authCopy.challengeExpiredTitle} sub={authCopy.challengeExpired} />
        <Link to="/login" className={buttonVariants({ size: "lg" })}>
          {t.auth.backToLogin}
          <ArrowRight className="size-4" />
        </Link>
      </AuthFrame>
    );
  return (
    <AuthFrame>
      <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-coral-tint">
        <ShieldCheck />
      </span>
      <AuthHeading
        title={t.auth.twofaTitle}
        sub={
          USE_MOCKS
            ? fmt(authCopy.verificationDemo, { email: challenge.email })
            : challenge.method === "email"
              ? `${t.auth.twofaSubEmail} ${challenge.email}.`
              : t.auth.twofaSubApp
        }
      />
      <div className="mb-7 grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
        {(["email", "app"] as const).map((m) => (
          <button
            type="button"
            key={m}
            disabled={busy}
            onClick={() => method(m)}
            aria-pressed={challenge.method === m}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-full px-2 text-xs font-medium transition ${challenge.method === m ? "bg-card shadow-soft" : "text-muted-foreground"}`}
          >
            {m === "email" ? <Mail className="size-4" /> : <Smartphone className="size-4" />}
            {m === "email" ? t.auth.methodEmail : t.auth.methodApp}
          </button>
        ))}
      </div>
      {challenge.method === "app" && challenge.firstSetup && (
        <div className="mb-6 flex items-center gap-4 rounded-3xl bg-card p-4">
          <div className="grid size-24 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-border">
            <QrCode className="size-16" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">{authCopy.authenticatorTitle}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {USE_MOCKS ? authCopy.qrPlaceholder : t.auth.scanQr}
            </p>
          </div>
        </div>
      )}
      <form onSubmit={verify} className="space-y-6">
        <OtpInput value={code} onChange={setCode} disabled={busy} invalid={!!error} />
        <FormError message={error} />
        <Button size="lg" variant="coral" className="w-full" disabled={busy || code.length !== 6}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Check />}
          {t.auth.verify}
        </Button>
      </form>
      {challenge.method === "email" && (
        <Button
          variant="ghost"
          className="mt-4 w-full text-sm"
          disabled={timer > 0 || busy}
          onClick={resend}
        >
          {timer > 0 ? `${t.auth.resendIn} ${timer}s` : t.auth.resend}
        </Button>
      )}
      {USE_MOCKS && (
        <p className="mt-5 rounded-2xl border border-dashed border-border p-3 text-center text-xs leading-5 text-muted-foreground">
          {t.auth.demoHint}
        </p>
      )}
    </AuthFrame>
  );
}
