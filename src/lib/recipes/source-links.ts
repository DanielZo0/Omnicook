import {z} from 'zod';
export const sourceLinkSchema=z.string().max(2048).refine(value=>{
 try{const u=new URL(value);const host=u.hostname.toLowerCase();return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&(!u.port||['80','443'].includes(u.port))&&host.includes('.')&&!/^[\d.]+$/.test(host)&&!/(?:^|\.)(?:localhost|local|internal)$/.test(host);}catch{return false;}
},'Use a public HTTP(S) recipe link without credentials.');
export const sourceLinksSchema=z.object({sourceUrl:sourceLinkSchema.nullable(),originalRecipeUrl:sourceLinkSchema.nullable().default(null)});
export function safeSourceLink(value:unknown):string|null{const p=sourceLinkSchema.safeParse(value);return p.success?p.data:null;}
