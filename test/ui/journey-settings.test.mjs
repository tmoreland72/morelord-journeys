import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.foundry={applications:{api:{ApplicationV2:class {},HandlebarsApplicationMixin:Base=>Base}}};
const {JourneySettingsApplication}=await import('../../scripts/apps/journey-settings-app.mjs');
test('encounter settings save frequency, reject invalid frequency, and leave legacy die settings intact',async()=>{
 const writes=[];let interval='1';
 globalThis.game={user:{isGM:true},settings:{get:()=>undefined,set:async(module,key,value)=>writes.push({key,value})}};
 globalThis.ui={notifications:{info(){}}};
 const app={element:{querySelector:selector=>selector==='[name="nightCheckIntervalHours"]'?{value:interval}:null},close:async()=>{}};
 const target={disabled:false};
 await JourneySettingsApplication.save.call(app,{preventDefault(){}},target);
 assert.equal(writes.find(w=>w.key==='nightCheckIntervalHours').value,1);
 assert.ok(!writes.some(w=>['dayEncounterDie','nightEncounterConfiguration'].includes(w.key)));
 writes.length=0;interval='3';
 await assert.rejects(JourneySettingsApplication.save.call(app,{preventDefault(){}},target),/hourly or per-watch/);
 assert.equal(writes.length,0);assert.equal(target.disabled,false);
 game.user.isGM=false;
 await assert.rejects(JourneySettingsApplication.save.call(app,{preventDefault(){}},target),/Only the GM/);
});
