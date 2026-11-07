import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { getLocale, setLocale, useLocale, tr } from "@/i18n";
import { authService, getSession } from "@/services/auth";
import { http } from "@/services/api";

export function LanguageSwitch(){const locale=useLocale();const[busy,setBusy]=useState(false);const queryClient=useQueryClient();async function change(next:"en"|"ro"){if(next===getLocale()||busy)return;setLocale(next);if(getSession()){setBusy(true);try{await http("/profile",{method:"PATCH",body:JSON.stringify({language:next})});authService.updateLocalUser({language:next});await queryClient.invalidateQueries({queryKey:["settings"]});}catch(e){toast.error(e instanceof Error?e.message:tr("errors.unknown_error"));}finally{setBusy(false);}}}return <div className="inline-flex shrink-0 items-center rounded-full border border-border bg-card p-1 shadow-soft" role="group" aria-label={tr("extra.languageLabel")}>{(["en","ro"] as const).map(code=><button key={code} type="button" disabled={busy} aria-pressed={locale===code} onClick={()=>void change(code)} className={`min-h-8 min-w-9 rounded-full px-2 text-[11px] font-semibold transition-colors ${locale===code?"bg-navy text-cream":"text-muted-foreground hover:bg-secondary"}`}>{code.toUpperCase()}</button>)}</div>;}
