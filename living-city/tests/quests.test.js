import { test, expect } from 'vitest';
import { generateQuestPool, QUEST_TYPES } from '../src/sim/quests.js';
import { createQuestManager } from '../src/sim/questManager.js';
import { createEventBus } from '../src/events/bus.js';

test('deterministic quest pool generation', () => {
  const seed = 424242;
  const pool1 = generateQuestPool(seed, 8);
  const pool2 = generateQuestPool(seed, 8);

  expect(pool1.length).toBe(8);
  expect(pool2.length).toBe(8);

  for (let i = 0; i < pool1.length; i++) {
    expect(pool1[i].id).toBe(pool2[i].id);
    expect(pool1[i].title).toBe(pool2[i].title);
    expect(pool1[i].reward.cash).toBe(pool2[i].reward.cash);
    expect(pool1[i].giver.pos).toEqual(pool2[i].giver.pos);
  }
});

test('quest lifecycle: accept, advance stage, and complete', () => {
  const bus = createEventBus();
  const events = [];
  bus.on('*', e => events.push(e.type));

  const questManager = createQuestManager(12345, bus, null);
  const available = questManager.getAvailableQuests();
  expect(available.length).toBeGreaterThan(0);

  const initialCash = questManager.getCash();
  const quest = available[0];

  // Accept
  const accepted = questManager.acceptQuest(quest);
  expect(accepted).toBe(true);
  expect(questManager.getActiveQuest()).toBe(quest);
  expect(events).toContain('quest_started');

  // Advance stages until complete
  const stageCount = quest.stages.length;
  for (let i = 0; i < stageCount - 1; i++) {
    const res = questManager.advanceStage();
    expect(res.status).toBe('stage_advanced');
  }

  // Final stage completion
  const completeRes = questManager.advanceStage();
  expect(completeRes.status).toBe('completed');
  expect(questManager.getActiveQuest()).toBeNull();
  expect(questManager.isCompleted(quest.id)).toBe(true);
  expect(questManager.getCash()).toBe(initialCash + quest.reward.cash);
  expect(events).toContain('quest_completed');
});

test('quest timer countdown and failure', () => {
  const bus = createEventBus();
  const events = [];
  bus.on('*', e => events.push(e.type));

  const questManager = createQuestManager(12345, bus, null);
  const timedQuest = questManager.getQuests().find(q => q.timeLimit !== null);
  expect(timedQuest).toBeDefined();

  questManager.acceptQuest(timedQuest);
  expect(questManager.getTimeRemaining()).toBe(timedQuest.timeLimit);

  // Advance time past the limit
  questManager.update(timedQuest.timeLimit + 1);

  expect(questManager.getActiveQuest()).toBeNull();
  expect(events).toContain('quest_failed');
});

test('quest manager state serialization and deserialization', () => {
  const bus = createEventBus();
  const questManager1 = createQuestManager(99999, bus, null);

  const quest = questManager1.getAvailableQuests()[0];
  questManager1.acceptQuest(quest);
  questManager1.advanceStage();

  const serialized = questManager1.serialize();

  const questManager2 = createQuestManager(99999, bus, null);
  questManager2.deserialize(serialized);

  expect(questManager2.getCash()).toBe(questManager1.getCash());
  expect(questManager2.getActiveQuest()?.id).toBe(quest.id);
  expect(questManager2.getCurrentStageIndex()).toBe(questManager1.getCurrentStageIndex());
});
