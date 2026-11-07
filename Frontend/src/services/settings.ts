import { z } from "zod";
import { http } from "./api";
import { settingsSchema, type Settings } from "./schemas";
export const settingsService={
 async get():Promise<Settings>{return settingsSchema.parse(await http("/settings"));},
 async update(patch:Partial<Settings>):Promise<Settings>{return settingsSchema.parse(await http("/settings",{method:"PATCH",body:JSON.stringify(patch)}));},
 async changePassword(current:string,next:string){await http("/settings/password",{method:"POST",body:JSON.stringify({current,next})});},
 async deleteAccount(){await http("/settings/account",{method:"DELETE"});},
};
const onboardingSchema=z.object({completed:z.array(z.string()),activity:z.array(z.string())});
export const onboardingService={
 async get(){return onboardingSchema.parse(await http("/onboarding"));},
 async mark(id:string){const current=await this.get();if(!current.completed.includes(id))await http("/onboarding",{method:"PATCH",body:JSON.stringify({completed:[...current.completed,id]})});},
};
