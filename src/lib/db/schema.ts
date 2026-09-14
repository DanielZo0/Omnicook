import { pgEnum, pgTable, integer, numeric, text, timestamp, uniqueIndex, uuid, varchar, date } from 'drizzle-orm/pg-core';

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

export const mealPlanItems = pgTable('meal_plan_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  recipeId: uuid('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  plannedFor: date('planned_for').notNull(),
  mealSlot: varchar('meal_slot', { length: 20 }).notNull().default('dinner'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('meal_plan_items_user_day_slot_idx').on(table.userId, table.plannedFor, table.mealSlot),
]);
