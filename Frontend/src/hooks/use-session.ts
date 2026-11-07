import { useSyncExternalStore } from "react";
import { getSession, onSessionChange, isSessionInitialized } from "@/services/auth";
export const useSession=()=>useSyncExternalStore(onSessionChange,getSession,()=>null);
export const useSessionReady=()=>useSyncExternalStore(onSessionChange,isSessionInitialized,()=>false);
