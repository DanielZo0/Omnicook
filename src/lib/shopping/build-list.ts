import type { StructuredIngredient } from "../planner/types";
import {
  normalizeUnit,
  parseQuantity,
  scaleQuantity,
} from "../nutrition/quantity";
export type ShoppingRow = {
  name: string;
  aisle: string;
  amounts: {
    quantity: string | null;
    unit: string;
    notes: string | null;
    unknownYield: boolean;
  }[];
  contributions: { mealId: string; recipeTitle: string }[];
};
export function buildShoppingList(
  entries: {
    id: string;
    servings: number;
    recipe?: {
      title: string;
      servings: number | null;
      ingredients: StructuredIngredient[];
    };
  }[],
): ShoppingRow[] {
  const rows = new Map<string, ShoppingRow>();
  for (const entry of entries) {
    const r = entry.recipe;
    if (!r) continue;
    for (const i of r.ingredients) {
      const key = i.name.trim().toLowerCase().replace(/\s+/g, " ");
      let row = rows.get(key);
      if (!row) {
        row = {
          name: i.name.trim(),
          aisle: i.aisle,
          amounts: [],
          contributions: [],
        };
        rows.set(key, row);
      }
      const relative = /^(?:part|parts|parte|parti)$/.test(normalizeUnit(i.unit));
      const quantity = relative ? i.quantity : scaleQuantity(
          i.quantity,
          r.servings ? entry.servings / r.servings : 1,
        ),
        unit = normalizeUnit(i.unit),
        unknownYield = !r.servings || relative;
      const q = parseQuantity(quantity),
        same = row.amounts.find(
          (a) =>
            a.unit === unit &&
            a.notes === i.notes &&
            !a.unknownYield &&
            !unknownYield &&
            parseQuantity(a.quantity) &&
            q,
        );
      if (same && q) {
        const old = parseQuantity(same.quantity)!;
        const lo = old.min + q.min,
          hi = old.max + q.max;
        same.quantity =
          lo === hi
            ? String(Number(lo.toPrecision(12)))
            : `${Number(lo.toPrecision(12))}–${Number(hi.toPrecision(12))}`;
      } else row.amounts.push({ quantity, unit, notes: i.notes, unknownYield });
      row.contributions.push({ mealId: entry.id, recipeTitle: r.title });
    }
  }
  return [...rows.values()];
}
