require('./register-ts.cjs');
const {test,mock}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const flush=()=>new Promise(resolve=>setImmediate(resolve));

function hookHarness(t,getSession){
 const states=[],effects=[];
 const win=new EventTarget(),doc=new EventTarget();doc.visibilityState='visible';
 const oldWindow=global.window,oldDocument=global.document;
 global.window=win;global.document=doc;
 const originalLoad=Module._load;
 const patch=mock.method(Module,'_load',function(name,parent,isMain){
  if(name==='react')return {
   useState:value=>{const i=states.length;states.push(value);return [value,next=>{states[i]=next}];},
   useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:fn=>effects.push(fn),
  };
  if(name==='./client'&&parent?.filename.endsWith('session.ts'))return {AUTH_CONFIGURED:true,authClient:()=>({getSession})};
  return originalLoad.call(this,name,parent,isMain);
 });
 const path=require.resolve('../src/lib/auth/session.ts');delete require.cache[path];
 const {useSession}=require(path);patch.mock.restore();useSession();
 const cleanup=effects[0]();
 t.after(()=>{cleanup?.();delete require.cache[path];global.window=oldWindow;global.document=oldDocument;});
 return {states,win,doc};
}
test('an installed app returning from Google rechecks its session when visible',async t=>{
 let calls=0;
 const h=hookHarness(t,async()=>({data:{user:++calls===1?null:{id:'existing-user',email:'cook@example.test'}}}));
 await flush();assert.equal(h.states[0],null);
 h.doc.visibilityState='hidden';h.doc.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(calls,1);
 h.doc.visibilityState='visible';h.doc.dispatchEvent(new Event('visibilitychange'));await flush();
 assert.equal(calls,2);assert.equal(h.states[0]?.id,'existing-user');
});
test('overlapping resume events share one check and keep the current session visible',async t=>{
 let calls=0,finish;
 const user={id:'existing-user',email:'cook@example.test'};
 const h=hookHarness(t,()=>++calls===1?Promise.resolve({data:{user}}):new Promise(resolve=>{finish=resolve}));
 await flush();assert.equal(h.states[1],false);
 h.win.dispatchEvent(new Event('focus'));h.win.dispatchEvent(new Event('pageshow'));h.doc.dispatchEvent(new Event('visibilitychange'));
 assert.equal(calls,2);assert.equal(h.states[1],false);assert.equal(h.states[0]?.id,user.id);
 finish({data:{user}});await flush();
});
test('a temporary foreground-check error does not turn an existing user into a signed-out visitor',async t=>{
 let calls=0;
 const user={id:'existing-user',email:'cook@example.test'};
 const h=hookHarness(t,async()=>++calls===1?{data:{user}}:{data:null,error:{status:503,message:'Temporarily unavailable'}});
 await flush();h.win.dispatchEvent(new Event('focus'));await flush();
 assert.equal(h.states[0]?.id,user.id);
});
test('a rejected session clears the signed-in user on return',async t=>{
 let calls=0;
 const h=hookHarness(t,async()=>++calls===1?{data:{user:{id:'expired-user',email:'cook@example.test'}}}:{data:null,error:{status:401}});
 await flush();h.win.dispatchEvent(new Event('focus'));await flush();
 assert.equal(h.states[0],null);
});
