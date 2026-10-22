import { fetchSourcePage, type SourceDocument } from './fetch-source';
import type { ImportBudget } from './import-budget';
import { normalizeImageUrl } from '../image-url';
function linkedUrls(text:string):URL[]{
 const values=text.match(/https?:\/\/[^\s<>"']+|\bwww\.[a-z0-9.-]+(?:\/[^\s<>"']*)?/gi)||[];
 return values.slice(0,8).flatMap(value=>{try{const u=new URL(value.startsWith('www.')?'https://'+value:value.replace(/[).,;]+$/,''));return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?[u]:[];}catch{return []}});
}
const host=(u:URL)=>u.hostname.replace(/^www\./,'').toLowerCase();
const terms=(s:string)=>s.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>2&&!['fatti','fatte','casa','recipe','ricetta','homemade'].includes(x));
export async function discoverOriginal(source:SourceDocument,dishName:string,budget:ImportBudget):Promise<SourceDocument[]> {
 const urls=linkedUrls(source.page?.caption||source.page?.description||source.text).filter(u=>!/(?:^|\.)(?:instagram\.com|facebook\.com|youtube\.com|amazon\.[a-z.]+)$/.test(u.hostname));
 if(!urls.length)return [];
 const creator=urls[0];
 const allowed=(u:URL)=>host(u)===host(creator)&&u.port===creator.port&&['http:','https:'].includes(u.protocol)&&!(creator.protocol==='https:'&&u.protocol==='http:');
 const fetchPage=(value:string)=>budget.runSource(signal=>fetchSourcePage(value,signal,()=>budget.takeAdditionalRequest(),allowed));
 const asDocument=(r:Awaited<ReturnType<typeof fetchSourcePage>>):SourceDocument=>({sourceUrl:r.url,imageUrl:normalizeImageUrl(r.page.image,r.url),text:(r.page.structuredText||[r.page.title,r.page.description,r.page.body].filter(Boolean).join('\n\n')).slice(0,10000),page:r.page});
 try{
  const explicit=[...new Map(urls.filter(u=>allowed(u)&&u.pathname!=='/'&&u.pathname!=='').map(u=>[u.href,u])).values()];
  if(explicit.length>3)throw new Error('Too many plausible originals to select confidently.');
  if(explicit.length){const docs:SourceDocument[]=[];for(const u of explicit){const doc=asDocument(await fetchPage(u.href));if(!docs.some(d=>d.sourceUrl===doc.sourceUrl))docs.push(doc);}return docs;}
  const homepage=await fetchPage(creator.href);let listing=homepage;
  const form=homepage.page.searchForms.find(f=>{try{return allowed(new URL(f.action,homepage.url));}catch{return false;}});
  if(form){const search=new URL(form.action,homepage.url);for(const [key,val] of Object.entries(form.hidden))search.searchParams.set(key,val);search.searchParams.set(form.queryName,dishName);listing=await fetchPage(search.href);}
  const words=terms(dishName),seen=new Set<string>();
  const links=listing.page.links.flatMap(link=>{try{const u=new URL(link.url,listing.url);u.hash='';if(!allowed(u)||seen.has(u.href)||u.href===homepage.url||u.href===listing.url)return [];seen.add(u.href);const content=terms(link.text+' '+decodeURIComponent(u.pathname));const score=words.filter(w=>content.includes(w)).length;return score?[{url:u.href,score}]:[];}catch{return []}}).sort((a,b)=>b.score-a.score);
  if(links.length>3)throw new Error('Too many plausible originals to select confidently.');
  const docs:SourceDocument[]=[];
  for(const link of links.slice(0,3)){const doc=asDocument(await fetchPage(link.url));if(!docs.some(x=>x.sourceUrl===doc.sourceUrl))docs.push(doc);}
  return docs;
 }catch(error){
  // Failure before discovering a candidate is a safe unresolved search. Do not
  // return the first candidate if evaluating the rest failed or hit a limit.
  if(error instanceof Error && /Too many/.test(error.message))throw error;
  return [];
 }
}
