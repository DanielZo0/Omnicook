import { ImportExtraction } from './import-schema';
const normalize = (s:string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
function dish(s:string) { return normalize(s).replace(/\b(?:fatti in casa|fatte in casa|come fare|how to make|homemade|recipes?|ricette|ricetta)\b/g,'').trim().split(/\s+/).filter(Boolean).sort().join(' '); }
function amount(value:string|null) {
 if(!value)return null;
 const glyphs:Record<string,string>={'½':'1/2','¼':'1/4','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
 const text=value.replace(/(\d)([½¼¾⅓⅔⅛⅜⅝⅞])/g,'$1 $2').replace(/[½¼¾⅓⅔⅛⅜⅝⅞]/g,c=>glyphs[c]).trim().replace(',','.');
 const m=text.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
 if(m && Number(m[3]))return Number(m[1]||0)+Number(m[2])/Number(m[3]);
 return /^\d+(?:\.\d+)?$/.test(text)?Number(text):null;
}
function measure(quantity:string|null,unit:string|null) {
 const n=amount(quantity);if(n===null)return null;
 const u=normalize(unit||'');
 const aliases:Record<string,[string,number]>={g:['g',1],gram:['g',1],grams:['g',1],grammi:['g',1],kg:['g',1000],kilogram:['g',1000],ml:['ml',1],millilitri:['ml',1],l:['ml',1000],litro:['ml',1000],litri:['ml',1000]};
 const [base,factor]=aliases[u]||[u,1];return {n:n*factor,unit:base};
}
export function matchRecipe(caption:ImportExtraction,candidate:ImportExtraction):{matches:boolean;reason:string} {
 const fail=(reason:string)=>({matches:false,reason});
 if(candidate.completeness!=='complete'||!candidate.steps.length)return fail('Instructions are incomplete.');
 if(!dish(caption.title)||dish(caption.title)!==dish(candidate.title))return fail('Dish names differ.');
 if(caption.servings!=null&&candidate.servings!=null&&caption.servings!==candidate.servings)return fail('Recipe yields differ.');
 const quantified=caption.ingredients.filter(i=>i.quantity!==null&&i.quantity!=='');
 const used=new Set<number>();let matches=0;
 for(const ing of quantified){
  const same=candidate.ingredients.map((i,index)=>({i,index})).filter(x=>normalize(x.i.name)===normalize(ing.name));
  const a=measure(ing.quantity,ing.unit);if(!a)continue;
  const comparable=same.filter(x=>!used.has(x.index)).map(x=>({...x,b:measure(x.i.quantity,x.i.unit)}));
  const hit=comparable.find(x=>x.b&&x.b.unit===a.unit&&Math.abs(x.b.n-a.n)<1e-9);
  if(hit){used.add(hit.index);matches++;}
  else if(same.length)return fail('Ingredient quantities conflict or cannot be compared.');
 }
 return matches>=3&&matches/quantified.length>=0.8 ? {matches:true,reason:'Dish and ingredient quantities match.'}:fail('Not enough matching quantified ingredients.');
}
