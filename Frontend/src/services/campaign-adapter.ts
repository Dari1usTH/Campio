import { z } from "zod";
import { campaignSchema, wizardDraftSchema, type Campaign, type Platform } from "./schemas";

const strings=z.array(z.string()).nullish().transform(v=>v??[]);
const persona=z.object({id:z.string(),name:z.string(),age_range:z.string(),description:z.string(),motivations:strings,channels:strings});
const ad=z.object({id:z.string(),headline:z.string(),primary_text:z.string(),angle:z.string(),cta:z.string()});
const social=z.object({channel:z.string(),text:z.string(),hashtags:strings});
const shot=z.object({duration_s:z.number(),description:z.string(),caption:z.string()});
const channel=z.object({channel:z.string(),label:z.string(),budget_ron:z.number(),rationale:z.string(),est_orders:z.number(),est_clicks:z.number(),est_impressions:z.number(),cpa_ron:z.number()});
const metadata=z.record(z.unknown());
export const kitSchema=z.object({
 id:z.string(),created_at:z.string(),status:z.enum(["pending","running","needs_input","completed","failed"]),step:z.string(),error:z.string().optional(),
 steps:z.array(z.object({step:z.string(),status:z.string()})).nullish().transform(v=>v??[]),
 input:z.object({prompt:z.string(),product_name:z.string(),keyword:z.string(),product_description:z.string().optional(),sale_price:z.number(),ad_budget_ron:z.number(),language:z.enum(["en","ro"]).optional()}),
 intake:z.object({questions:z.array(z.object({id:z.string(),text:z.string(),field:z.string(),kind:z.string(),required:z.boolean(),hint:z.string().optional()})).nullish().transform(v=>v??[])}).optional(),
 strategy:z.object({summary:z.string(),personas:z.array(persona).nullish().transform(v=>v??[]),positioning:z.object({statement:z.string(),main_message:z.string(),tone:z.string(),proof_points:strings}),complaints:z.array(z.object({theme:z.string(),opportunity:z.string(),quotes:strings})).nullish().transform(v=>v??[])}).nullish(),
 content:z.object({listing:z.object({titles:strings,description:z.string(),bullets:strings}),ads:z.array(ad).nullish().transform(v=>v??[]),social_posts:z.array(social).nullish().transform(v=>v??[]),video_concepts:z.array(z.object({hook:z.string(),shots:z.array(shot).nullish().transform(v=>v??[])})).nullish().transform(v=>v??[])}).nullish(),
 plan:z.object({channels:z.array(channel).nullish().transform(v=>v??[]),calendar:z.array(z.object({week:z.number(),actions:z.array(z.object({channel:z.string(),action:z.string()})).nullish().transform(v=>v??[])})).nullish().transform(v=>v??[]),totals:z.object({est_orders:z.number(),est_clicks:z.number(),est_impressions:z.number(),cpa_ron:z.number()})}).nullish(),
 cost:z.object({total_cost_usd:z.number()}).optional(),
 ui_data:metadata.nullish().transform(v=>v??{}),
});
export type Kit=z.infer<typeof kitSchema>;
const platform=(key:string):Platform=>({meta:"instagram",emag_ads:"google",google_ads:"google",google_search:"google",youtube:"tiktok"}[key]??(["instagram","pinterest","tiktok","facebook","email","google"].includes(key)?key:"instagram")) as Platform;

