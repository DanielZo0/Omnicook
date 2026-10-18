import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, getTableColumns, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { recipes, recipeIngredients, recipeSteps } from '../db/schema';
import { resolveAutomaticPhoto } from './automatic';
export { photoNeedsWork } from './policy';

// Vault queries never transfer base64 image bytes. Photos have a separate,
// authenticated endpoint and are deliberately small (<256 KB per recipe).
const {photoData: _photoData, ...columns} = getTableColumns(recipes);
export const recipeSummaryColumns = {...columns, hasPhoto:sql<boolean>`${recipes.photoData} IS NOT NULL`};
export function photosEnabled() {return process.env.RECIPE_PHOTOS_ENABLED !== 'false';}
export async function ensureRecipePhoto(id:string, userId:string) {
  if (!photosEnabled()) return;
  const token=randomUUID();
  const startedAt=new Date();
  // Claim once in the DB, including recovery of interrupted/stale jobs.
  const [recipe]=await db().update(recipes).set({photoMetadata:sql`jsonb_build_object('kind',NULL,'status','pending','token',${token}::text,'startedAt',${startedAt.toISOString()}::text,'attempts',COALESCE((${recipes.photoMetadata}->>'attempts')::int,0)+1)`,updatedAt:startedAt}).where(and(
    eq(recipes.id,id),eq(recipes.userId,userId),
    or(isNull(recipes.photoMetadata),sql`${recipes.photoMetadata}->>'status' = 'pending' AND (${recipes.photoMetadata}->>'startedAt')::timestamptz < NOW() - INTERVAL '2 minutes'`,sql`${recipes.photoMetadata}->>'status' = 'unavailable' AND COALESCE((${recipes.photoMetadata}->>'attempts')::int,1) < 3 AND (${recipes.photoMetadata}->>'retryAfter')::timestamptz <= NOW()`),
  )).returning(recipeSummaryColumns);
  if(!recipe) return;
  const attempts=recipe.photoMetadata?.attempts ?? 1;
  const unavailable={kind:null,status:'unavailable',attempts,retryAfter:new Date(Date.now()+86_400_000).toISOString()} as const;
  try {
    const [ingredients,steps]=await Promise.all([
      db().select({name:recipeIngredients.name}).from(recipeIngredients).where(eq(recipeIngredients.recipeId,id)).orderBy(recipeIngredients.position),
      db().select({instruction:recipeSteps.instruction}).from(recipeSteps).where(eq(recipeSteps.recipeId,id)).orderBy(recipeSteps.position),
    ]);
    const photo=await resolveAutomaticPhoto({title:recipe.title,ingredients,steps},recipe.imageUrl);
    // An upload or recipe edit may have happened while providers were running.
    // Never replace it, and never revive a recipe that has been deleted.
    await db().update(recipes).set({
      photoData:photo?.data.toString('base64') ?? null,
      photoMetadata:photo ? {...photo.metadata,attempts} : unavailable,
      updatedAt:new Date(),
    }).where(and(eq(recipes.id,id),eq(recipes.userId,userId),eq(recipes.updatedAt,recipe.updatedAt),sql`${recipes.photoMetadata}->>'token' = ${token}`));
  } catch (error) {
    console.warn('Recipe photo job failed',error instanceof Error ? error.name : 'unknown');
    await db().update(recipes).set({photoMetadata:unavailable})
      .where(and(eq(recipes.id,id),eq(recipes.userId,userId),sql`${recipes.photoMetadata}->>'token' = ${token}`));
  }
}
