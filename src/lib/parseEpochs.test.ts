import { describe, expect, it } from 'vitest';
import { computePovwRate, type EpochData } from './parseEpochs';

describe('computePovwRate', () => {
  it('should include the most recent epoch in the calculation', () => {
    const mockEpochs: EpochData[] = [
      { epoch: 100, timestamp: '', zkc_price_usd: 0, total_cycles: 1000000, mining_rewards_zkc: 10 },
      { epoch: 99, timestamp: '', zkc_price_usd: 0, total_cycles: 1000000, mining_rewards_zkc: 5 },
      { epoch: 98, timestamp: '', zkc_price_usd: 0, total_cycles: 1000000, mining_rewards_zkc: 5 },
    ];

    // Lookback of 2 should take epochs 100 and 99.
    // Current bug: it takes index 1 and 2 (99 and 98).
    // Expected rate: (10/1 + 5/1) / 2 = 7.5
    // Actual (buggy) rate: (5/1 + 5/1) / 2 = 5.0
    const rate = computePovwRate(mockEpochs, 2);
    expect(rate).toBe(7.5);
  });

  it('should use exactly `lookback` number of most recent epochs', () => {
    const mockEpochs: EpochData[] = [
      { epoch: 100, timestamp: '', zkc_price_usd: 0, total_cycles: 1000000, mining_rewards_zkc: 20 },
      { epoch: 99, timestamp: '', zkc_price_usd: 0, total_cycles: 1000000, mining_rewards_zkc: 10 },
      { epoch: 98, timestamp: '', zkc_price_usd: 0, total_cycles: 1000000, mining_rewards_zkc: 5 },
      { epoch: 97, timestamp: '', zkc_price_usd: 0, total_cycles: 1000000, mining_rewards_zkc: 1 },
    ];

    // Lookback of 3 → epochs 100, 99, 98 → rates (20, 10, 5) → mean = 11.667
    const rate = computePovwRate(mockEpochs, 3);
    expect(rate).toBeCloseTo(11.667, 2);
  });

  it('should default to lookback of 10', () => {
    const mockEpochs: EpochData[] = Array.from({ length: 12 }, (_, i) => ({
      epoch: 100 - i,
      timestamp: '',
      zkc_price_usd: 0,
      total_cycles: 1000000,
      mining_rewards_zkc: 10,
    }));

    // Default lookback should take top 10
    const rate = computePovwRate(mockEpochs);
    expect(rate).toBe(10); // All rates are 10, mean is 10
  });
});