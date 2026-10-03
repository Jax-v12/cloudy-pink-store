export type ProviderResult = { outcome: 'pending' | 'succeeded' | 'failed' | 'unknown' };
export interface GameProvider {
  send(input: { reference: string; sku: string; userId: string; zoneId: string | null }): Promise<ProviderResult>;
  status(reference: string): Promise<ProviderResult>;
}

// Deterministic across process restarts: the scenario is encoded in the reference.
// The simulator never talks to a real provider or delivers real products.
export function simulatorResult(reference: string): ProviderResult {
  if (reference.startsWith('fail-')) return { outcome: 'failed' };
  if (reference.startsWith('pending-')) return { outcome: 'pending' };
  if (reference.startsWith('unknown-')) return { outcome: 'unknown' };
  return { outcome: 'succeeded' };
}

export function getGameProvider(name: string): GameProvider {
  if (name !== 'simulator' || process.env.NODE_ENV === 'production') throw new Error('PROVIDER_UNAVAILABLE');
  return {
    async send(input) {
      if (input.reference.startsWith('timeout-')) throw new Error('SIMULATED_TIMEOUT');
      return simulatorResult(input.reference);
    },
    async status(reference) { return simulatorResult(reference); },
  };
}
