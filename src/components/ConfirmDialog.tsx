'use client';
import {dismissDialog} from '@/lib/recipes/import-review';
import { useEffect, useRef } from 'react';
export function ConfirmDialog({title,children,onConfirm,onCancel,confirmLabel='Discard',cancelLabel='Keep editing',onDismiss}:{title:string;children?:React.ReactNode;onConfirm:()=>void;onCancel:()=>void;confirmLabel?:string;cancelLabel?:string;onDismiss?:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();previous?.focus();};},[]);
 return <dialog ref={ref} onCancel={e=>dismissDialog(e,onCancel,onDismiss)} style={{maxWidth:440,border:'1px solid #e2e7ef',borderRadius:16,padding:24,color:'#1b2b43'}} aria-labelledby="draft-confirm-title"><h2 id="draft-confirm-title">{title}</h2>{children}<div style={{display:'flex',gap:12,marginTop:20}}><button onClick={onCancel}>{cancelLabel}</button><button onClick={onConfirm}>{confirmLabel}</button></div></dialog>;
}
