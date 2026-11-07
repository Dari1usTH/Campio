import { beforeEach, describe, expect, it, vi } from "vitest";
const backend=vi.hoisted(()=>vi.fn());
vi.mock("@/services/api",()=>({http:backend,ApiError:class ApiError extends Error{constructor(message:string,public status:number,public code:string){super(message);}}}));
const challenge={id:"challenge-id",email:"seller@example.com",method:"email",firstSetup:true};
const session={token:"",user:{id:"u1",name:"Seller",email:challenge.email,businessName:"Shop",twoFactorEnabled:false,language:"en"}};
beforeEach(()=>{vi.resetModules();backend.mockReset();localStorage.clear();sessionStorage.clear();});
describe("real authentication boundary",()=>{
 it("does not authenticate before a server-verified code and never stores credentials",async()=>{
  const {authService,getSession,getChallenge}=await import("@/services/auth");
  backend.mockResolvedValueOnce(challenge);
  await authService.signup({email:challenge.email,password:"LongPassword123!"});
  expect(getSession()).toBeNull();expect(getChallenge()).toEqual(challenge);
  backend.mockResolvedValueOnce({session});
  await authService.verify2fa("456789");expect(getSession()).toEqual(session);expect(getChallenge()).toBeNull();
  expect(localStorage.getItem("campio:token")).toBeNull();expect(localStorage.getItem("campio:session")).toBeNull();
 });
 it("rejects verification without a challenge before making an API call",async()=>{
  const{authService}=await import("@/services/auth");await expect(authService.verify2fa("123456")).rejects.toMatchObject({status:410});expect(backend).not.toHaveBeenCalled();
 });
 it("preserves an unverified challenge when the server rejects OTP",async()=>{
  const{authService,getChallenge,getSession}=await import("@/services/auth");backend.mockResolvedValueOnce(challenge);await authService.login({email:challenge.email,password:"LongPassword123!"});backend.mockRejectedValueOnce(new Error("invalid_otp"));await expect(authService.verify2fa("000000")).rejects.toThrow();expect(getChallenge()).toEqual(challenge);expect(getSession()).toBeNull();
 });
 it("rejects malformed session payloads rather than accepting them",async()=>{
  const{authService,getSession}=await import("@/services/auth");backend.mockResolvedValueOnce(challenge);await authService.login({email:challenge.email,password:"LongPassword123!"});backend.mockResolvedValueOnce({session:{user:{email:challenge.email}}});await expect(authService.verify2fa("456789")).rejects.toThrow();expect(getSession()).toBeNull();
 });
});
