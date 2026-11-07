import { z } from "zod";
import { ApiError, http } from "./api";
import { translateError } from "@/i18n";
import { adaptCampaign, kitSchema } from "./campaign-adapter";
import { channelResultSchema, notificationSchema, resultsAnalysisSchema, wizardDraftSchema } from "./schemas";
import type { Campaign,ChannelResult,WizardDraft } from "./schemas";

export const GENERATION_STEPS=[{id:"intake"},{id:"market"},{id:"strategy"},{id:"content"},{id:"plan"}] as const;
export interface GenerationStatus{id:string;stepIndex:number;progress:number;done:boolean;scores:{a:number;b:number;c:number};questions?:{id:string;text:string;field:string;kind:string;required:boolean;hint?:string|undefined}[];}
export interface CampaignFilters{q?:string;status?:Campaign["status"]|"all";}
const idPath=(id:string)=>`/campaigns/${encodeURIComponent(id)}`;
const listSchema=z.object({items:z.array(z.object({id:z.string()})),total:z.number(),limit:z.number(),offset:z.number()});
export const campaignsService={
 async list(filters:CampaignFilters={}){
  const rows:string[]=[];
  for(let offset=0;;offset+=100){const page=listSchema.parse(await http(`/campaigns?limit=100&offset=${offset}`));rows.push(...page.items.map(c=>c.id));if(offset+page.items.length>=page.total||page.items.length===0)break;}
  const campaigns=await Promise.all(rows.map(id=>this.get(id)));
  const q=filters.q?.trim().toLowerCase();
  return campaigns.filter(c=>(!filters.status||filters.status==="all"||c.status===filters.status)&&(!q||`${c.product.name} ${c.product.category}`.toLowerCase().includes(q)));
 },
 async get(id:string){return adaptCampaign(await http(idPath(id)));},
 async create(draft:WizardDraft){
  const d=wizardDraftSchema.parse(draft);
  const prompt=[d.rawText,JSON.stringify({product:d.product,marketplaces:d.marketplaces,campaign_goal:d.goal,ad_budget_ron:d.budget,tone:d.tone,duration_days:d.durationDays,campaign_language:d.language})].join("\n");
  const result=z.object({id:z.string()}).parse(await http("/campaigns",{method:"POST",body:JSON.stringify({prompt,language:d.language,ui_data:{draft:d}})}));return result;
 },
 async generationStatus(id:string):Promise<GenerationStatus>{
  const raw=await http(idPath(id));const kit=kitSchema.parse(raw);
  if(kit.status==="failed")throw new ApiError(translateError("generation_failed"),500,"generation_failed");
  const done=kit.status==="completed";const stepIndex=done?5:Math.max(0,GENERATION_STEPS.findIndex(s=>s.id===kit.step));
  const campaign=adaptCampaign(raw);const scores=campaign.messages.map(m=>m.score);
  return{id,stepIndex,progress:done?1:Math.min(.95,(stepIndex+.3)/5),done,scores:{a:scores[0]??0,b:scores[1]??0,c:scores[2]??0},...(kit.status==="needs_input"?{questions:kit.intake?.questions??[]}: {})};
 },
 async answerQuestions(id:string,answers:{question_id:string;value:string;skip?:boolean}[]){await http(`${idPath(id)}/answers`,{method:"POST",body:JSON.stringify({answers})});},
 async patch(id:string,patch:Partial<Campaign>){await http(`${idPath(id)}/ui-data`,{method:"PATCH",body:JSON.stringify(patch)});return this.get(id);},
 async toggleWarning(id:string,warningId:string){const c=await this.get(id);const resolved=c.warnings.filter(w=>w.id===warningId?!w.resolved:w.resolved).map(w=>w.id);await http(`${idPath(id)}/ui-data`,{method:"PATCH",body:JSON.stringify({resolvedWarnings:resolved})});return this.get(id);},
 async toggleAction(id:string,channelId:string,actionId:string){const c=await this.get(id);const completed=c.channels.flatMap(ch=>ch.firstActions.filter(a=>ch.id===channelId&&a.id===actionId?!a.done:a.done).map(a=>a.id));await http(`${idPath(id)}/ui-data`,{method:"PATCH",body:JSON.stringify({completedActions:completed})});return this.get(id);},
 async saveResults(id:string,results:ChannelResult[]){z.array(channelResultSchema).min(1).parse(results);return resultsAnalysisSchema.parse(await http(`${idPath(id)}/results`,{method:"POST",body:JSON.stringify(results)}));},
 async analysis(id:string){return resultsAnalysisSchema.nullable().parse(await http(`${idPath(id)}/results/analysis`));},
 async remove(id:string){await http(idPath(id),{method:"DELETE"});},
 async notifications(){return z.array(notificationSchema).parse(await http("/notifications"));},
 async markAllRead(){await http("/notifications/read",{method:"POST"});},
 async assets(id:string){return z.object({items:z.array(z.object({id:z.string(),campaign_id:z.string(),kind:z.string(),status:z.string(),name:z.string(),mime:z.string(),content_url:z.string()}))}).parse(await http(`${idPath(id)}/assets`)).items;},
};
