import { describe, it, expect } from 'vitest';
import { createEventBus } from '../src/events/bus.js';
import { createEventLog } from '../src/events/eventLog.js';

describe('Event Log Circular Buffer & Filtering', () => {
  it('records events emitted from bus with structured schema', () => {
    let simTime = 0.5;
    const bus = createEventBus(() => simTime);
    const log = createEventLog(bus, 100);

    bus.emit('player_mode_changed', { actorId: 'player', locationId: 'world', data: { mode: 'walk' } });
    bus.emit('door_entered', { actorId: 'player', locationId: 'b_0_0_0_0', data: { seed: 123 } });

    expect(log.getCount()).toBe(2);
    const recent = log.getRecent();
    expect(recent[0].type).toBe('player_mode_changed');
    expect(recent[0].actorId).toBe('player');
    expect(recent[0].t).toBe(0.5);
    expect(recent[1].type).toBe('door_entered');
    expect(recent[1].locationId).toBe('b_0_0_0_0');
  });

  it('evicts oldest events when reaching maximum capacity', () => {
    let simTime = 0.1;
    const bus = createEventBus(() => simTime);
    const capacity = 5;
    const log = createEventLog(bus, capacity);

    for (let i = 1; i <= 10; i++) {
      bus.emit('time_changed', { data: { hour: i } });
    }

    expect(log.getCount()).toBe(capacity);
    const recent = log.getRecent();
    expect(recent[0].data.hour).toBe(6);
    expect(recent[4].data.hour).toBe(10);
  });

  it('filters by type and actor accurately', () => {
    let simTime = 0.2;
    const bus = createEventBus(() => simTime);
    const log = createEventLog(bus, 50);

    bus.emit('npc_state_changed', { actorId: 'npc_1', data: { state: 'work' } });
    bus.emit('npc_state_changed', { actorId: 'npc_2', data: { state: 'lunch' } });
    bus.emit('door_entered', { actorId: 'player', data: { buildingId: 'b_1' } });

    const npcEvents = log.filterByType('npc_state_changed');
    expect(npcEvents.length).toBe(2);

    const playerEvents = log.filterByActor('player');
    expect(playerEvents.length).toBe(1);
    expect(playerEvents[0].type).toBe('door_entered');
  });
});
