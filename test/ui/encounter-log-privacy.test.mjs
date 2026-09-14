import test from 'node:test';
import assert from 'node:assert/strict';
import {createJourney} from '../../scripts/domain/journey.mjs';
import {createRoute} from '../../scripts/domain/route.mjs';
globalThis.foundry={applications:{api:{ApplicationV2:class {async _prepareContext(){return {}}},HandlebarsApplicationMixin:Base=>Base}}};
const {JourneyApplication}=await import('../../scripts/apps/journey-app.mjs');
test('the encounter log keeps counts private and daily ratings remain reviewable',async()=>{
 const journey={...createJourney({id:'test',route:createRoute({id:'route',origin:{name:'A'},destination:{name:'B'},lengthSteps:12})}),routeSnapshot:createRoute({id:'route',origin:{name:'A'},destination:{name:'B'},lengthSteps:12}),remainingSteps:9,progressSteps:3,phase:'dayComplete',travelers:[],log:[{type:'dayStarted',data:{routeRatings:{danger:4,discoveryDC:15,resourcesDC:20,navigationDC:10}}},{type:'phaseRecorded',data:{phase:'encounters',result:{count:7}}}]};
 globalThis.game={user:{isGM:true},settings:{get:()=>journey},i18n:{localize:key=>key}};
 const app=new JourneyApplication();
 const gm=await app._prepareContext({});
 game.user.isGM=false;
 const player=await app._prepareContext({});
 assert.ok(JSON.stringify(gm).includes('7 encounter(s)'));
 assert.ok(!JSON.stringify(player).includes('7 encounter(s)'));
 assert.ok(JSON.stringify(player).includes('Resolved privately by the GM'));
 assert.ok(JSON.stringify(gm).includes('Danger 4; Discovery DC 15; Resources DC 20; Navigation DC 10'));
});
