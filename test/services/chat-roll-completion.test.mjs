import test from "node:test";
import assert from "node:assert/strict";
import { ContextualSocketService } from "../../../morelord-core/scripts/services/contextual-socket-service.js";
import { createJourney } from "../../scripts/domain/journey.mjs";
import { createRoute } from "../../scripts/domain/route.mjs";
import { saveActiveJourney } from "../../scripts/foundry/settings-repository.mjs";
import { registerJourneyChatRoll } from "../../scripts/services/chat-roll-service.mjs";

test("pending dice survive recovery and out-of-order animation completion without rerolls or lost results", async () => {
  globalThis.foundry={applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:Base=>Base}}};
  const gm={id:"gm",isGM:true,active:true}, users=[gm];users.get=id=>users.find(user=>user.id===id);
  const messages=[];messages.get=id=>messages.find(message=>message.id===id);
  const actors=[{id:"a",uuid:"Actor.a"},{id:"b",uuid:"Actor.b"}];
  let stored=createJourney({id:"journey",route:createRoute({id:"route",origin:{name:"A"},destination:{name:"B"},lengthSteps:3}),travelers:actors.map(actor=>({actorUuid:actor.uuid,name:actor.id}))});
  stored.dayNumber=1;stored.phase="foraging";
  stored.currentDay={pending:actors.map(actor=>({id:actor.id,actorUuid:actor.uuid,dc:10})),results:[]};
  globalThis.game={user:gm,users,messages,modules:new Map(),settings:{settings:new Map(),
    get:(_id,key)=>key==="activeJourney"?structuredClone(stored):key==="skipDiceAnimation"?false:undefined,
    set:async(_id,key,value)=>{if(key==="activeJourney")stored=structuredClone(value);}}};
  globalThis.ChatMessage={getSpeaker:({actor})=>({actor:actor.id})};
  const errors=[];globalThis.ui={notifications:{error:error=>errors.push(error)}};
  const hooks=new Map();let hookId=0;
  globalThis.Hooks={on(name,fn){const id=++hookId;hooks.set(id,{name,fn});return id;},off(_name,id){hooks.delete(id);}};
  const socket=new ContextualSocketService();let handler,rolls=0,commits=0;
  globalThis.MorelordCore={socket,chatRequests:{register(_type,resolve){handler=resolve;}},rolls:{skill:async()=>{
    rolls++;return {roll:{total:5,dice:[],async toMessage(data){const message={...data,id:`roll-${rolls}`,_dice3danimating:true,getFlag(id,key){return this.flags?.[id]?.[key];}};messages.push(message);return message;}}};
  }}};
  const config={pendingKey:"pending",phase:"foraging",options:()=>({skill:"sur",title:"Test"}),apply:async(journey,request,result)=>{
    commits++;journey.currentDay.results.push({id:request.id,total:result.total});
    journey.currentDay.pending=journey.currentDay.pending.filter(entry=>entry.id!==request.id);await saveActiveJourney(journey);
  }};
  const serial="morelord-journeys:journey-state";
  registerJourneyChatRoll("fixture",config);
  for(const actor of actors) assert.equal((await socket.runSerialized(serial,()=>handler({journeyId:"journey",dayNumber:1,requestId:actor.id},{actor,mode:"normal",senderUserId:gm.id}))).accepted,true);
  assert.equal(rolls,2);assert.equal(commits,0);
  assert.ok(stored.currentDay.pending.every(request=>request.chatRollResult.result.total===5));
  registerJourneyChatRoll("fixture",config); // Startup recovery sees the persisted dice.
  await socket.runSerialized(serial,()=>{});
  for(const id of ["roll-2","roll-1"]) {
    messages.get(id)._dice3danimating=false;
    for(const hook of [...hooks.values()])if(hook.name==="diceSoNiceRollComplete")hook.fn(id);
    await new Promise(resolve=>setImmediate(resolve));await socket.runSerialized(serial,()=>{});
  }
  assert.deepEqual(errors,[]);assert.equal(rolls,2);assert.equal(commits,2);
  assert.deepEqual(stored.currentDay.results,[{id:"b",total:5},{id:"a",total:5}]);
  assert.deepEqual(stored.currentDay.pending,[]);
});
