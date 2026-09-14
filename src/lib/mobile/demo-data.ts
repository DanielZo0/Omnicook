export type Aisle = 'Produce' | 'Dairy & chilled' | 'Pantry';

export type MobileIngredient = { amt: string; name: string; aisle: Aisle };

export type MobileRecipe = {
  id: string;
  t: string; // title
  c: string; // creator
  s: string; // source
  k: string; // category
  time: string;
  n: number; // servings
  img: string | null;
  sourceUrl: string | null;
  collectionId: string | null;
  a: MobileIngredient[]; // ingredients
  m: string[]; // steps
};

const IMG = [
  'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80',
];

export const DEMO_COLLECTIONS: { id: string; name: string }[] = [
  { id: 'c-weeknight', name: 'Weeknight' },
  { id: 'c-sweet', name: 'Sweet things' },
];

function ing(amt: string, name: string, aisle: Aisle): MobileIngredient { return { amt, name, aisle }; }

export const DEMO_RECIPES: MobileRecipe[] = [
  { id: 'd1', t: 'Creamy lemon pasta', c: '@cookingwithlia', s: 'Instagram', k: 'Dinner', time: '25 min', n: 2, img: IMG[0], sourceUrl: null, collectionId: 'c-weeknight',
    a: [ing('200g', 'spaghetti', 'Pantry'), ing('1', 'lemon', 'Produce'), ing('120ml', 'heavy cream', 'Dairy & chilled'), ing('45g', 'parmesan', 'Dairy & chilled')],
    m: ['Cook pasta in well-salted water until al dente.', 'Warm olive oil with lemon zest in a skillet.', 'Add cream and pasta water, then toss with pasta and parmesan.', 'Finish with lemon juice and black pepper.'] },
  { id: 'd2', t: 'Crispy chilli tofu bowls', c: '@theplantplate', s: 'TikTok', k: 'Dinner', time: '35 min', n: 2, img: IMG[1], sourceUrl: null, collectionId: 'c-weeknight',
    a: [ing('400g', 'firm tofu', 'Dairy & chilled'), ing('2 cups', 'jasmine rice', 'Pantry'), ing('1', 'cucumber', 'Produce'), ing('2 tbsp', 'chilli crisp', 'Pantry')],
    m: ['Press tofu for 15 minutes and cut into cubes.', 'Pan fry until crisp on all sides.', 'Toss with soy sauce and chilli crisp.', 'Serve over rice with sliced cucumber.'] },
  { id: 'd3', t: 'Weeknight vodka rigatoni', c: 'Not Another Cooking Show', s: 'YouTube', k: 'Dinner', time: '30 min', n: 4, img: IMG[2], sourceUrl: null, collectionId: 'c-weeknight',
    a: [ing('450g', 'rigatoni', 'Pantry'), ing('½ cup', 'vodka', 'Pantry'), ing('1 cup', 'tomato purée', 'Pantry'), ing('½ cup', 'cream', 'Dairy & chilled')],
    m: ['Cook pasta in salted water.', 'Bloom tomato paste with olive oil and chilli.', 'Deglaze with vodka, then add tomato and cream.', 'Toss with pasta and cheese.'] },
  { id: 'd4', t: 'Brown butter chocolate cookies', c: '@bakedbyme', s: 'Pinterest', k: 'Dessert', time: '40 min', n: 12, img: IMG[3], sourceUrl: null, collectionId: 'c-sweet',
    a: [ing('170g', 'butter', 'Dairy & chilled'), ing('180g', 'brown sugar', 'Pantry'), ing('1', 'egg', 'Dairy & chilled'), ing('220g', 'flour', 'Pantry')],
    m: ['Brown the butter and cool slightly.', 'Whisk with brown sugar and egg.', 'Fold in flour and chocolate.', 'Bake at 180°C for 10–12 minutes.'] },
];

export const CATEGORY_GLYPH: Record<string, string> = {
  Breakfast: '◷', Lunch: '◈', Dinner: '✦', Dessert: '✦', Snack: '◈', Other: '▦',
};
export const CATEGORY_BG: Record<string, string> = {
  Breakfast: '#fbf0d8', Lunch: '#eaf1e5', Dinner: '#eaf1e5', Dessert: '#fbf0d8', Snack: '#eef0e7', Other: '#f3eae6',
};
export const COLLECTION_PALETTE = ['#eaf1e5', '#fbf0d8', '#eef0e7', '#f3eae6'];
export const COLLECTION_GLYPHS = ['◈', '✦', '▦', '◷'];

export const FILTERS = ['All recipes', 'Instagram', 'TikTok', 'YouTube', 'Pinterest', 'Dinner', 'Dessert'];
export const GROUPS = ['All recipes', 'Under 30 min', 'Pasta night', 'Desserts', 'Instagram', 'TikTok'];

export function matchesFilter(recipe: { t: string; s: string; k: string; time: string }, filter: string): boolean {
  if (filter === 'All recipes') return true;
  if (filter === 'Under 30 min') return parseInt(recipe.time, 10) < 30;
  if (filter === 'Pasta night') return /pasta|rigatoni|bucatini|spaghetti/i.test(recipe.t);
  if (filter === 'Desserts') return recipe.k === 'Dessert';
  return recipe.s === filter || recipe.k === filter;
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const EXTRACT_STEPS = ['Reading the source', 'Parsing recipe details', 'Extracting ingredients', 'Extracting steps', 'Finalizing'];

export function scaleAmount(amount: string, servings: number): string {
  if (servings === 1) return amount;
  const n = parseFloat(amount);
  if (!n) return amount;
  const v = n * servings;
  return amount.replace(String(n), Number.isInteger(v) ? String(v) : v.toFixed(1));
}
