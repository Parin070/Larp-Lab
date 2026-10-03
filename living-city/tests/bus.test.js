import { test, expect } from 'vitest';
import { createEventBus } from '../src/events/bus.js';

test('on/emit basic pub/sub', () => {
  const bus = createEventBus(() => 123);
  let received = null;

  bus.on('test_event', (event) => {
    received = event;
  });

  bus.emit('test_event', { data: { value: 42 } });

  expect(received).toEqual({
    t: 123,
    type: 'test_event',
    actorId: null,
    locationId: null,
    data: { value: 42 }
  });
});

test('off unsubscribes listener', () => {
  const bus = createEventBus();
  let count = 0;

  const callback = () => count++;
  bus.on('test', callback);
  bus.emit('test');
  bus.off('test', callback);
  bus.emit('test');

  expect(count).toBe(1);
});

test('wildcard listener receives all events', () => {
  const bus = createEventBus();
  const events = [];

  bus.on('*', (event) => events.push(event.type));
  bus.emit('event1');
  bus.emit('event2');

  expect(events).toEqual(['event1', 'event2']);
});

test('event schema is enforced', () => {
  const bus = createEventBus(() => 456);
  let event = null;

  bus.on('test', (e) => event = e);
  bus.emit('test', {
    actorId: 'actor1',
    locationId: 'loc1',
    data: { key: 'value' }
  });

  expect(event.t).toBe(456);
  expect(event.type).toBe('test');
  expect(event.actorId).toBe('actor1');
  expect(event.locationId).toBe('loc1');
  expect(event.data).toEqual({ key: 'value' });
});
