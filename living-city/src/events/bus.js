// Event bus with deterministic timestamps
// Schema: { t, type, actorId, locationId, data }

export function createEventBus(getTime = () => 0) {
  const listeners = new Map();

  return {
    on(type, callback) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }
      listeners.get(type).add(callback);
      return () => this.off(type, callback);
    },

    off(type, callback) {
      listeners.get(type)?.delete(callback);
    },

    emit(type, detail = {}) {
      const event = {
        t: detail.t ?? getTime(),
        type,
        actorId: detail.actorId ?? null,
        locationId: detail.locationId ?? null,
        data: detail.data ?? {}
      };
      listeners.get(type)?.forEach(cb => cb(event));
      listeners.get('*')?.forEach(cb => cb(event));
    },

    clear() {
      listeners.clear();
    }
  };
}
