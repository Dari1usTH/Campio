import { http } from "./api";
import { getLocale } from "@/i18n";
import { parseResultSchema } from "./schemas";
export const wizardService={
 async parseProduct(text:string){return parseResultSchema.parse(await http("/wizard/parse",{method:"POST",body:JSON.stringify({text,language:getLocale()})}));},
};
