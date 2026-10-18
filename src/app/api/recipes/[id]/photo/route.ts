import { NextResponse } from 'next/server';
import { and,eq } from 'drizzle-orm';
import { z } from 'zod';
import { db,isDbConfigured } from '@/lib/db/client';
import { recipes } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { normalizePhoto,MAX_PHOTO_INPUT } from '@/lib/photos/normalize';
import { readBounded } from '@/lib/photos/network';

type Context={params:Promise<{id:string}>};
async function ownedRecipe(context:Context) {
  if(!isDbConfigured()) return {error:NextResponse.json({ok:false,message:'Database unavailable.'},{status:503})};
  const userId=await requireUserId();
  if(!userId) return {error:NextResponse.json({ok:false,message:'Sign in required.'},{status:401})};
  const {id}=await context.params;
  if(!z.uuid().safeParse(id).success) return {error:NextResponse.json({ok:false,message:'Recipe not found.'},{status:404})};
  const [recipe]=await db().select({id:recipes.id,photoData:recipes.photoData}).from(recipes).where(and(eq(recipes.id,id),eq(recipes.userId,userId)));
  if(!recipe) return {error:NextResponse.json({ok:false,message:'Recipe not found.'},{status:404})};
  return {recipe,userId};
}
export async function GET(_request:Request,context:Context) {
  const result=await ownedRecipe(context);
  if(result.error)return result.error;
  if(!result.recipe!.photoData)return new Response(null,{status:404});
  return new Response(new Uint8Array(Buffer.from(result.recipe!.photoData,'base64')),{headers:{
    'Content-Type':'image/webp','Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff',
  }});
}
export async function POST(request:Request,context:Context) {
  const result=await ownedRecipe(context);
  if(result.error)return result.error;
  const origin=request.headers.get('origin');
  // Next's internal request URL can use localhost while the actual browser
  // origin uses 127.0.0.1 (or the public reverse-proxy hostname).
  if(origin && new URL(origin).host!==(request.headers.get('host') || new URL(request.url).host)) return NextResponse.json({ok:false,message:'Upload from Omnicook.'},{status:403});
  if(!/^image\/(?:jpeg|png|webp|avif|heic|heif)(?:;|$)/i.test(request.headers.get('content-type') || '')) {
    return NextResponse.json({ok:false,message:'Choose a JPEG, PNG, WebP or AVIF photo.'},{status:400});
  }
  try {
    const input=await readBounded(new Response(request.body,{headers:request.headers}),MAX_PHOTO_INPUT);
    const data=await normalizePhoto(input);
    const updatedAt=new Date();
    const [saved]=await db().update(recipes).set({photoData:data.toString('base64'),photoMetadata:{kind:'user',status:'ready'},imageUrl:null,updatedAt})
      .where(and(eq(recipes.id,result.recipe!.id),eq(recipes.userId,result.userId!))).returning({id:recipes.id});
    if(!saved)return NextResponse.json({ok:false,message:'Recipe not found.'},{status:404});
    return NextResponse.json({ok:true,imageUrl:`/api/recipes/${saved.id}/photo?v=${updatedAt.getTime()}`});
  } catch(error) {
    return NextResponse.json({ok:false,message:error instanceof Error ? error.message : 'Could not upload photo.'},{status:400});
  }
}
