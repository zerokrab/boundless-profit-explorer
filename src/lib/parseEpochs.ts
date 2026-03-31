// Parses epoch JSON data to compute POVW_ZKC_PER_MHZ_PER_EPOCH
// Formula (from notebook): mining_rewards_zkc / total_cycles_mhz
// where total_cycles_mhz = total_cycles / 1e6
// Use most recent N epochs (skip epoch 99 as it's the latest/ongoing — skip the first row)
// Compute mean of (mining_rewards_zkc / (total_cycles / 1e6)) per epoch
// EPOCH_LOOKBACK_COUNT = 10

export interface EpochData {
  epoch: number;
  timestamp: string;
  zkc_price_usd: number;
  total_cycles: number;
  mining_rewards_zkc: number;
}

export function computePovwRate(epochs: EpochData[], lookback: number = 10): number {
  // Sort by epoch descending, skip the most recent (index 0), take next `lookback`
  const sorted = [...epochs].sort((a, b) => b.epoch - a.epoch);
  const relevant = sorted.slice(1, lookback + 1); // skip latest epoch
  const rates = relevant.map(e => e.mining_rewards_zkc / (e.total_cycles / 1e6));
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}