/** Adapts the existing Go kit contract without replacing its generation logic. */
export function adaptCampaign(raw:unknown):Campaign{
 const direct=campaignSchema.safeParse(raw);if(direct.success)return direct.data;
 const kit=kitSchema.parse(raw); const data=kit.ui_data;
 const draft=wizardDraftSchema.safeParse(data["draft"]??data);
 const d=draft.success?draft.data:null;
 const generatedLanguage=kit.input.language??d?.language??"en";
 const ro=generatedLanguage==="ro";
 const ads=kit.content?.ads??[];
 const channels=kit.plan?.channels??[];
 const completed=Array.isArray(data["completedActions"])?data["completedActions"]:[];
 const resolved=Array.isArray(data["resolvedWarnings"])?data["resolvedWarnings"]:[];
 const primary=ads[0]; const totals=kit.plan?.totals;
 const socialPost=kit.content?.social_posts.find(p=>p.channel==="instagram")??kit.content?.social_posts[0];
 const video=kit.content?.video_concepts[0];let seconds=0;
 const messages=data["messages"]??ads.map((item,i)=>({id:item.id,label:String.fromCharCode(65+i),text:item.headline,angle:item.angle,click:0,stop:0,share:0,score:0,isWinner:false,reactions:[]}));
 const campaign={
 id:kit.id,createdAt:kit.created_at,status:data["status"]==="launched"?"launched":kit.status==="completed"?"ready":"generating",isDemo:data["isDemo"]===true,
 product:d?.product??{name:kit.input.product_name,category:kit.input.keyword,price:kit.input.sale_price||null,currency:"RON",shortDescription:kit.input.product_description??kit.input.prompt,strengths:kit.strategy?.positioning.proof_points??[],audience:kit.strategy?.personas.map(p=>p.name).join(", ")??"",country:ro?"România":"Romania"},
 marketplaces:d?.marketplaces??[],goal:d?.goal??"sales",budget:d?.budget??kit.input.ad_budget_ron,tone:d?.tone??"warm",durationDays:d?.durationDays??28,health:data["health"]??0,
 segments:(kit.strategy?.personas??[]).map(p=>({id:p.id,name:p.name,ageRange:p.age_range,platforms:[...new Set(p.channels.map(platform))],motivations:p.motivations,description:p.description})),
 positioning:kit.strategy?.positioning.statement??"",keyMessage:kit.strategy?.positioning.main_message??primary?.headline??"",tones:kit.strategy?[kit.strategy.positioning.tone]:[],messages,
 warnings:(Array.isArray(data["warnings"])?data["warnings"]:[]).map((w)=>({...w,resolved:resolved.includes(w.id)})),
 agentRounds:data["agentRounds"]??[],
 channels:channels.map(ch=>({id:ch.channel,channel:ch.label,platform:platform(ch.channel),type:ch.budget_ron>0?"paid":"organic",budget:ch.budget_ron,why:ch.rationale,firstActions:(kit.plan?.calendar??[]).flatMap(week=>week.actions.filter(a=>a.channel===ch.channel).map((a,i)=>{const id=`${ch.channel}-${week.week}-${i}`;return{id,text:a.action,done:completed.includes(id)};})).slice(0,8)})),
 copy:{instagram:{caption:socialPost?.text??"",hashtags:socialPost?.hashtags??[]},tiktok:{hook:video?.hook??"",beats:(video?.shots??[]).map(s=>{const from=seconds;seconds+=s.duration_s;return{from,to:seconds,visual:s.description,voice:s.caption};})},meta:{headline:primary?.headline??"",primaryText:primary?.primary_text??"",cta:primary?.cta??""},email:{subjects:kit.content?.listing.titles??[]}},
 kpis:totals?[
 {id:"orders",label:ro?"Comenzi":"Orders",target:Math.round(totals.est_orders),unit:"",hint:ro?"Estimare calculată, nu o garanție.":"Calculated estimate, not a guarantee."},
 {id:"ctr",label:ro?"Rată de click":"Click-through rate",target:totals.est_impressions?Math.round(totals.est_clicks/totals.est_impressions*10000)/100:0,unit:"%",hint:ro?"Pe baza benchmark-urilor canalelor.":"Based on channel benchmarks."},
 {id:"cpo",label:ro?"Cost per comandă":"Cost per order",target:totals.cpa_ron,unit:"RON",hint:ro?"Pe baza benchmark-urilor canalelor.":"Based on channel benchmarks."}
 ]:[],costUsd:[kit.cost?.total_cost_usd??0,kit.cost?.total_cost_usd??0],
 ...(Array.isArray(data["results"])?{results:data["results"]}:{}),
 };
 return campaignSchema.parse(campaign);
}
