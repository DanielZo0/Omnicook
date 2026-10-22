import type { Range } from "./types";
const unicode: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};
function scalar(value: string): number | null {
  let s = value
    .trim()
    .replace(/,/g, ".")
    .replace(/(\d)([½⅓⅔¼¾⅛⅜⅝⅞])/g, "$1 $2")
    .replace(/[½⅓⅔¼¾⅛⅜⅝⅞]/g, (x) => unicode[x]);
  let n: number;
  const fraction = s.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    if (+fraction[3] === 0) return null;
    n = +(fraction[1] || 0) + +fraction[2] / +fraction[3];
  } else if (/^\d+(?:\.\d+)?$/.test(s)) n = Number(s);
  else return null;
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function parseQuantity(value: string | null): Range | null {
  if (!value) return null;
  const parts = value.trim().split(/\s*[-–—]\s*/);
  if (parts.length > 2) return null;
  const a = scalar(parts[0]),
    b = parts.length === 2 ? scalar(parts[1]) : a;
  return a === null || b === null || a > b ? null : { min: a, max: b };
}
function format(n: number): string {
  return n > 0 && n < 0.01
    ? String(Number(n.toPrecision(4)))
    : String(Number(n.toFixed(2)));
}
export function scaleQuantity(
  value: string | null,
  factor: number,
): string | null {
  if (factor === 1 || !Number.isFinite(factor) || factor <= 0) return value;
  const q = parseQuantity(value);
  if (!q) return value;
  return q.min === q.max
    ? format(q.min * factor)
    : `${format(q.min * factor)}–${format(q.max * factor)}`;
}
export function normalizeUnit(unit: string | null): string {
  const s = (unit || "").trim().toLowerCase().replace(/\.$/, "");
  const aliases: Record<string, string> = {
    grams: "g",
    gram: "g",
    kilograms: "kg",
    kilogram: "kg",
    milligrams: "mg",
    ounces: "oz",
    ounce: "oz",
    pounds: "lb",
    pound: "lb",
    cups: "cup",
    tablespoons: "tbsp",
    tablespoon: "tbsp",
    teaspoons: "tsp",
    teaspoon: "tsp",
    millilitres: "ml",
    milliliters: "ml",
    litres: "l",
    liters: "l",
  };
  return aliases[s] || s;
}
export function ingredientGrams(
  quantity: string | null,
  unit: string | null,
  food: { portions: { unit: string; grams: number }[] },
): Range | null {
  const q = parseQuantity(quantity);
  if (!q) return null;
  const u = normalizeUnit(unit);
  const mass: Record<string, number> = {
    g: 1,
    kg: 1000,
    mg: 0.001,
    oz: 28.349523125,
    lb: 453.59237,
  };
  const multiplier =
    mass[u] ?? food.portions.find((p) => normalizeUnit(p.unit) === u)?.grams;
  return multiplier === undefined
    ? null
    : { min: q.min * multiplier, max: q.max * multiplier };
}
