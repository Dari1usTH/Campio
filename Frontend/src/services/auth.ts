import { z } from "zod";
import { ApiError, http } from "./api";
import { getLocale, setLocale, translateError } from "@/i18n";
import { challengeSchema, sessionSchema, verificationSchema } from "./schemas";
import type { Challenge, ResetTokenState, Session, TwoFactorMethod, User } from "./schemas";

const CHALLENGE_KEY = "campio:challenge";
const listeners=new Set<()=>void>();
let currentSession:Session|null=null;
let initialized=false;
let initialization:Promise<Session|null>|null=null;
export const onSessionChange=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const getSession=()=>currentSession;
export const isSessionInitialized=()=>initialized;
function setSession(value:Session|null){
 currentSession=value; initialized=true;
 // Remove insecure credentials left by the original browser demo.
 if(typeof window!=="undefined"){localStorage.removeItem("campio:token");localStorage.removeItem("campio:session");}
 if(value?.user.language) setLocale(value.user.language);
 listeners.forEach(fn=>fn());
}
export async function initializeSession(){
 if(initialized)return currentSession;
 initialization??=http("/auth/me").then(data=>{const s=sessionSchema.parse(data);setSession(s);return s;}).catch(()=>{setSession(null);return null;}).finally(()=>{initialization=null;});
 return initialization;
}
export function getChallenge():Challenge|null{
 if(typeof window==="undefined")return null;
 try{const raw=sessionStorage.getItem(CHALLENGE_KEY);const parsed=challengeSchema.safeParse(raw?JSON.parse(raw):null);return parsed.success?parsed.data:null;}catch{return null;}
}
export function setChallenge(value:Challenge|null){if(value)sessionStorage.setItem(CHALLENGE_KEY,JSON.stringify(value));else sessionStorage.removeItem(CHALLENGE_KEY);}
// Returns "signed_in" when the account has no 2FA (password-only), otherwise
// stores the challenge and returns "challenge" for the /verify-2fa step.
async function credentials(path:string,input:{email:string;password:string}):Promise<"signed_in"|"challenge">{
 const data=await http(path,{method:"POST",body:JSON.stringify({...input,language:getLocale()})});
 const direct=verificationSchema.safeParse(data);
 if(direct.success){setChallenge(null);setSession(direct.data.session);return "signed_in";}
 setChallenge(challengeSchema.parse(data)); return "challenge";
}
export const authService={
 signup:(input:{email:string;password:string})=>credentials("/auth/signup",input),
 login:(input:{email:string;password:string})=>credentials("/auth/login",input),
 async google():Promise<void>{
  const result=z.object({url:z.string().url()}).parse(await http("/auth/google",{method:"POST",body:JSON.stringify({language:getLocale()})}));
  window.location.assign(result.url);
 },
 async loadChallenge(id:string){const result=challengeSchema.parse(await http(`/auth/2fa/challenge?id=${encodeURIComponent(id)}`));setChallenge(result);return result;},
 async setMethod(method:TwoFactorMethod){
  const challenge=getChallenge();if(!challenge)throw new ApiError(translateError("challenge_expired"),410,"challenge_expired");
  const updated=challengeSchema.parse(await http("/auth/2fa/method",{method:"POST",body:JSON.stringify({id:challenge.id,method})}));setChallenge(updated);return updated;
 },
 async resendCode(){const challenge=getChallenge();if(!challenge)throw new ApiError(translateError("challenge_expired"),410,"challenge_expired");await http("/auth/2fa/resend",{method:"POST",body:JSON.stringify({id:challenge.id})});},
 async verify2fa(code:string){
  const challenge=getChallenge();if(!challenge)throw new ApiError(translateError("challenge_expired"),410,"challenge_expired");
  const result=verificationSchema.parse(await http("/auth/2fa/verify",{method:"POST",body:JSON.stringify({id:challenge.id,code})}));setSession(result.session);setChallenge(null);return result;
 },
 async forgotPassword(email:string){await http("/auth/forgot",{method:"POST",body:JSON.stringify({email,language:getLocale()})});},
 async validateResetToken(token:string|undefined):Promise<ResetTokenState>{return z.enum(["valid","expired","invalid"]).parse(await http(`/auth/reset/validate?token=${encodeURIComponent(token??"")}`));},
 async resetPassword(token:string,password:string){await http("/auth/reset",{method:"POST",body:JSON.stringify({token,password})});},
 async logout(){await http("/auth/logout",{method:"POST"});setSession(null);setChallenge(null);},
 async refresh(){const session=sessionSchema.parse(await http("/auth/refresh",{method:"POST"}));setSession(session);return session;},
 updateLocalUser(patch:Partial<User>){if(currentSession)setSession({...currentSession,user:{...currentSession.user,...patch}});},
 async setupTotp(){return z.object({secret:z.string(),otpauthUrl:z.string()}).parse(await http("/auth/2fa/setup",{method:"POST"}));},
 async disableTotp(code:string){await http("/auth/2fa/disable",{method:"POST",body:JSON.stringify({code})});},
 async enableTotp(code:string){const result=await http("/auth/2fa/enable",{method:"POST",body:JSON.stringify({code})});return result;},
};
if(typeof window!=="undefined")window.addEventListener("campio:session-expired",()=>setSession(null));
