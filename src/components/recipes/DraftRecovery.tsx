'use client';
import { ConfirmDialog } from '../ConfirmDialog';
export function DraftRecovery({title,onRecover,onDiscard,onDismiss}:{title:string;onRecover:()=>void;onDiscard:()=>void;onDismiss:()=>void}){
 return <ConfirmDialog title="Continue your recipe?" confirmLabel="Continue this recipe" cancelLabel="Discard draft" onDismiss={onDismiss} onConfirm={onRecover} onCancel={onDiscard}><p>A draft of {title||'your recipe'} is saved on this device.</p><p>Continuing opens it for review; it will not save automatically.</p></ConfirmDialog>;
}
