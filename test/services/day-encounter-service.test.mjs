import test from "node:test";
import assert from "node:assert/strict";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";
const handlers = new Map(), sent = [], messages = [], dialogs = [];
globalThis.foundry = { utils: { escapeHTML: value => value }, applications: { api: {
  ApplicationV2: class {}, HandlebarsApplicationMixin: base => base,
  DialogV2: class { constructor(options) { dialogs.push(options); } async render() {} async close() {} }
} } };
const { dayEncounterService } = await import("../../scripts/services/day-encounter-service.mjs");
let stored, rolled = 0, faces = 6, skip = false;
const gm = { id: "gm", isGM: true, active: true };
const users = [gm, ...Array.from({length:4}, (_,i)=>({id:"p"+i,isGM:false,active:true}))];
users.get = id => users.find(user => user.id === id);
const actors = users.slice(1).map((user,i)=>({uuid:"Actor."+i, name:"Traveler "+i,
  system:{skills:{prc:{passive:12}}}, testUserPermission: candidate => candidate.id === user.id}));
const channel = {
  on: (type, handler, options) => handlers.set(type, {handler, options}),
  executeAsUser: async (type, data, id) => {
    const senderUserId = game.user.id;
    if (type === "dayEncounter.request") { sent.push({data,id,senderUserId}); return; }
    const original = game.user; game.user = users.get(id);
    try { return await handlers.get(type).handler(data, {senderUserId}); }
    finally { game.user = original; }
  }
};
globalThis.game = { user: gm, users, modules: new Map(), settings: {
  get: (_module,key) => key === "activeJourney" ? stored : key === "dayEncounterDie" ? faces : key === "skipDiceAnimation" ? skip : undefined,
  set: async (_module,key,value) => { if(key === "activeJourney") stored=structuredClone(value); }
} };
globalThis.MorelordCore = {socket:{createChannel:()=>channel}};
globalThis.fromUuid = async uuid=>actors.find(actor=>actor.uuid===uuid);
globalThis.Roll = class {
  constructor(formula) {this.formula=formula;}
  async evaluate(options) {
    assert.equal(options.allowInteractive, false);
    assert.equal(this.formula,"1d6");
    rolled++;
    this.dice=[{results:[1].map(result=>({result,active:true}))}]; return this;
  }
  async toMessage(data,options) {messages.push({data,options});}
};
function reset(danger=4) {
  sent.length=messages.length=dialogs.length=0; rolled=0; game.user=gm; skip=false;
  const route=createRoute({id:"route",origin:{name:"A"},destination:{name:"B"},lengthSteps:3,danger});
  stored=createJourney({id:"journey",route,travelers:actors.map(actor=>({actorUuid:actor.uuid,name:actor.name}))});
  stored.phase="encounters";stored.dayNumber=1;stored.currentDay={pace:"normal"};
}
dayEncounterService.start();

test("players trigger four Danger-selected GM-only dice; duplicates and wrong users cannot resolve requests", async()=>{
  reset();
  await dayEncounterService.requestParty();
  assert.equal(sent.length,4);
  assert.equal(rolled,0,"GM requests do not roll for the players");
  assert.equal(stored.currentDay.encounterCheck,undefined);
  assert.equal(handlers.get("dayEncounter.roll").options.serialize,"morelord-journeys:journey-state");
  const first=sent[0].data.request;
  const rejected=await handlers.get("dayEncounter.roll").handler({requestId:first.id},{senderUserId:"p3"});
  assert.equal(rejected.accepted,false);
  assert.equal(rolled,0);
  for (const packet of sent) {
    game.user=users.get(packet.id);
    await handlers.get("dayEncounter.request").handler(packet.data,{senderUserId:"gm"});
    const dialog=dialogs.at(-1);
    assert.match(dialog.content,/Only the GM sees/);
    await dialog.buttons[0].callback();
  }
  game.user=gm;
  assert.equal(rolled,4);
  assert.equal(stored.currentDay.encounterCheck.totalRolls,4);
  assert.equal(stored.currentDay.encounterCheck.encounterCount,4);
  assert.equal(stored.currentDay.pendingDayEncounterRolls.length,0);
  assert.equal(messages.length,4);
  assert.ok(messages.every(message=>message.options.messageMode==="blind"));
  const stale=await handlers.get("dayEncounter.roll").handler({requestId:first.id},{senderUserId:"p0"});
  assert.equal(stale.accepted,false);
  assert.equal(rolled,4);
});
test("Danger zero requests one d20 per traveler; non-GMs cannot request checks", async()=>{
  reset(0);
  await dayEncounterService.requestParty();
  assert.equal(sent.length,4);
  assert.equal(rolled,0);
  assert.ok(sent.every(packet => packet.data.request.checks === 1 && packet.data.request.dieFaces === 20));
  game.user=users[1];
  await assert.rejects(dayEncounterService.requestParty(),/Only a GM/);
  game.user=gm;
});


test("resending uses the serialized GM channel and does not duplicate rolls", async () => {
  reset(); await dayEncounterService.requestParty();
  const request = sent[0].data.request;
  await dayEncounterService.resend(request.id);
  assert.equal(sent.length,5);
  assert.equal(sent.at(-1).data.request.id,request.id);
  assert.equal(stored.currentDay.pendingDayEncounterRolls.length,4);
  assert.equal(rolled,0);
  assert.equal(handlers.get("dayEncounter.resend").options.serialize,"morelord-journeys:journey-state");
  game.user=users[1];
  await assert.rejects(dayEncounterService.resend(request.id),/Only a GM/);
  game.user=gm;
});
