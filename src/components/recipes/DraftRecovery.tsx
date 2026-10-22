'use client';
import { ConfirmDialog } from '../ConfirmDialog';
export function DraftRecovery({title,onRecover,onDiscard}:{title:string;onRecover:()=>void;onDiscard:()=>void}){
 return <ConfirmDialog title="Continue your recipe?" confirmLabel="Continue this recipe" onConfirm={onRecover} onCancel={onDiscard}><p>A draft of {title||'your recipe'} is saved on this device.</p><p>Continuing opens it for review; it will not save automatically.</p></ConfirmDialog>;
}
