import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SourceReadError } from '@/lib/extraction/fetch-source';
import { selectExtractionProvider } from '@/lib/extraction/provider';
import { ExtractionProviderError } from '@/lib/extraction/errors';
import { importExtractionSchema } from '@/lib/extraction/import-schema';
import {sourceLinkSchema} from '@/lib/recipes/source-links';
import { importRecipe } from '@/lib/extraction/import-recipe';
const importRequestSchema=z.object({source:z.string().trim().min(4).max(20000),captionDraft:importExtractionSchema.optional(),originalRecipeUrl:sourceLinkSchema.optional()});
export const maxDuration=60;
export async function POST(request:Request){
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({ok:false,message:'Paste a recipe URL or caption first.'},{status:400});}
 const parsed=importRequestSchema.safeParse(body);
 if(!parsed.success)return NextResponse.json({ok:false,message:'Paste a valid recipe URL or caption.'},{status:400});
 const provider=selectExtractionProvider();
 if(!provider)return NextResponse.json({ok:false,message:'AI import is not configured yet. Add GROQ_API_KEY (or GEMINI_API_KEY) in the server environment to enable it.'},{status:503});
 try{return NextResponse.json(await importRecipe(parsed.data,provider));}
 catch(error){return NextResponse.json({ok:false,message:error instanceof SourceReadError||error instanceof ExtractionProviderError?error.message:'The extraction provider failed unexpectedly. Try the full caption or original link.'},{status:error instanceof SourceReadError?422:502});}
}
