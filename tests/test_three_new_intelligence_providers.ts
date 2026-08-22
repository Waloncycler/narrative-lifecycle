import { describe, it, expect } from 'vitest';
import { fetchCcgpTenders } from '@/features/worldmonitor/io/ccgp_tenders_provider';
import { fetchChinaDrugTrials } from '@/features/worldmonitor/io/chinadrugtrials_provider';
import { fetchCommodityPricing } from '@/features/worldmonitor/io/commodity_pricing_provider';

describe('Three Standard Intelligence Providers Integration', () => {
  it('fetchCcgpTenders returns valid government procurement tender facts', async () => {
    const tenders = await fetchCcgpTenders();
    expect(tenders.length).toBeGreaterThan(0);
    const item = tenders[0];
    expect(item.title).toBeTruthy();
    expect(item.purchaser).toBeTruthy();
    expect(item.amount_rmb).toBeTruthy();
    expect(item.source_url.startsWith('http')).toBe(true);
    expect(item.event_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 15000);

  it('fetchChinaDrugTrials returns valid CTR clinical milestone facts', async () => {
    const trials = await fetchChinaDrugTrials();
    expect(trials.length).toBeGreaterThan(0);
    const item = trials[0];
    expect(item.ctr_id).toBeTruthy();
    expect(item.drug_name).toBeTruthy();
    expect(item.sponsor).toBeTruthy();
    expect(item.trial_phase).toBeTruthy();
    expect(item.source_url.startsWith('http')).toBe(true);
    expect(item.event_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 15000);

  it('fetchCommodityPricing returns valid micro supply chain pricing telemetry', async () => {
    const commodities = await fetchCommodityPricing();
    expect(commodities.length).toBeGreaterThan(0);
    const item = commodities[0];
    expect(item.item_name).toBeTruthy();
    expect(item.spot_price).toBeTruthy();
    expect(item.operating_rate_pct).toBeTruthy();
    expect(item.inventory_days).toBeGreaterThan(0);
    expect(item.source_url.startsWith('http')).toBe(true);
    expect(item.event_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 15000);
});
