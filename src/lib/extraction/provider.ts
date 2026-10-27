import { extractWithGroq } from './groq';
import { extractWithNvidia } from './nvidia';
import { extractWithXai } from './xai';
import { extractWithGemini } from './gemini';
import { importExtractionSchema } from './import-schema';
import { recipeSchema } from '../recipe-schema';
import type { ExtractionOptions } from './prompt';
import {inspectRatioEvidence,ratioFidelityIssues} from './ratio-evidence';
import {SourceReadError} from './fetch-source';

export type ExtractionProvider = {
  name: 'groq' | 'nvidia' | 'xai' | 'gemini';
  extract: (sourceUrl: string | null, text: string, options?: ExtractionOptions) => Promise<unknown>;
};

export function withValidationRepair(provider: ExtractionProvider): ExtractionProvider {
  return {...provider, extract: async (sourceUrl, text, options) => {
    const deadline = Date.now() + Math.min(40000, options?.timeoutMs ?? 40000);
    const evidence=options?.mode==='import'?inspectRatioEvidence(text):{kind:'none' as const,formulas:[]};
    const ratioError=()=>new SourceReadError('Ingredient ratios could not be preserved reliably. Paste the full caption or enter the formula manually.');
    // Ambiguous attribution cannot be repaired by asking a model to guess.
    if(evidence.kind==='ambiguous')throw ratioError();
    const raw = await provider.extract(sourceUrl, text, {...options, timeoutMs: Math.max(1, deadline - Date.now())});
    const parsed = (options?.mode === 'import' ? importExtractionSchema : recipeSchema).safeParse(raw);
    const fidelity=options?.mode==='import'&&parsed.success?ratioFidelityIssues(evidence,importExtractionSchema.parse(raw)):[];
    const refused = Boolean(raw && typeof raw === 'object' && 'error' in raw);
    const remaining = deadline - Date.now();
    const measured = new Set([...text.matchAll(/\b\d+(?:[.,/]\d+)?\s*(?:g|kg|ml|cups?|tbsp|tsp)\b[^\n]*/gi)].map(m=>m[0].trim().toLowerCase()));
    // Parts syntax is also used metaphorically. It cannot by itself overrule
    // the model's judgement that there are no usable food ingredients.
    const recipeContext=/\b(?:recipes?|ingredients?|ricett[ae]|ingredienti|recetas?|ingredientes|recettes?|ingrédients)\b/i.test(text);
    if(refused&&evidence.kind==='formulas'&&!recipeContext&&measured.size<3)return raw;
    const repairImportRefusal=refused&&options?.mode==='import'&&(measured.size>=3||evidence.kind==='formulas'&&recipeContext);
    if(parsed.success&&!fidelity.length)return raw;
    if((refused&&!repairImportRefusal)||remaining<5000){if(evidence.kind==='formulas')throw ratioError();return raw;}
    const validationFeedback = evidence.kind==='formulas'
      ? 'Verify these are food ingredient formulas, never metaphors or marketing. Preserve every explicit ingredient ratio, variant label and product qualifier. Use part units, not absolute amounts. Separate alternatives; never invent a method. Source ratio evidence: '+JSON.stringify(evidence.formulas)+'; '+fidelity.join('; ')
      : repairImportRefusal ? 'The source includes multiple measured ingredients. Missing instructions alone are not a reason to refuse in import mode. Preserve those source-backed ingredients with completeness=incomplete, missingFields=[instructions], steps=[] when no method is present. Never invent a method. If ingredients genuinely cannot be extracted, keep the refusal.'
      : parsed.success?'':parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    const repaired=await provider.extract(sourceUrl, text, {...options, timeoutMs: remaining, validationFeedback});
    if(evidence.kind==='formulas'){
      const value=importExtractionSchema.safeParse(repaired);
      if(!value.success||ratioFidelityIssues(evidence,value.data).length)throw ratioError();
    }
    return repaired;
  }};
}

/**
 * Groq's free tier is preferred since it works from a deployed server with
 * no paid credentials. NVIDIA (build.nvidia.com, also free-tier) and xAI are
 * fallbacks, then Gemini last. Returns null when none are configured, so the
 * route stays fail-closed.
 */
export function selectExtractionProvider(): ExtractionProvider | null {
  if (process.env.GROQ_API_KEY) return withValidationRepair({ name: 'groq', extract: extractWithGroq });
  if (process.env.NVIDIA_API_KEY) return withValidationRepair({ name: 'nvidia', extract: extractWithNvidia });
  if (process.env.XAI_API_KEY) return withValidationRepair({ name: 'xai', extract: extractWithXai });
  if (process.env.GEMINI_API_KEY) return withValidationRepair({ name: 'gemini', extract: extractWithGemini });
  return null;
}
