import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.foundry={applications:{api:{ApplicationV2:class {},HandlebarsApplicationMixin:Base=>Base}}};
const {JourneySettingsApplication}=await import('../../scripts/apps/journey-settings-app.mjs');
test('Journey settings save the selected die and reject invalid dice before writing',async()=>{
 const writes=[];let closed=false,faces='12';
 globalThis.game={user:{isGM:true},settings:{get:()=>undefined,set:async(module,key,value)=>writes.push({module,key,value})}};
 globalThis.ui={notifications:{info(){}}};
 const app={element:{querySelector:selector=>selector==='[name="dayEncounterDie"]'?{value:faces}:null},close:async()=>{closed=true}};
 const target={disabled:false};
 await JourneySettingsApplication.save.call(app,{preventDefault(){}},target);
 assert.equal(writes.find(w=>w.key==='dayEncounterDie').value,12);
 assert.ok(writes.every(w=>typeof w.key==='string'));
 assert.equal(closed,true);assert.equal(target.disabled,false);
 writes.length=0;faces='3';
 await assert.rejects(JourneySettingsApplication.save.call(app,{preventDefault(){}},target),/supported daytime encounter die/);
 assert.equal(writes.length,0);assert.equal(target.disabled,false);
});
