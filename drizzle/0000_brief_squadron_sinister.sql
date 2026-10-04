CREATE TYPE "public"."grocery_aisle" AS ENUM('Produce', 'Dairy & chilled', 'Pantry');--> statement-breakpoint
CREATE TYPE "public"."recipe_category" AS ENUM('Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Other');--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(60) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recipe_id" uuid NOT NULL,
	"planned_for" date NOT NULL,
	"meal_slot" varchar(20) DEFAULT 'dinner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"quantity" text,
	"unit" text,
	"name" text NOT NULL,
	"notes" text,
	"aisle" "grocery_aisle" DEFAULT 'Pantry' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"instruction" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(180) NOT NULL,
	"creator" text,
	"source_url" text,
	"image_url" text,
	"category" "recipe_category" DEFAULT 'Other' NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"servings" numeric,
	"collection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seeded_users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"seeded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_id_name_idx" ON "collections" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plan_items_user_day_slot_idx" ON "meal_plan_items" USING btree ("user_id","planned_for","meal_slot");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_ingredients_recipe_id_position_idx" ON "recipe_ingredients" USING btree ("recipe_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_steps_recipe_id_position_idx" ON "recipe_steps" USING btree ("recipe_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_user_id_created_at_idx" ON "recipes" USING btree ("user_id","created_at");