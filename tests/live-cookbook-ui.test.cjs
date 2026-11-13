require('./register-ts.cjs');
const {test}=require('node:test'), assert=require('node:assert/strict');
const {scaleAmount}=require('../src/lib/mobile/demo-data.ts');
const {vaultToMobile}=require('../src/lib/mobile/adapters.ts');
const {mobileToPlannable}=require('../src/lib/planner/mobile.ts');
const {buildShoppingList}=require('../src/lib/shopping/build-list.ts');
const saved={id:'r',title:'Saved recipe',creator:null,sourceUrl:null,imageUrl:null,category:'Dinner',prepMinutes:null,cookMinutes:null,servings:4,createdAt:'2026-11-13',collectionId:null,ingredients:[{position:0,quantity:'2—3',unit:null,name:'tomatoes',notes:null,aisle:'Produce'},{position:1,quantity:'½',unit:'cup',name:'rice',notes:null,aisle:'Pantry'}],steps:[{position:0,instruction:'Cook.'}]};

test('actual vault detail and cooking agree with Shopping on em-dash ranges and fractions',()=>{
 const mobile=vaultToMobile(saved), recipe=mobileToPlannable(mobile);
 const rows=buildShoppingList([{id:'m',servings:8,recipe}]);
 assert.equal(scaleAmount(mobile.a[0].amt,2),rows[0].amounts[0].quantity);
 assert.equal(scaleAmount(mobile.a[1].amt,2),'1 cup');
 assert.equal(rows[0].amounts[0].quantity,'4–6');
});

test('unknown recipe yield never displays a made-up one serving',()=>{
 const {servingLabel}=require('../src/lib/mobile/demo-data.ts');
 const mobile=vaultToMobile({...saved,servings:null});
 assert.equal(servingLabel(mobile),'Servings not set');
 assert.equal(servingLabel(mobile,2),'Servings not set');
 assert.equal(mobileToPlannable(mobile).servings,null);
});

test('entered base yield remains consistent in cards, cooking and planning',()=>{
 const {servingLabel}=require('../src/lib/mobile/demo-data.ts');
 const mobile=vaultToMobile({...saved,servings:2,prepMinutes:10,cookMinutes:25});
 assert.equal(servingLabel(mobile,2),'4 servings');
 assert.equal(mobile.time,'35 min');
 const rows=buildShoppingList([{id:'m',servings:4,recipe:mobileToPlannable(mobile)}]);
 assert.equal(rows[0].amounts[0].quantity,'4–6');
});

test('recipes without a source are labelled neutrally and unknown time stays unknown',()=>{
 const mobile=vaultToMobile(saved);
 assert.equal(mobile.s,'Saved recipe');
 assert.equal(mobile.time,'Time not set');
 assert.equal(vaultToMobile({...saved,sourceUrl:'https://example.com/recipe'}).s,'example.com');
});

test('explicit zero-minute times remain distinct from unknown time',()=>{
 assert.equal(vaultToMobile({...saved,prepMinutes:0,cookMinutes:0}).time,'0 min');
 assert.equal(vaultToMobile(saved).time,'Time not set');
});

test('background cookbook updates never supersede an active planner operation',()=>{
 const {shouldRefreshCookbook,responseIsCurrent}=require('../src/lib/planner/ui-state.ts');
 const old=[saved], updated=[{...saved,imageUrl:'/photo.webp'}];
 const stamp={owner:'u',request:1}, mutation={...stamp};
 if(shouldRefreshCookbook(old,updated,true)) stamp.request++;
 assert.equal(responseIsCurrent(mutation,stamp),true);
 assert.equal(shouldRefreshCookbook(old,updated,false),true);
 assert.equal(shouldRefreshCookbook(old,old,false),false);
});
