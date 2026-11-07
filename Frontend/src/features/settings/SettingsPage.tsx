import { settingsCopy } from "./copy";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Globe2,
  ImagePlus,
  Laptop,
  LoaderCircle,
  Mail,
  Monitor,
  Moon,
  Palette,
  Plug,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, TextInput, inputClass } from "@/components/campio/Field";
import { PasswordInput, StrengthMeter } from "@/components/campio/PasswordField";
import { PageHeader, Surface } from "@/components/campio/Surface";
import { fmt, useT } from "@/i18n";
import { useTheme } from "@/hooks/use-theme";
import { settingsQuery } from "@/services/queries";
import { settingsService } from "@/services/settings";
import { authService } from "@/services/auth";
import { USE_MOCKS } from "@/services/api";
import type { Settings, Tone } from "@/services/schemas";
import { cn } from "@/lib/utils";

type Tab =
  "profile" | "security" | "integrations" | "notifications" | "language" | "brand" | "danger";
const tabIcons = {
  profile: UserRound,
  security: Shield,
  integrations: Plug,
  notifications: Bell,
  language: Globe2,
  brand: Palette,
  danger: Trash2,
};
const passwordSchema = z
  .object({
    current: z.string().min(1, settingsCopy.currentPasswordError),
    password: z.string().min(8, settingsCopy.passwordMinError),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: settingsCopy.passwordMismatch,
  });

