require('./register-ts.cjs');
const {test}=require('node:test'), assert=require('node:assert/strict');

test('retains only the three fixed visited views, never dynamic detail routes',()=>{
 const {retainView}=require('../src/lib/mobile/navigation.ts');
 let cache={owner:'u',views:[]};
 for(const screen of ['vault','search','community',...Array.from({length:1000},(_,i)=>`recipe-${i}`),'detail','cook','profile']) cache=retainView(cache,'u',screen);
 assert.deepEqual(cache,{owner:'u',views:['vault','search','community']});
 assert.deepEqual(retainView(cache,'u','vault'),cache);
});

test('account changes evict all prior cached views immediately',()=>{
 const {retainView,retainedForOwner}=require('../src/lib/mobile/navigation.ts');
 const cache={owner:'alice',views:['vault','search','community']};
 assert.deepEqual(retainedForOwner(cache,'bob'),[]);
 assert.deepEqual(retainView(cache,'bob','search'),{owner:'bob',views:['search']});
 assert.deepEqual(retainView(cache,'guest','detail'),{owner:'guest',views:[]});
});

test('recipe returns preserve supported origins and normalize editor/cooking origins',()=>{
 const {recipeReturnScreen,recipeReturnLabel}=require('../src/lib/mobile/navigation.ts');
 for(const screen of ['vault','search','community','planner','grocery']) assert.equal(recipeReturnScreen(screen),screen);
 for(const screen of ['detail','cook','review','edit']) assert.equal(recipeReturnScreen(screen),'vault');
 assert.equal(recipeReturnLabel('search'),'Back to search');
 assert.equal(recipeReturnLabel('planner'),'Back to meal plan');
});
