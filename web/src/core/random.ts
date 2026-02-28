export interface Random {
  next(): number;
  int(minInclusive: number, maxExclusive: number): number;
}

export function createRng(seed: number): Random {
  let state = seed >>> 0;
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  const next = (): number => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(minInclusive: number, maxExclusive: number): number {
      return Math.floor(next() * (maxExclusive - minInclusive)) + minInclusive;
    },
  };
}
