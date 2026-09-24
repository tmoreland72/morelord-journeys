import { assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { holdTestRollAnimations, untilRollCheck } from "../../../morelord-core/scripts/testing/roll-completion.js";
import { createJourney } from "../domain/journey.mjs";
import { createRoute } from "../domain/route.mjs";
import { readyJourney, beginTravelDay } from "../domain/engine.mjs";
import { foragingRollService } from "../services/foraging-roll-service.mjs";

export const immediateJourneyRollCheck = {id:"journeys.immediate-group-rolls", async run() {
  assert(game.world?.id === "dev1", "Dev1 is required.");
  const id="morelord-journeys", journeyId=foundry.utils.randomID(), actors=[];
  const snapshot=Object.fromEntries(["activeJourney","journeyUndo","skipDiceAnimation"].map(key=>[key,foundry.utils.deepClone(game.settings.get(id,key))]));
  const gate=holdTestRollAnimations(message=>message.getFlag(id,"journeyRequest")?.journeyId===journeyId);
  const current=()=>game.settings.get(id,"activeJourney");
  try {
    for(const name of ["Immediate forage A","Immediate forage B"]) actors.push(await Actor.create({name,type:"character",system:{bonuses:{abilities:{skill:"-100"}}}}));
    const route=createRoute({id:foundry.utils.randomID(),origin:{name:"Fixture start"},destination:{name:"Fixture end"},lengthSteps:6,resourcesDC:10});
    const journey=beginTravelDay(readyJourney(createJourney({id:journeyId,route,travelers:actors.map(actor=>({actorId:actor.id,actorUuid:actor.uuid,name:actor.name}))})));
    journey.phase="foraging";journey.currentDay.pace="normal";
    await game.settings.set(id,"activeJourney",journey);
    await game.settings.set(id,"skipDiceAnimation",false);
    await foragingRollService.requestParty();
    const card=game.messages.find(message=>Object.values(message.getFlag("morelord-core","rollRequest")?.entries??{}).some(entry=>entry.data.journeyId===journeyId));
    assert(card,"The party has one grouped request.");
    for(const key of Object.keys(card.getFlag("morelord-core","rollRequest").entries)) {
      const select=()=>document.querySelector(`[data-message-id="${card.id}"] [data-ml-roll-entry="${key}"] [data-ml-core-roll="normal"]`);
      await untilRollCheck(select,"The next forager's roll button is visible.");
      const button=select(),row=button.closest(".ml-card");
      assert(!button.disabled,"Other foragers remain clickable during earlier dice.");
      button.click();
      assert(row.querySelector(".ml-roll-completed") && !row.querySelector("button"),"The clicked row immediately becomes Completed.");
      await untilRollCheck(()=>card.getFlag("morelord-core","rollRequest").entries[key].completed,"The roll acknowledges before its animation completes.");
    }
    assert(gate.held.size===2,"Both real rolls start while animations are held.");
    assert(current().currentDay.pendingForagingRolls.every(request=>request.chatRollResult),"Both evaluated results are saved for reload recovery.");
    assert(!current().currentDay.foragingResults.length,"Foraging outcomes remain hidden until their dice finish.");
    const second=[...gate.held.values()][1];
    gate.release(second.id);
    await untilRollCheck(()=>current().currentDay.foragingResults.length===1,"The second animation may finish first.");
    assert(current().currentDay.foragingResults[0].actorUuid===actors[1].uuid,"The completed result belongs to the second forager.");
    gate.stop();
    await untilRollCheck(()=>current().currentDay.foragingResults.length===2 && !current().currentDay.pendingForagingRolls.length,"Both results commit without overwriting each other.");
    assert(new Set(current().currentDay.foragingResults.map(result=>result.actorUuid)).size===2,"Every traveler resolves once.");
  } finally {
    gate.stop();
    await MorelordCore.socket.runSerialized("morelord-journeys:journey-state", async()=>{
      for(const [key,value] of Object.entries(snapshot))await game.settings.set(id,key,value);
    });
    const messages=game.messages.filter(message=>message.getFlag(id,"journeyRequest")?.journeyId===journeyId
      || Object.values(message.getFlag("morelord-core","rollRequest")?.entries??{}).some(entry=>entry.data.journeyId===journeyId));
    if(messages.length)await ChatMessage.deleteDocuments(messages.map(message=>message.id));
    for(const actor of actors)await actor.delete();
  }
}};
