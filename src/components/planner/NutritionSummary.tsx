import type { DaySummary } from "@/lib/nutrition/targets";
import type { Range } from "@/lib/nutrition/types";
export function nutritionText(n: Range | null, unit = "") {
  if (!n) return "Unknown";
  const a = Math.round(n.min),
    b = Math.round(n.max);
  return `${a === b ? a : `${a}–${b}`}${unit}`;
}
export function NutritionSummary({ summary }: { summary: DaySummary }) {
  return (
    <div className="nutrition-summary">
      <div>
        <span>Estimated calories</span>
        <strong>{nutritionText(summary.nutrients.kcal, " kcal")}</strong>
      </div>
      <div>
        <span>Protein</span>
        <strong>{nutritionText(summary.nutrients.proteinG, " g")}</strong>
      </div>
      <div>
        <span>Fibre</span>
        <strong>{nutritionText(summary.nutrients.fibreG, " g")}</strong>
      </div>
      <p>
        {summary.targetsMet
          ? "Planned meals meet your selected targets."
          : summary.complete
            ? "Estimates for planned meals; review against your targets."
            : "Some nutrition is unavailable. Unknown amounts are not counted as zero."}
      </p>
    </div>
  );
}
