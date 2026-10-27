require('./register-ts.cjs');const {test}=require('node:test'),assert=require('node:assert/strict');const {buildShoppingList}=require('../src/lib/shopping/build-list.ts');
const meal=(unit='g',quantity='200',servings=1,yieldN=1)=>({id:Math.random().toString(),servings,recipe:{title:'Bread',servings:yieldN,ingredients:[{name:' Flour ',quantity,unit,notes:null,aisle:'Pantry'}]}});
test('shopping counts each occurrence, merges compatible units and preserves unknown contributions',()=>{
 const rows=buildShoppingList([meal(),meal('grams'),meal('cup','1')]);assert.equal(rows.length,1);assert.equal(rows[0].amounts.length,2);assert.equal(rows[0].amounts[0].quantity,'400');assert.equal(rows[0].contributions.length,3);
 assert.ok(buildShoppingList([meal('g','200',1,null)])[0].amounts[0].unknownYield);
 assert.equal(buildShoppingList([meal('g',null)])[0].amounts[0].quantity,null);
});

test('parts stay separate relative contributions even with a serving count',()=>{const rows=buildShoppingList([meal('part','1',2,1),meal('part','1',1,1)]);assert.equal(rows[0].amounts.length,2);assert.equal(rows[0].amounts[0].quantity,'1');assert.equal(rows[0].amounts[0].unknownYield,true);});
