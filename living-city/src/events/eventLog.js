export function createEventLog(bus, capacity = 500) {
  const buffer = [];
  let nextId = 1;
  const listeners = new Set();

  function record(event) {
    const entry = {
      id: nextId++,
      t: event.t,
      type: event.type,
      actorId: event.actorId || 'system',
      locationId: event.locationId || 'world',
      data: event.data || {}
    };

    buffer.push(entry);
    if (buffer.length > capacity) {
      buffer.shift();
    }

    listeners.forEach((listener) => {
      try {
        listener(entry);
      } catch (err) {
        console.error('Error in eventLog listener:', err);
      }
    });
  }

  // Subscribe to wildcard listener on bus
  if (bus && typeof bus.on === 'function') {
    bus.on('*', record);
  }

  return {
    record,
    getRecent(count = 50) {
      return buffer.slice(-count);
    },
    filterByType(type, limit = 50) {
      return buffer.filter((e) => e.type === type).slice(-limit);
    },
    filterByActor(actorId, limit = 50) {
      return buffer.filter((e) => e.actorId === actorId).slice(-limit);
    },
    getCount() {
      return buffer.length;
    },
    clear() {
      buffer.length = 0;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }
  };
}