function SectionHead({ title, sub, icon }: { title: string; sub: string; icon?: ReactNode }) {
  return (
    <header className="mb-7 flex items-start gap-4">
      {icon && (
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral-tint">
          {icon}
        </span>
      )}
      <div>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{sub}</p>
      </div>
    </header>
  );
}
function SettingRow({ title, sub, control }: { title: string; sub: string; control: ReactNode }) {
  return (
    <div className="flex min-h-24 items-center justify-between gap-5 border-b border-border py-5 last:border-0">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{sub}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

export default function SettingsPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const query = useQuery(settingsQuery());
  const [draft, setDraft] = useState<Settings | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current: "", password: "", confirm: "" },
  });
  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);
  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) => settingsService.update(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      authService.updateLocalUser({
        ...data.profile,
        twoFactorEnabled: data.security.twoFactorEnabled,
      });
      toast.success(settingsCopy.saved);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t.empty.error),
  });
  const changePassword = passwordForm.handleSubmit(async (values) => {
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await settingsService.changePassword(values.current, values.password);
      passwordForm.reset();
      toast.success(USE_MOCKS ? settingsCopy.passwordDemo : settingsCopy.passwordChanged);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : t.empty.error);
    } finally {
      setPasswordBusy(false);
    }
  });
  async function upload(file: File | undefined, target: "avatar" | "logo") {
    if (!file || !draft) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error(settingsCopy.imageTypeError);
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error(settingsCopy.imageSizeError);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      if (target === "avatar")
        setDraft((d) =>
          d ? { ...d, profile: { ...d.profile, avatarUrl: reader.result as string } } : d,
        );
      else
        setDraft((d) =>
          d ? { ...d, brandKit: { ...d.brandKit, logoUrl: reader.result as string } } : d,
        );
    };
    reader.onerror = () => toast.error(settingsCopy.imageReadError);
    reader.readAsDataURL(file);
  }
  async function deleteAccount() {
    if (confirmText !== settingsCopy.deleteWord) return;
    setDeleting(true);
    try {
      await settingsService.deleteAccount();
      await authService.logout();
      queryClient.clear();
      await navigate({ to: "/" });
      toast.success(USE_MOCKS ? settingsCopy.demoDeleted : settingsCopy.deleted);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.empty.error);
    } finally {
      setDeleting(false);
    }
  }
  if (query.isPending || (!draft && !query.isError))
    return (
      <div className="space-y-6" aria-label={settingsCopy.loading}>
        <div className="h-16 w-48 rounded-2xl skeleton-shimmer" />
        <div className="h-[520px] rounded-[28px] skeleton-shimmer" />
      </div>
    );
  if (query.isError || !draft)
    return (
      <Surface>
        <h1 className="text-2xl font-semibold">{settingsCopy.loadError}</h1>
        <p className="my-4 text-muted-foreground">{t.empty.error}</p>
        <Button onClick={() => query.refetch()}>{settingsCopy.retry}</Button>
      </Surface>
    );
  const updateProfile = (key: keyof Settings["profile"], value: string) =>
    setDraft({ ...draft, profile: { ...draft.profile, [key]: value } });
  const saveButton = (patch: Partial<Settings>) => (
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
      <p className="text-xs text-muted-foreground">{settingsCopy.saveHint}</p>
      <Button type="button" disabled={save.isPending} onClick={() => save.mutate(patch)}>
        {save.isPending ? <LoaderCircle className="animate-spin" /> : <Check />}
        {settingsCopy.save}{" "}
      </Button>
    </div>
  );
  return (
    <>
      <PageHeader title={t.settings.title} sub={settingsCopy.subtitle} />
      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label={settingsCopy.nav}
          className="no-scrollbar flex gap-1 overflow-x-auto pb-2 lg:sticky lg:top-28 lg:flex-col lg:overflow-visible lg:pb-0"
        >
          {(Object.keys(tabIcons) as Tab[]).map((key) => {
            const Icon = tabIcons[key];
            return (
              <button
                key={key}
                type="button"
                aria-current={tab === key ? "page" : undefined}
                onClick={() => setTab(key)}
                className={cn(
                  "flex min-h-12 shrink-0 items-center gap-3 rounded-2xl px-4 text-left text-sm font-medium transition",
                  tab === key
                    ? "bg-navy text-cream-soft shadow-soft"
                    : "text-muted-foreground hover:bg-card",
                  key === "danger" && tab !== key && "text-destructive",
                )}
              >
                <Icon className="size-4" />
                {t.settings.tabs[key]}
                <ChevronRight className="ml-auto hidden size-3.5 lg:block" />
              </button>
            );
          })}
        </nav>
        <Surface pad="lg" className="min-w-0">
          {tab === "profile" && (
            <>
              <SectionHead
                title={settingsCopy.profileTitle}
                sub={settingsCopy.profileSub}
                icon={<UserRound className="size-5" />}
              />
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  save.mutate({ profile: draft.profile });
                }}
              >
                <div className="mb-8 flex flex-wrap items-center gap-5">
                  <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-[28px] bg-coral-tint font-display text-3xl font-semibold">
                    {draft.profile.avatarUrl ? (
                      <img
                        src={draft.profile.avatarUrl}
                        width="80"
                        height="80"
                        alt={settingsCopy.avatarAlt}
                        className="size-full object-cover"
                      />
                    ) : (
                      draft.profile.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold">{t.settings.avatar}</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => avatarRef.current?.click()}
                    >
                      <Upload />
                      {t.settings.changeAvatar}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">{settingsCopy.imageHint} </p>
                  </div>
                  <input
                    ref={avatarRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    aria-label={settingsCopy.avatarUpload}
                    onChange={(e) => upload(e.target.files?.[0], "avatar")}
                  />
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="name" label={t.settings.name}>
                    <TextInput
                      id="name"
                      required
                      autoComplete="name"
                      value={draft.profile.name}
                      onChange={(e) => updateProfile("name", e.target.value)}
                    />
                  </Field>
                  <Field id="business" label={t.settings.business}>
                    <TextInput
                      id="business"
                      required
                      autoComplete="organization"
                      value={draft.profile.businessName}
                      onChange={(e) => updateProfile("businessName", e.target.value)}
                    />
                  </Field>
                  <Field
                    id="profile-email"
                    label={t.auth.email}
                    className="sm:col-span-2"
                    hint={settingsCopy.emailHint}
                  >
                    <TextInput
                      id="profile-email"
                      required
                      type="email"
                      autoComplete="email"
                      value={draft.profile.email}
                      onChange={(e) => updateProfile("email", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="mt-8 flex justify-end border-t border-border pt-6">
                  <Button type="submit" disabled={save.isPending}>
                    {save.isPending ? <LoaderCircle className="animate-spin" /> : <Check />}
                    {settingsCopy.saveProfile}{" "}
                  </Button>
                </div>
              </form>
            </>
          )}
          {tab === "security" && (
            <>
              <SectionHead
                title={t.settings.tabs.security}
                sub={USE_MOCKS ? settingsCopy.securityDemo : settingsCopy.securitySub}
                icon={<Shield className="size-5" />}
              />
              <SettingRow
                title={t.settings.twofa}
                sub={
                  USE_MOCKS
                    ? fmt(settingsCopy.demoPreference, {
                        state: draft.security.twoFactorEnabled
                          ? settingsCopy.enabled
                          : settingsCopy.disabled,
                      })
                    : draft.security.twoFactorEnabled
                      ? t.settings.twofaOn
                      : t.settings.twofaOff
                }
                control={
                  <div className="flex min-h-11 items-center">
                    <Switch
                      aria-label={t.settings.twofa}
                      disabled={save.isPending}
                      checked={draft.security.twoFactorEnabled}
                      onCheckedChange={(checked) =>
                        save.mutate({ security: { ...draft.security, twoFactorEnabled: checked } })
                      }
                    />
                  </div>
                }
              />
              <div className="mt-7">
                <h3 className="font-display text-lg font-semibold">{t.settings.changePassword}</h3>
                <form onSubmit={changePassword} className="mt-5 space-y-4" noValidate>
                  <Field
                    id="current"
                    label={t.settings.currentPassword}
                    {...(passwordForm.formState.errors.current?.message
                      ? { error: passwordForm.formState.errors.current.message }
                      : {})}
                  >
                    <PasswordInput
                      id="current"
                      autoComplete="current-password"
                      {...passwordForm.register("current")}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="new-password"
                      label={t.auth.passwordNew}
                      {...(passwordForm.formState.errors.password?.message
                        ? { error: passwordForm.formState.errors.password.message }
                        : {})}
                    >
                      <PasswordInput
                        id="new-password"
                        autoComplete="new-password"
                        {...passwordForm.register("password")}
                      />
                      <StrengthMeter password={passwordForm.watch("password")} />
                    </Field>
                    <Field
                      id="confirm-password"
                      label={t.auth.passwordConfirm}
                      {...(passwordForm.formState.errors.confirm?.message
                        ? { error: passwordForm.formState.errors.confirm.message }
                        : {})}
                    >
                      <PasswordInput
                        id="confirm-password"
                        autoComplete="new-password"
                        {...passwordForm.register("confirm")}
                      />
                    </Field>
                  </div>
                  {passwordError && (
                    <p role="alert" className="text-sm text-destructive">
                      {passwordError}
                    </p>
                  )}
                  <Button type="submit" variant="outline" disabled={passwordBusy}>
                    {passwordBusy && <LoaderCircle className="animate-spin" />}
                    {t.settings.changePassword}
                  </Button>
                </form>
              </div>
              <div className="mt-8 border-t border-border pt-7">
                <h3 className="font-display text-lg font-semibold">{t.settings.sessions}</h3>
                {draft.security.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-wrap items-center gap-3 border-b border-border py-4 last:border-0"
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-background">
                      {session.device.includes("iPhone") ? (
                        <Smartphone className="size-5" />
                      ) : (
                        <Laptop className="size-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{session.device}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {session.location} · {session.lastActive}
                        {USE_MOCKS && settingsCopy.demoSession}
                      </p>
                    </div>
                    {session.current ? (
                      <span className="rounded-full bg-success-tint px-3 py-1.5 text-xs text-success-ink">
                        {t.settings.thisDevice}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={save.isPending}
                        onClick={() =>
                          save.mutate({
                            security: {
                              ...draft.security,
                              sessions: draft.security.sessions.filter((s) => s.id !== session.id),
                            },
                          })
                        }
                      >
                        {t.settings.revoke}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === "integrations" && (
            <>
              <SectionHead
                title={settingsCopy.integrationTitle}
                sub={USE_MOCKS ? settingsCopy.integrationDemo : settingsCopy.integrationSub}
                icon={<Plug className="size-5" />}
              />
              <div className="space-y-3">
                {Object.entries(t.settings.integrations).map(([key, item]) => {
                  const status = draft.integrations[key] ?? "available";
                  return (
                    <div
                      key={key}
                      className="flex flex-wrap items-center gap-4 rounded-[22px] border border-border p-4"
                    >
                      <span
                        className={cn(
                          "grid size-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-semibold",
                          key === "meta_ads" ? "bg-navy text-cream-soft" : "bg-background",
                        )}
                      >
                        {key === "meta_ads" ? (
                          "∞"
                        ) : key === "google_ads" ? (
                          "G"
                        ) : key === "tiktok_ads" ? (
                          "♪"
                        ) : key === "mailchimp" ? (
                          <Mail className="size-5" />
                        ) : (
                          "S"
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold">{item.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{item.d}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={status === "connected" ? "secondary" : "outline"}
                        disabled={status === "soon" || save.isPending}
                        onClick={() =>
                          save.mutate({
                            integrations: {
                              ...draft.integrations,
                              [key]: status === "connected" ? "available" : "connected",
                            },
                          })
                        }
                      >
                        {status === "connected" ? (
                          <>
                            <Check />
                            {USE_MOCKS ? settingsCopy.connectedDemo : settingsCopy.connected}
                          </>
                        ) : status === "soon" ? (
                          settingsCopy.soon
                        ) : USE_MOCKS ? (
                          settingsCopy.connectDemo
                        ) : (
                          settingsCopy.connect
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 flex items-start gap-3 rounded-2xl bg-background p-4">
                <CircleHelp className="mt-0.5 size-4 shrink-0" />
                <p className="text-xs leading-5 text-muted-foreground">
                  {settingsCopy.integrationHint}{" "}
                </p>
              </div>
            </>
          )}
          {tab === "notifications" && (
            <>
              <SectionHead
                title={settingsCopy.notificationTitle}
                sub={settingsCopy.notificationSub}
                icon={<Bell className="size-5" />}
              />
              {(
                [
                  ["resultsReminder", t.settings.notifResults, t.settings.notifResultsD],
                  ["weeklyDigest", t.settings.notifDigest, t.settings.notifDigestD],
                  ["productNews", t.settings.notifNews, t.settings.notifNewsD],
                ] as const
              ).map(([key, title, sub]) => (
                <SettingRow
                  key={key}
                  title={title}
                  sub={sub}
                  control={
                    <div className="flex min-h-11 items-center">
                      <Switch
                        aria-label={title}
                        checked={draft.notifications[key]}
                        onCheckedChange={(checked) =>
                          setDraft({
                            ...draft,
                            notifications: { ...draft.notifications, [key]: checked },
                          })
                        }
                      />
                    </div>
                  }
                />
              ))}
              {USE_MOCKS && (
                <p className="mt-5 text-xs text-muted-foreground">
                  {settingsCopy.notificationDemo}{" "}
                </p>
              )}
              {saveButton({ notifications: draft.notifications })}
            </>
          )}
          {tab === "language" && (
            <>
              <SectionHead
                title={settingsCopy.appearanceTitle}
                sub={settingsCopy.appearanceSub}
                icon={<Globe2 className="size-5" />}
              />
              <Field id="language" label={t.settings.language}>
                <select id="language" value="ro" className={inputClass} onChange={() => {}}>
                  <option value="ro">{settingsCopy.romanian}</option>
                  <option value="en" disabled>
                    {settingsCopy.englishSoon}{" "}
                  </option>
                </select>
              </Field>
              <p className="mt-3 text-xs text-muted-foreground">{settingsCopy.translationHint} </p>
              <h3 className="mb-4 mt-8 text-sm font-semibold">{t.settings.theme}</h3>
              <div className="grid grid-cols-2 gap-4">
                {(["light", "dark"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={theme === value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "rounded-[24px] border-2 p-3 text-left transition",
                      theme === value ? "border-coral" : "border-border",
                    )}
                  >
                    <div
                      className={cn(
                        "mb-4 grid h-28 grid-cols-[30px_1fr] gap-2 overflow-hidden rounded-2xl p-3",
                        value === "light" ? "bg-[#F4EDE0]" : "bg-[#14213D]",
                      )}
                    >
                      <span
                        className={cn(
                          "rounded-lg",
                          value === "light" ? "bg-[#e5ddcf]" : "bg-[#1F2F55]",
                        )}
                      />
                      <div className="space-y-2">
                        <div className="h-7 rounded-lg bg-[#FF6B5B]" />
                        <div
                          className={cn(
                            "h-14 rounded-lg",
                            value === "light" ? "bg-[#FAF6EE]" : "bg-[#1F2F55]",
                          )}
                        />
                      </div>
                    </div>
                    <span className="flex items-center gap-2 px-1 pb-1 text-sm font-medium">
                      {value === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                      {value === "light" ? t.settings.themeLight : t.settings.themeDark}
                      {theme === value && <Check className="ml-auto size-4 text-coral-ink" />}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-5 text-xs text-muted-foreground">{settingsCopy.themeHint} </p>
            </>
          )}
          {tab === "brand" && (
            <>
              <SectionHead
                title={settingsCopy.brandTitle}
                sub={t.settings.brandHint}
                icon={<Palette className="size-5" />}
              />
              <div className="flex items-center gap-5">
                <div className="grid size-20 place-items-center overflow-hidden rounded-3xl border border-dashed border-border bg-background">
                  {draft.brandKit.logoUrl ? (
                    <img
                      src={draft.brandKit.logoUrl}
                      width="80"
                      height="80"
                      alt={settingsCopy.logoAlt}
                      className="size-full object-contain p-2"
                    />
                  ) : (
                    <ImagePlus className="size-7 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">{t.settings.brandLogo}</p>
                  <Button type="button" variant="outline" onClick={() => logoRef.current?.click()}>
                    <Upload />
                    {settingsCopy.uploadLogo}{" "}
                  </Button>
                </div>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-label={settingsCopy.logoUploadLabel}
                  onChange={(e) => upload(e.target.files?.[0], "logo")}
                />
              </div>
              <div className="mt-8">
                <h3 className="mb-4 text-sm font-semibold">{t.settings.brandColors}</h3>
                <div className="flex flex-wrap gap-4">
                  {draft.brandKit.colors.map((color, index) => (
                    <label
                      key={index}
                      className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2"
                    >
                      <input
                        type="color"
                        value={color}
                        aria-label={fmt(settingsCopy.colorLabel, { index: index + 1 })}
                        className="size-10 cursor-pointer overflow-hidden rounded-full border-0 bg-transparent"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            brandKit: {
                              ...draft.brandKit,
                              colors: draft.brandKit.colors.map((c, i) =>
                                i === index ? e.target.value : c,
                              ),
                            },
                          })
                        }
                      />
                      <span className="font-mono text-xs uppercase">{color}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <h3 className="mb-4 text-sm font-semibold">{t.settings.brandTone}</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(t.wizard.tones).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={draft.brandKit.tone === key ? "default" : "outline"}
                      aria-pressed={draft.brandKit.tone === key}
                      onClick={() =>
                        setDraft({ ...draft, brandKit: { ...draft.brandKit, tone: key as Tone } })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              {saveButton({ brandKit: draft.brandKit })}
            </>
          )}
          {tab === "danger" && (
            <>
              <SectionHead
                title={t.settings.deleteTitle}
                sub={USE_MOCKS ? settingsCopy.deleteDemoSub : t.settings.deleteBody}
                icon={<Trash2 className="size-5 text-destructive" />}
              />
              <div className="rounded-3xl border border-destructive/25 bg-destructive/5 p-6">
                <h3 className="font-semibold">{settingsCopy.deleteTitle}</h3>
                <p className="my-3 text-sm leading-6 text-muted-foreground">
                  {USE_MOCKS ? settingsCopy.deleteDemoBody : settingsCopy.deleteBody}
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setConfirmText("");
                    setConfirmOpen(true);
                  }}
                >
                  <Trash2 />
                  {USE_MOCKS ? settingsCopy.deleteDemo : t.settings.deleteCta}
                </Button>
              </div>
            </>
          )}
        </Surface>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-[28px]">
          <DialogTitle>{t.settings.deleteConfirm}</DialogTitle>
          <DialogDescription>{t.settings.deleteConfirmBody}</DialogDescription>
          <TextInput
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label={settingsCopy.deleteConfirmLabel}
            placeholder={settingsCopy.deleteWord}
            autoComplete="off"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {settingsCopy.cancel}{" "}
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== settingsCopy.deleteWord || deleting}
              onClick={deleteAccount}
            >
              {deleting && <LoaderCircle className="animate-spin" />}
              {settingsCopy.deleteConfirm}{" "}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
