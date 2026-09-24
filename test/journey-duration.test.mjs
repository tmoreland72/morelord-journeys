import test from 'node:test';
import assert from 'node:assert/strict';
import { journeyDuration } from '../scripts/domain/journey.mjs';
test('elapsed journey days and route distance remain distinct before and during day seven',()=>{
 const journey={dayNumber:6,currentDay:null,progressSteps:11,remainingSteps:5};
 assert.deepEqual(journeyDuration(journey),{completedDays:6,estimatedTotalSteps:23});
 assert.deepEqual(journeyDuration({...journey,dayNumber:7,currentDay:{number:7}}),{completedDays:6,estimatedTotalSteps:23});
 assert.deepEqual(journeyDuration({...journey,dayNumber:7,remainingSteps:2}),{completedDays:7,estimatedTotalSteps:23});
 assert.deepEqual(journeyDuration({...journey,dayNumber:8,remainingSteps:0}),{completedDays:8,estimatedTotalSteps:24});
 assert.deepEqual(journeyDuration({dayNumber:0,currentDay:null,remainingSteps:16}),{completedDays:0,estimatedTotalSteps:16});
});
