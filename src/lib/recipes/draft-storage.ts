import { z } from 'zod';
import { editableRecipeSchema, formulaAlternativesSchema } from '../extraction/import-schema';
export type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const ownerSchema=z.discriminatedUnion('kind',[z.object({kind:z.literal('guest')}),z.object({kind:z.literal('user'),userId:z.string().min(1).max(256)})]);
export type DraftOwner=z.infer<typeof ownerSchema>;
const storedDraftSchema=z.object({version:z.literal(1),owner:ownerSchema,updatedAt:z.number().finite(),expiresAt:z.number().finite(),draft:editableRecipeSchema,
 sourceUrl:z.string().max(2048).nullable(),imageUrl:z.string().max(4096).nullable(),originalRecipeUrl:z.string().max(2048).nullable().default(null),
 editRecipeId:z.string().nullable(),collectionId:z.string().nullable(),sourceText:z.string().max(20000),
 alternatives:formulaAlternativesSchema.optional(),selectedAlternativeId:z.string().max(64).nullable().default(null),alternativeBaseTitle:z.string().min(1).max(180).optional(),
 completionConfirmed:z.boolean().default(false),
 importStatus:z.enum(['complete','incomplete']).default('incomplete'),missingFields:z.array(z.enum(['ingredients','instructions'])).default(['instructions']),
}).superRefine((d,ctx)=>{if(d.selectedAlternativeId&&!d.alternatives?.some(a=>a.id===d.selectedAlternativeId) || d.alternatives&&!d.alternativeBaseTitle)ctx.addIssue({code:'custom',message:'Recovered formula selection is invalid.'});});
export type StoredDraft=z.infer<typeof storedDraftSchema>;
export function draftOwnerKey(owner:DraftOwner){return owner.kind==='guest'?'omnicook:draft:v1:guest':`omnicook:draft:v1:user:${owner.userId}`;}
export function readDraft(storage:StoragePort,owner:DraftOwner,now:number):StoredDraft|null{
 try{const raw=storage.getItem(draftOwnerKey(owner));if(!raw||raw.length>500000)return null;const p=storedDraftSchema.safeParse(JSON.parse(raw));if(!p.success)return null;
 const d=p.data,ttl=owner.kind==='guest'?86400000:604800000;
 if(draftOwnerKey(d.owner)!==draftOwnerKey(owner)||d.updatedAt>now||d.expiresAt<=now||d.expiresAt-d.updatedAt>ttl||d.expiresAt<=d.updatedAt)return null;return d;
 }catch{return null;}
}
export function writeDraft(storage:StoragePort,value:unknown):{ok:true}|{ok:false;reason:'unavailable'}{try{const d=storedDraftSchema.parse(value);const json=JSON.stringify(d);if(json.length>500000)return {ok:false,reason:'unavailable'};storage.setItem(draftOwnerKey(d.owner),json);return {ok:true};}catch{return {ok:false,reason:'unavailable'};}}
export function clearDraft(storage:StoragePort,owner:DraftOwner):boolean{try{storage.removeItem(draftOwnerKey(owner));return true;}catch{return false;}}
