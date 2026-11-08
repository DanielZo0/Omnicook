/** Never accept an arbitrary post-login URL. */
export function returnPath(value:unknown):string{return typeof value==='string'&&/^\/(?:invite|shared)\/[\w-]{43}$/.test(value)?value:'/';}
