import type { PlannableRecipe, PlannerPreferences } from "./types";
const plants = [
  "oats",
  "rice",
  "quinoa",
  "barley",
  "rye",
  "wheat",
  "flour",
  "lentils",
  "chickpeas",
  "beans",
  "peas",
  "tofu",
  "tempeh",
  "almonds",
  "walnuts",
  "peanuts",
  "chia",
  "flaxseed",
  "sesame",
  "pumpkin seeds",
  "sunflower seeds",
  "broccoli",
  "spinach",
  "kale",
  "carrot",
  "tomato",
  "potato",
  "sweet potato",
  "onion",
  "garlic",
  "lemon",
  "lime",
  "apple",
  "banana",
  "berries",
  "blueberries",
  "strawberries",
  "raspberries",
  "cucumber",
  "lettuce",
  "cabbage",
  "pepper",
  "courgette",
  "aubergine",
  "mushroom",
  "avocado",
  "orange",
  "parsley",
  "basil",
  "coriander",
];
const animal = [
  "milk",
  "butter",
  "cream",
  "cheese",
  "parmesan",
  "yogurt",
  "yoghurt",
  "kefir",
  "egg",
  "eggs",
  "beef",
  "pork",
  "chicken",
  "turkey",
  "lamb",
  "fish",
  "salmon",
  "tuna",
  "shrimp",
  "prawns",
  "anchovies",
  "gelatin",
  "honey",
];
const plain = [
  ...plants,
  ...animal,
  "water",
  "salt",
  "black pepper",
  "olive oil",
  "sunflower oil",
  "sugar",
  "cinnamon",
  "cumin",
  "paprika",
  "turmeric",
  "ginger",
  "baking powder",
  "baking soda",
  "vanilla",
];
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
function contains(text: string, term: string) {
  return (" " + norm(text) + " ").includes(" " + norm(term) + " ");
}
export function foodFeatures(recipe: Pick<PlannableRecipe, "ingredients">) {
  return {
    plantFoods: plants.filter((p) =>
      recipe.ingredients.some((i) => contains(i.name, p)),
    ),
    fermentedFoods: [
      "yogurt",
      "yoghurt",
      "kefir",
      "kimchi",
      "sauerkraut",
      "tempeh",
    ].filter((p) => recipe.ingredients.some((i) => contains(i.name, p))),
  };
}
export function eligibleRecipe(
  recipe: PlannableRecipe,
  p: PlannerPreferences,
): boolean {
  const text = recipe.ingredients
    .map((i) => i.name + " " + (i.notes || ""))
    .join(" ");
  const aliases: Record<string, string[]> = {
    dairy: [
      "milk",
      "butter",
      "cream",
      "cheese",
      "parmesan",
      "yogurt",
      "yoghurt",
      "kefir",
    ],
    nuts: ["almonds", "walnuts", "peanuts", "cashews", "pistachios"],
    gluten: ["wheat", "flour", "barley", "rye", "pasta", "bread", "oats"],
    egg: ["egg", "eggs"],
    milk: [
      "milk",
      "butter",
      "cream",
      "cheese",
      "parmesan",
      "yogurt",
      "yoghurt",
      "kefir",
    ],
  };
  if (
    [...p.excludedIngredients, ...p.dislikedIngredients].some((x) =>
      (aliases[norm(x)] || [x]).some((t) => contains(text, t)),
    )
  )
    return false;
  if (p.dietaryPattern) {
    const excluded =
      p.dietaryPattern === "vegan"
        ? animal
        : animal.filter(
            (x) =>
              ![
                "milk",
                "butter",
                "cream",
                "cheese",
                "parmesan",
                "yogurt",
                "yoghurt",
                "kefir",
                "egg",
                "eggs",
                "honey",
              ].includes(x),
          );
    if (excluded.some((t) => contains(text, t))) return false;
  }
  // Only recognize single, plain foods when a hard exclusion is active. Sauces,
  // blends and unrecognized preparations cannot be declared compatible.
  if (p.excludedIngredients.length || p.dietaryPattern) {
    if (recipe.ingredients.some((i) => !plain.includes(norm(i.name))))
      return false;
  }
  if (
    p.maxPreparationMinutes !== null &&
    (recipe.prepMinutes === null ||
      recipe.cookMinutes === null ||
      recipe.prepMinutes + recipe.cookMinutes > p.maxPreparationMinutes)
  )
    return false;
  const targets =
    p.kcalTarget !== null ||
    p.proteinMinimumG !== null ||
    p.fibreMinimumG !== null;
  if (targets && (recipe.nutrition.status !== "complete" || !recipe.servings))
    return false;
  return true;
}
