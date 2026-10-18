require('./register-ts.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {resolveInitialScreen}=fs.existsSync('src/lib/auth/startup.ts') ? require('../src/lib/auth/startup.ts') : {};

test('returning from sign-in opens the vault even without an onboarding preference',()=>{
 assert.equal(typeof resolveInitialScreen,'function');
 assert.equal(resolveInitialScreen({sessionLoading:false,signedIn:true,hasSeenOnboarding:false}),'vault');
});
test('startup waits for the session instead of sending an OAuth return to onboarding',()=>{
 assert.equal(typeof resolveInitialScreen,'function');
 assert.equal(resolveInitialScreen({sessionLoading:true,signedIn:false,hasSeenOnboarding:false}),null);
});
test('a new signed-out visitor can still see onboarding',()=>{
 assert.equal(typeof resolveInitialScreen,'function');
 assert.equal(resolveInitialScreen({sessionLoading:false,signedIn:false,hasSeenOnboarding:false}),'onboarding');
});
test('a returning signed-out visitor can still browse the preview',()=>{
 assert.equal(typeof resolveInitialScreen,'function');
 assert.equal(resolveInitialScreen({sessionLoading:false,signedIn:false,hasSeenOnboarding:true}),'vault');
});
test('Google sign-in resumed on the intro moves into the vault',()=>{
 assert.equal(resolveInitialScreen({sessionLoading:false,signedIn:true,hasSeenOnboarding:false,currentScreen:'onboarding'}),'vault');
});
test('foreground session checks do not navigate away from an active recipe editor',()=>{
 assert.equal(resolveInitialScreen({sessionLoading:false,signedIn:true,hasSeenOnboarding:true,currentScreen:'edit'}),null);
});
