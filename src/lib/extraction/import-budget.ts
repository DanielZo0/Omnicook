export type ImportBudget=ReturnType<typeof createImportBudget>;
export function createImportBudget(now:()=>number=Date.now) {
 const deadline=now()+54000;let source=18000,ai=36000,requests=0;
 const remainingOverallMs=()=>Math.max(0,deadline-now());
 async function run<T>(kind:'source'|'ai',work:(ms:number,signal:AbortSignal)=>Promise<T>):Promise<T>{
  const ms=Math.min(kind==='source'?source:ai,remainingOverallMs());
  if(ms<=0)throw new Error('Import time budget exhausted.');
  const started=now(),controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([work(ms,controller.signal),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Import time budget exhausted.'));},ms);})]);}
  finally{if(timer)clearTimeout(timer);const elapsed=Math.max(0,now()-started);if(kind==='source')source-=elapsed;else ai-=elapsed;}
 }
 return {remainingOverallMs,
  runSource:<T>(work:(signal:AbortSignal)=>Promise<T>)=>run('source',(_,signal)=>work(signal)),
  runAI:<T>(work:(remainingMs:number)=>Promise<T>)=>run('ai',ms=>work(ms)),
  takeAdditionalRequest:()=>{if(requests>=5)throw new Error('Creator search request limit reached.');requests++;},
 };
}
