import { pgEnum, pgTable, integer, numeric, text, timestamp, uniqueIndex, uuid, varchar, date, jsonb, boolean, primaryKey, check } from 'drizzle-orm/pg-core';
import {sql} from 'drizzle-orm';
import type { PhotoMetadata } from '../photos/types';

export const recipeCategoryEnum = pgEnum('recipe_category', ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Other']);
export const groceryAisleEnum = pgEnum('grocery_aisle', ['Produce', 'Dairy & chilled', 'Pantry']);

export const collections = pgTable('collections', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  name: varchar('name', { length: 60 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('collections_user_id_name_idx').on(table.userId, table.name),
]);

export const recipes = pgTable('recipes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  title: varchar('title', { length: 180 }).notNull(),
  creator: text('creator'),
  sourceUrl: text('source_url'),
  originalRecipeUrl: text('original_recipe_url'),
  imageUrl: text('image_url'),
  photoData: text('photo_data'),
  photoMetadata: jsonb('photo_metadata').$type<PhotoMetadata>(),
  category: recipeCategoryEnum('category').notNull().default('Other'),
  prepMinutes: integer('prep_minutes'),
  cookMinutes: integer('cook_minutes'),
  servings: numeric('servings'),
  collectionId: uuid('collection_id').references(() => collections.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('recipes_user_id_created_at_idx').on(table.userId, table.createdAt),
]);

export const recipeIngredients = pgTable('recipe_ingredients', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  quantity: text('quantity'),
  unit: text('unit'),
  name: text('name').notNull(),
  notes: text('notes'),
  aisle: groceryAisleEnum('aisle').notNull().default('Pantry'),
}, (table) => [
  uniqueIndex('recipe_ingredients_recipe_id_position_idx').on(table.recipeId, table.position),
]);

export const recipeSteps = pgTable('recipe_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  instruction: text('instruction').notNull(),
}, (table) => [
  uniqueIndex('recipe_steps_recipe_id_position_idx').on(table.recipeId, table.position),
]);

export const seededUsers = pgTable('seeded_users', {
  userId: text('user_id').primaryKey(),
  seededAt: timestamp('seeded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const plannerSnapshots = pgTable('planner_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  recipe: jsonb('recipe').notNull(),
  savedRecipeId: uuid('saved_recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mealPlanItems = pgTable('meal_plan_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  recipeId: uuid('recipe_id').references(() => recipes.id, { onDelete: 'cascade' }),
  snapshotId: uuid('snapshot_id').references(() => plannerSnapshots.id),
  servings: numeric('servings').notNull().default('1'),
  locked: boolean('locked').notNull().default(true),
  version: integer('version').notNull().default(1),
  plannedFor: date('planned_for').notNull(),
  mealSlot: varchar('meal_slot', { length: 20 }).notNull().default('dinner'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('meal_plan_items_user_day_slot_idx').on(table.userId, table.plannedFor, table.mealSlot),
  check('meal_plan_source_one',sql`(${table.recipeId} IS NOT NULL)::int + (${table.snapshotId} IS NOT NULL)::int = 1`),
]);

export const plannerState=pgTable('planner_state',{
 userId:text('user_id').primaryKey(),revision:integer('revision').notNull().default(0),preferences:jsonb('preferences').notNull().default({}),
});
export const nutritionAnalyses=pgTable('nutrition_analyses',{
 id:uuid('id').defaultRandom().primaryKey(),userId:text('user_id').notNull(),recipeId:uuid('recipe_id').notNull().references(()=>recipes.id,{onDelete:'cascade'}),fingerprint:text('fingerprint').notNull(),providerKey:text('provider_key').notNull(),analysis:jsonb('analysis').notNull(),matches:jsonb('matches').notNull().default({}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[uniqueIndex('nutrition_analyses_owner_recipe_fingerprint_provider').on(t.userId,t.recipeId,t.fingerprint,t.providerKey)]);
export const nutrientFoodCache=pgTable('nutrient_food_cache',{
 providerId:text('provider_id').notNull(),externalId:text('external_id').notNull(),normalizationVersion:text('normalization_version').notNull(),record:jsonb('record').notNull(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
},t=>[primaryKey({columns:[t.providerId,t.externalId,t.normalizationVersion]})]);
export const plannerGenerations=pgTable('planner_generations',{
 id:uuid('id').primaryKey(),userId:text('user_id').notNull(),draft:jsonb('draft').notNull(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
});
export const plannerApplications=pgTable('planner_applications',{
 userId:text('user_id').notNull(),idempotencyKey:uuid('idempotency_key').notNull(),generationId:uuid('generation_id').notNull(),result:jsonb('result').notNull(),
},t=>[primaryKey({columns:[t.userId,t.idempotencyKey]})]);
export const plannerProviderBudgets=pgTable('planner_provider_budgets',{
 budgetKey:text('budget_key').primaryKey(),used:integer('used').notNull(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
});
