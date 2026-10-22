import { recipeSchema } from '../recipe-schema';
export type ImportRequestStamp={ownerKey:string;revision:number;requestId:number};
export function shouldApplyImport(start:ImportRequestStamp,current:ImportRequestStamp):boolean{return start.ownerKey===current.ownerKey&&start.revision===current.revision&&start.requestId===current.requestId;}
export function canSaveDraft(value:unknown,status?:string,completionConfirmed=false):boolean{
 const p=recipeSchema.safeParse(value);return (status!=='incomplete'||completionConfirmed)&&p.success&&p.data.title.trim().length>0&&p.data.ingredients.every(i=>i.name.trim())&&p.data.steps.every(s=>s.instruction.trim());
}

export function screenAfterDraftOwnerChange<T extends string>(screen:T):T|'vault'|'import'{return screen==='review'||screen==='edit'?'vault':screen==='extracting'?'import':screen;}
export function dismissDialog(event:{preventDefault:()=>void},onCancel:()=>void,onDismiss?:()=>void){event.preventDefault();(onDismiss??onCancel)();}
