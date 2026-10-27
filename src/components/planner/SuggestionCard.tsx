import type {PlannableRecipe} from '@/lib/planner/types';
import {RecipeImage} from '../RecipeImage';
import {foodFeatures} from '@/lib/planner/foods';
import {nutritionText} from './NutritionSummary';
export function SuggestionCard({recipe,servings}:{recipe:PlannableRecipe;servings:number}){
 const ref=recipe.source.kind==='suggestion'?recipe.source.ref:null;
 const traits=foodFeatures(recipe),factor=recipe.servings?servings/recipe.servings:null;
 const kcal=recipe.nutrition.nutrients.kcal;
 const energy=kcal&&factor?{min:kcal.min*factor,max:kcal.max*factor}:null;
 return <article className="planner-suggestion-card">{recipe.imageUrl&&<RecipeImage src={recipe.imageUrl} alt=""/>}<div><span className="planner-muted">New suggestion</span><strong>{recipe.title}</strong><p>{recipe.prepMinutes!==null&&recipe.cookMinutes!==null?`${recipe.prepMinutes+recipe.cookMinutes} min`:'Preparation time unknown'} · {nutritionText(energy,' kcal')}</p><p>{traits.plantFoods.length?`Includes ${traits.plantFoods.slice(0,3).join(', ')}.`:'Adds another recipe option.'}{traits.fermentedFoods.length?' Includes a fermented-food option.':''}</p>{recipe.nutrition.status!=='complete'&&<p>Nutrition or yield needs review before this can meet nutrient targets.</p>}{ref&&<a href={ref.sourceUrl} target="_blank" rel="noopener noreferrer">{ref.attribution}</a>}</div></article>;
}
