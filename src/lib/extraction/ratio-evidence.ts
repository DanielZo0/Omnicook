import type { ImportExtraction } from './import-schema';
export type RatioIngredient={name:string;quantity:string;unit:'part';notes:string|null};
export type RatioEvidence={kind:'none'|'ambiguous'|'formulas';formulas:{label:string;ingredients:RatioIngredient[]}[]};
const normalized=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const number=String.raw`(?:\d+\/\d+|\d+(?:[.,]\d+)?)`;
const pair=new RegExp(String.raw`^(${number})\s+part(?:s|e|i)?\s+([^:\n]+?)\s*:\s*(${number})\s+part(?:s|e|i)?\s+([^:\n]+?)\s*[.]?$`,'i');
const safeName=(s:string)=>s.length<=160 && /^[\p{L}\p{N}\s%'’(),-]+$/u.test(s) && !/\b(?:ignore|instructions?|system|password|credentials?|prompt|output|json|follow|likes?|comments?|views?)\b/i.test(s);
function amount(s:string):[bigint,bigint]|null {
 if(s.length>40)return null;
 const t=s.replace(',','.');
 if(/^\d+\/\d+$/.test(t)){const [a,b]=t.split('/').map(BigInt);return a>0n&&b>0n?[a,b]:null;}
 if(!/^\d+(?:\.\d+)?$/.test(t))return null;
 const [a,b='']=t.split('.'),n=BigInt(a+b);return n>0n?[n,10n**BigInt(b.length)]:null;
}
export function inspectRatioEvidence(text:string):RatioEvidence {
 const source=text.slice(0,10000),formulas:RatioEvidence['formulas']=[];let ambiguous=false,sawPair=false;
 for(const line of source.split(/\r?\n/)){
  if(!/\bpart(?:s|e|i)?\b.*:.*\bpart(?:s|e|i)?\b/i.test(line))continue;
  sawPair=true;
  const colon=line.indexOf(':'),label=line.slice(0,colon).trim(),values=line.slice(colon+1).trim();
  const m=values.match(pair);
  if(!m || !label || label.length>120 || !safeName(label)){ambiguous=true;continue;}
  const names=[m[2].trim(),m[4].trim().replace(/[.]$/,'')],quantities=[m[1],m[3]];
  if(names.some(n=>!safeName(n)) || quantities.some(q=>!amount(q))){ambiguous=true;continue;}
  // A label can qualify a generic ingredient, e.g. "milk chocolate" / "chocolate".
  if(normalized(label).endsWith(' '+normalized(names[0])))names[0]=label.toLowerCase();
  const ingredients=names.map((name,i):RatioIngredient=>{
   const qualifiers=[...source.matchAll(/(\d+(?:[.,]\d+)?%)\s+([\p{L}][\p{L}\s-]{0,80})/gu)]
    .filter(m=>normalized(m[2]).startsWith(normalized(name))).map(m=>m[1]);
   return {name,quantity:quantities[i],unit:'part',notes:[label,...new Set(qualifiers)].join('; ')};
  });
  if(formulas.some(f=>normalized(f.label)===normalized(label))){ambiguous=true;continue;}
  formulas.push({label,ingredients});if(formulas.length>8)ambiguous=true;
 }
 return {kind:ambiguous||sawPair&&!formulas.length?'ambiguous':formulas.length?'formulas':'none',formulas:formulas.slice(0,8)};
}
export function ratioFidelityIssues(evidence:RatioEvidence,extraction:ImportExtraction):string[] {
 if(evidence.kind==='none')return [];
 if(evidence.kind==='ambiguous')return ['Source ratio clauses cannot be attributed reliably.'];
 const actual=extraction.alternatives;
 if(evidence.formulas.length>1 && (!actual || actual.length!==evidence.formulas.length || extraction.ingredients.length))return ['Preserve every source formula as a separate alternative.'];
 if(evidence.formulas.length===1 && actual)return ['A single formula belongs in the ordinary ingredient list.'];
 const issues:string[]=[];
 for(const formula of evidence.formulas){
  const rows=actual?.find(a=>normalized(a.label)===normalized(formula.label))?.ingredients ?? (actual?[]:extraction.ingredients);
  if(rows.length!==formula.ingredients.length){issues.push('Formula ingredients were lost or combined: '+formula.label);continue;}
  for(const ingredient of formula.ingredients){
   const row=rows.find(i=>normalized(i.name)===normalized(ingredient.name));
   const a=amount(ingredient.quantity),b=row?.quantity?amount(row.quantity):null;
   if(!row || !/^(?:part|parts|parte|parti)$/i.test(row.unit||'') || !a || !b || a[0]*b[1]!==b[0]*a[1])issues.push('Preserve source parts and ingredient identity: '+formula.label+' / '+ingredient.name);
   const notes=normalized(row?.notes||'');
   if(actual && !notes.includes(normalized(formula.label)))issues.push('Preserve the formula label in notes: '+formula.label);
   for(const q of ingredient.notes?.match(/\d+(?:[.,]\d+)?%/g)||[])if(!notes.includes(q))issues.push('Preserve source qualifier '+q+' for '+ingredient.name);
  }
 }
 return issues;
}
