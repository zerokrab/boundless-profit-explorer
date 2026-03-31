// Constants
export const HOURS_PER_EPOCH = 48;
export const SECONDS_PER_EPOCH = HOURS_PER_EPOCH * 3600; // 172800
export const EPOCHS_PER_MONTH = (30 * 24) / HOURS_PER_EPOCH; // 15

export interface GpuConfig {
  id: string;
  label: string;
  num_gpus: number;
  usd_per_hour: number;
  mhz: number; // MHz per GPU per second
}

export interface ModelParams {
  gpuConfigs: GpuConfig[];
  zkc_price_min: number;
  zkc_price_max: number;
  zkc_price_steps: number;
  market_reward_usd_per_bcycle: number; // USD per Bcycle (billions of cycles)
  market_order_util: number; // 0-1 fraction
  fixed_cost_monthly_usd: number;
  povw_zkc_per_mhz_per_epoch: number; // derived from epoch data
}

export interface ScenarioResult {
  scenario: string;
  zkc_price_usd: number;
  market_reward_usd_per_mhz: number;
  profit_per_epoch: number;
  povw_revenue: number;
  market_revenue: number;
  cost_per_epoch: number;
}

export function computeZkcPrices(min: number, max: number, steps: number): number[] {
  const prices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    prices.push(min + (max - min) * (i / steps));
  }
  return prices;
}

export function computeResults(params: ModelParams): ScenarioResult[] {
  const results: ScenarioResult[] = [];
  const zkc_prices = computeZkcPrices(params.zkc_price_min, params.zkc_price_max, params.zkc_price_steps);
  const fixed_cost_per_epoch = params.fixed_cost_monthly_usd / EPOCHS_PER_MONTH;
  const market_reward_mhz = params.market_reward_usd_per_bcycle / 1000; // convert Bcycle to MHz

  for (const gpu of params.gpuConfigs) {
    const mhz_per_epoch = gpu.mhz * gpu.num_gpus * SECONDS_PER_EPOCH;
    const rental_per_epoch = gpu.usd_per_hour * gpu.num_gpus * HOURS_PER_EPOCH;
    const cost_per_epoch = rental_per_epoch + fixed_cost_per_epoch;

    for (const zkc_price of zkc_prices) {
      const povw_revenue = mhz_per_epoch * params.povw_zkc_per_mhz_per_epoch * zkc_price;
      const market_revenue = mhz_per_epoch * market_reward_mhz * params.market_order_util;
      const profit = povw_revenue + market_revenue - cost_per_epoch;

      results.push({
        scenario: gpu.label,
        zkc_price_usd: zkc_price,
        market_reward_usd_per_mhz: market_reward_mhz,
        profit_per_epoch: profit,
        povw_revenue,
        market_revenue,
        cost_per_epoch,
      });
    }
  }
  return results;
}

// For breakeven: find minimum ZKC price where profit >= 0
export function computeBreakeven(params: ModelParams): { scenario: string; breakeven_zkc: number | null }[] {
  const results = computeResults(params);
  const gpuLabels = [...new Set(results.map(r => r.scenario))];
  return gpuLabels.map(label => {
    const rows = results.filter(r => r.scenario === label).sort((a, b) => a.zkc_price_usd - b.zkc_price_usd);
    const profitable = rows.find(r => r.profit_per_epoch >= 0);
    return { scenario: label, breakeven_zkc: profitable ? profitable.zkc_price_usd : null };
  });
}
