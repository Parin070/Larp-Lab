// Seeded PRNG using mulberry32 algorithm
// Never use Math.random() - determinism is critical

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

export function createRNG(seed = 12345) {
  let state = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);

  function next() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    nextInt(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    nextFloat(min, max) {
      return next() * (max - min) + min;
    },
    choice(array) {
      return array[Math.floor(next() * array.length)];
    },
    fork() {
      const forkedSeed = state >>> 0;
      next(); // advance parent state
      return createRNG(forkedSeed);
    },
    getState() {
      return state >>> 0;
    },
    setState(newState) {
      state = newState >>> 0;
    }
  };
}
