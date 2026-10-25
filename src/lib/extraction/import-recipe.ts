import { readSource, SourceReadError, type SourceDocument } from './fetch-source';
import { createImportBudget, type ImportBudget } from './import-budget';
import { importExtractionSchema, type ImportExtraction, type EditableRecipeDraft, type FormulaAlternative } from './import-schema';
import type { ExtractionProvider } from './provider';
import { discoverOriginal } from './discover-original';
import { matchRecipe } from './match-recipe';
export type ImportCandidate={ok:true;status:'complete'|'incomplete';draft:EditableRecipeDraft;missingFields:('ingredients'|'instructions')[];sourceUrl:string|null;originalRecipeUrl:string|null;imageUrl:string|null;message?:string;alternatives?:FormulaAlternative[];selectedAlternativeId?:string|null;alternativeBaseTitle?:string};
export type ImportResult=ImportCandidate&{replacementCandidate?:ImportCandidate};
export async function importRecipe(input:{source:string;captionDraft?:ImportExtraction;originalRecipeUrl?:string},provider:ExtractionProvider,budget:ImportBudget=createImportBudget()):Promise<ImportResult>{
 const analyze=async(doc:SourceDocument)=>importExtractionSchema.parse(await budget.runAI(timeoutMs=>provider.extract(doc.sourceUrl,doc.text,{mode:'import',timeoutMs})));
 let source:SourceDocument;
 // User-supplied prior drafts contain editable content, not authority to browse.
 // They are used only for manual original-link matching, after schema validation.
 if(input.captionDraft&&input.originalRecipeUrl)source={sourceUrl:/^https?:\/\//i.test(input.source)?input.source:null,imageUrl:null,text:'',page:null};
 else source=await readSource(input.source,budget);
 let caption:ImportExtraction;
 try{caption=input.captionDraft&&input.originalRecipeUrl?importExtractionSchema.parse(input.captionDraft):await analyze(source);}
 catch(error){if(error instanceof Error && error.name==='ZodError')throw new SourceReadError('No usable recipe ingredients were found. Paste the full caption or original recipe link.');throw error;}
 const result=(value:ImportExtraction,doc:SourceDocument,originalRecipeUrl:string|null):ImportCandidate=>{
  const {completeness,missingFields,alternatives,...draft}=value;
  return {ok:true,status:completeness,draft,missingFields,sourceUrl:source.sourceUrl,originalRecipeUrl,imageUrl:doc.imageUrl,...(alternatives?{alternatives,selectedAlternativeId:null,alternativeBaseTitle:value.title}:{})};
 };
 const partial=result(caption,source,source.originalRecipeUrl??null);
 if(caption.alternatives)return {...partial,message:'These are alternative formulas. Choose one to edit.'};
 if(caption.completeness==='complete'&&!input.originalRecipeUrl)return partial;
 try{
  const docs=input.originalRecipeUrl?[await readSource(input.originalRecipeUrl,budget)]:await discoverOriginal(source,caption.title,budget);
  const candidates:{doc:SourceDocument;recipe:ImportExtraction}[]=[];
  for(const doc of docs){const recipe=await analyze(doc);candidates.push({doc,recipe});}
  const matches=candidates.filter(c=>matchRecipe(caption,c.recipe).matches);
  if(matches.length===1){const c=matches[0];return {...result(c.recipe,c.doc,c.doc.sourceUrl),message:c.recipe.ingredients.length>caption.ingredients.length?'Full recipe found; review its additional ingredients.':'Full recipe found on the creator’s website.'};}
  if(input.originalRecipeUrl&&candidates.length===1&&candidates[0].recipe.completeness==='complete'){
   const c=candidates[0];return {...partial,message:'This page differs from the current draft. Review it before replacing your recipe.',replacementCandidate:result(c.recipe,c.doc,c.doc.sourceUrl)};
  }
  return {...partial,message:matches.length>1?'More than one original recipe matches. Add the exact recipe link.':'Ingredients found. Instructions are missing. Add the original recipe link or the missing steps.'};
 }catch{return {...partial,message:'The original recipe could not be verified. Your ingredients are retained; add the link or missing steps.'};}
}
