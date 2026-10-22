'use client';
import {dismissDialog} from '@/lib/recipes/import-review';
import { useEffect, useRef } from 'react';
export function ConfirmDialog({title,children,onConfirm,onCancel,confirmLabel='Discard',cancelLabel='Keep editing',onDismiss}:{title:string;children?:React.ReactNode;onConfirm:()=>void;onCancel:()=>void;confirmLabel?:string;cancelLabel?:string;onDismiss?:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{ref.current?.close();previous?.focus();};},[]);
 return <dialog className="recipe-dialog" ref={ref} onCancel={e=>dismissDialog(e,onCancel,onDismiss)} style={{maxWidth:440,border:'1px solid var(--line)',borderRadius:16,padding:24,color:'var(--ink)'}} aria-labelledby="draft-confirm-title"><h2 id="draft-confirm-title">{title}</h2>{children}<div style={{display:'flex',gap:12,marginTop:20}}><button onClick={onCancel}>{cancelLabel}</button><button onClick={onConfirm}>{confirmLabel}</button></div></dialog>;
}
