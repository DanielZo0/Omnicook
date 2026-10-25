import { recipeSchema } from '../recipe-schema';
export type ImportRequestStamp={ownerKey:string;revision:number;requestId:number};
export function shouldApplyImport(start:ImportRequestStamp,current:ImportRequestStamp):boolean{return start.ownerKey===current.ownerKey&&start.revision===current.revision&&start.requestId===current.requestId;}
export function canSaveDraft(value:unknown,status?:string,completionConfirmed=false):boolean{
 const p=recipeSchema.safeParse(value);return (status!=='incomplete'||completionConfirmed)&&p.success&&p.data.title.trim().length>0&&p.data.ingredients.every(i=>i.name.trim())&&p.data.steps.every(s=>s.instruction.trim());
}

export function screenAfterDraftOwnerChange<T extends string>(screen:T):T|'vault'|'import'{return screen==='review'||screen==='edit'?'vault':screen==='extracting'?'import':screen;}
export function dismissDialog(event:{preventDefault:()=>void},onCancel:()=>void,onDismiss?:()=>void){event.preventDefault();(onDismiss??onCancel)();}

import type {EditableRecipeDraft,FormulaAlternative} from '../extraction/import-schema';
export type FormulaReview={draft:EditableRecipeDraft;alternatives?:FormulaAlternative[];selectedAlternativeId?:string|null;alternativeBaseTitle?:string;status?:'complete'|'incomplete';completionConfirmed?:boolean};
export function chooseAlternative<T extends FormulaReview>(result:T,id:string):T {
 const choice=result.alternatives?.find(a=>a.id===id);
 if(!choice)throw new Error('Choose an available formula.');
 const base=result.alternativeBaseTitle||result.draft.title;
 return {...result,selectedAlternativeId:id,alternativeBaseTitle:base,status:'incomplete',completionConfirmed:false,
  draft:{...result.draft,title:`${base.slice(0,180-choice.label.length-3)} — ${choice.label}`,ingredients:choice.ingredients.map((i,position)=>({...i,position})),steps:[]}};
}
export function canSaveReview(result:FormulaReview):boolean {
 if(result.alternatives&&!result.alternatives.some(a=>a.id===result.selectedAlternativeId))return false;
 return canSaveDraft(result.draft,result.status,result.completionConfirmed);
}
export function alternativeHasEdits(result:FormulaReview):boolean {
 if(!result.selectedAlternativeId)return false;
 const original=chooseAlternative(result,result.selectedAlternativeId);
 return JSON.stringify(original.draft)!==JSON.stringify(result.draft)||Boolean(result.completionConfirmed);
}
