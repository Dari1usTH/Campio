import { beforeEach,describe,expect,it,vi } from "vitest";
import {http} from "@/services/api";
import {setLocale} from "@/i18n";
beforeEach(()=>{vi.restoreAllMocks();setLocale("en");});
describe("cookie API boundary",()=>{
 it("includes cookies and active locale without exposing bearer tokens",async()=>{const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({ok:true}),{status:200}));await http("/settings",{method:"PATCH",body:JSON.stringify({language:"ro"})});const init=fetcher.mock.calls[0]?.[1];expect(init?.credentials).toBe("include");const headers=new Headers(init?.headers);expect(headers.get("Authorization")).toBeNull();expect(headers.get("Accept-Language")).toBe("en");});
 it("maps stable backend codes to translations and hides provider details",async()=>{vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({code:"invalid_credentials",message:"sensitive provider detail"}),{status:400}));await expect(http("/auth/login")).rejects.toMatchObject({code:"invalid_credentials"});await expect(http("/auth/login")).rejects.not.toThrow("sensitive provider detail");});
 it("refreshes cookies once then retries an expired authenticated request",async()=>{const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response("{}",{status:401})).mockResolvedValueOnce(new Response("{}",{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({ok:true}),{status:200}));await expect(http("/settings")).resolves.toEqual({ok:true});expect(fetcher.mock.calls.map(c=>c[0])).toEqual(["/api/settings","/api/auth/refresh","/api/settings"]);});
});
