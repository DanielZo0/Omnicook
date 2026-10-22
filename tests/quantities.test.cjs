require('./register-ts.cjs');const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseQuantity,scaleQuantity,ingredientGrams}=require('../src/lib/nutrition/quantity.ts');
test('quantities retain fractions, both range ends and unknown text',()=>{
 for(const [x,y] of [['2–3','4–6'],['1/2','1'],['1 1/2','3'],['½','1'],['to taste','to taste']])assert.equal(scaleQuantity(x,2),y);
 assert.equal(scaleQuantity('1/2',1),'1/2');assert.equal(parseQuantity('2-3').max,3);assert.equal(parseQuantity('4/0'),null);assert.equal(parseQuantity('about 2'),null);assert.equal(parseQuantity('-2'),null);assert.notEqual(scaleQuantity('0.0001',2),'0');
});
test('food-specific portions are required for cups, and raw states cannot be guessed',()=>{
 assert.deepEqual(ingredientGrams('2','cup',{portions:[{unit:'cup',grams:120}]}),{min:240,max:240});
 assert.equal(ingredientGrams('2','cup',{portions:[]}),null);
 assert.deepEqual(ingredientGrams('1/2','kg',{portions:[]}),{min:500,max:500});
});
