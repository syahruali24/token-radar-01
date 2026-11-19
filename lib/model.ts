/** Snapshot-only launch valuation. No protocol-specific overrides or external data. */
export interface Protocol {
  slug: string; name: string; category: string | null; chains: string[];
  tvl_usd: number; change_7d: number | null; mcap_usd: number | null;
  listed_at: string | null; gecko_id: string | null; symbol: string | null;
}
export interface Snapshot {
  as_of: string; source: unknown; floor_usd: number; protocols: Protocol[]; watchlist: string[];
}
export function isPreToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null && p.mcap_usd === null;
}
const excluded = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);
export function isLaunchCandidate(p: Protocol): boolean {
  return isPreToken(p) && !excluded.has(p.category ?? '') &&
    !/\s(?:v\d+(?:\.\d+)*|\d+\.\d+)$/i.test(p.name) &&
    !/\b(?:wrapped|staked|staking)\b/i.test(p.name) &&
    !/^(?:Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i.test(p.name);
}
export function ageDays(p: Protocol, asOf: string): number {
  return p.listed_at === null ? 365 : Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(p.listed_at)) / 86400000));
}
function gasFor(chain: string): number {
  if (chain === 'Ethereum') return 5;
  if (['Base', 'Arbitrum', 'Optimism'].includes(chain)) return 0.5;
  if (chain === 'Solana') return 0.05;
  if (['BSC', 'Binance'].includes(chain)) return 0.3;
  return 1;
}
/** Plans describe conditional opportunities, not verified eligibility or promised rewards. */
export function farmSteps(p: Protocol, age: number): string[] {
  const chain = p.chains[0] ?? 'the recorded network';
  const gas = gasFor(chain);
  const capital = p.tvl_usd >= 5e9 ? 250 : p.tvl_usd >= 1e9 ? 150 : p.tvl_usd >= 1e8 ? 100 : 50;
  const hold = age < 180 ? 60 : age < 365 ? 45 : 30;
  const category = p.category ?? 'Unclassified';
  let action: string, repeat: string;
  if (/lend|cdp/i.test(category)) {
    action = 'Supply an accepted stable asset to a lending market; inspect utilization and withdrawal liquidity before approving';
    repeat = 'Add a small supply deposit to the same market and record the updated position; borrowing is optional and adds liquidation risk';
  } else if (/dex/i.test(category)) {
    action = 'Split the budget into the two accepted assets and add liquidity to a liquid pool after checking fee tier and price impact';
    repeat = 'Make one small swap through the same exchange, checking minimum received and avoiding self-trading';
  } else if (/yield/i.test(category)) {
    action = 'Deposit an accepted asset into a yield vault after reviewing its strategy, withdrawal queue and fees';
    repeat = 'Add a small vault deposit and record shares received, fees and any withdrawal delay';
  } else if (/rwa/i.test(category)) {
    action = 'Check jurisdiction and identity requirements, then subscribe to an eligible real-world asset vault only if access is available';
    repeat = 'If eligible and subscriptions remain open, add a small subscription; otherwise review the redemption terms without transacting';
  } else if (/derivative|perpetual/i.test(category)) {
    action = 'Fund a margin account and place a small fully collateralized position only after checking liquidation and funding terms; use no added leverage';
    repeat = 'Review funding and close or rebalance the small position with a limit order; skip if costs exceed the budget';
  } else if (/prediction/i.test(category)) {
    action = 'Fund an eligible prediction market and buy a small outcome position after reading resolution rules; the stake can be lost';
    repeat = 'Review market resolution and place a small independent position only when the outcome and loss budget are understood';
  } else if (/curator|allocator/i.test(category)) {
    action = 'Select a curated vault after reviewing collateral exposure, allocator permissions and withdrawal liquidity, then deposit an accepted asset';
    repeat = 'Add a small deposit to the selected vault and inspect changes in allocation and concentration';
  } else {
    action = `Inspect the ${category} app for an accepted deposit or mint route, then make a small supported deposit; skip if no suitable route exists`;
    repeat = `Repeat a small supported deposit or mint in the ${category} app only after checking current fees and withdrawal access`;
  }
  return [
    `Create a fresh wallet for ${chain}, keep its seed offline and verify the protocol's own app before connecting. Cost: $0 wallet setup; reserve approximately $${gas * 4} for gas. Time: 10 minutes.`,
    `${action} on ${chain}. Cost: up to $${capital} capital plus approximately $${gas} gas; pool fees or losses are extra. Time: 20 minutes.`,
    `${repeat} on ${chain} once each week. Cost: up to $${Math.round(capital / 10)} from the same capital budget plus approximately $${gas} gas per action. Time: 10 minutes weekly.`,
    `Keep the supported position open for ${hold} days and check withdrawal access weekly; exit early if risk changes. This is a planning window, not a qualification promise. Cost: $${capital} capital at risk plus approximately $${gas} exit gas. Time: ${hold} days.`,
    `If the protocol runs a points program, inspect its own points or rewards page and claim only from the link it publishes. Never pay to claim; skip any request for a claim payment. Cost: $0 to check. Time: 5 minutes weekly.`,
    `Keep a farm log with ${p.slug}, ${chain}, wallet address, dates, transaction hashes, actual USD costs and exit receipts. The snapshot records no token; rewards are not guaranteed. Cost: $0. Time: 5 minutes per session.`,
  ];
}
export function buildRadar(snapshot: Snapshot) {
  const ratios = snapshot.protocols.filter(p => (p.mcap_usd ?? 0) > 0 && p.tvl_usd > 0)
    .map(p => p.mcap_usd! / p.tvl_usd).sort((a,b) => a-b);
  if (!ratios.length) throw new Error('No positive market-cap / TVL samples');
  // For an even sample, use the lower central observed ratio (128 records -> index 63).
  const multiple = ratios[Math.floor((ratios.length - 1) / 2)];
  const watch = new Set(snapshot.watchlist);
  const selected = snapshot.protocols.filter(p => watch.has(p.slug) || (p.tvl_usd < snapshot.floor_usd && isLaunchCandidate(p)));
  if (snapshot.watchlist.some(slug => !selected.some(p => p.slug === slug))) throw new Error('Watchlist slug missing from snapshot');
  const rows = selected.map(p => {
    const age = ageDays(p, snapshot.as_of);
    const growth = Math.max(-60, Math.min(120, p.change_7d ?? 0));
    const gm = 1 + growth / 100 * 0.5;
    const mm = 0.6 + Math.min(age,1095) / 1095 * 0.4;
    return {...p, rank: 0, watchlist: watch.has(p.slug), token_status: 'pre-token', age_days: age,
      implied_value_usd: Math.min(1e14, Math.max(1, Math.round(p.tvl_usd * multiple * gm * mm))),
      model: {base_multiple: multiple, growth_pct: growth, growth_multiplier: gm, maturity_multiplier: mm, age_days: age},
      farm_steps: farmSteps(p, age)};
  }).sort((a,b) => b.implied_value_usd-a.implied_value_usd || b.tvl_usd-a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  rows.forEach((r,i) => {
    r.rank = i+1;
    if (i && r.implied_value_usd >= rows[i-1].implied_value_usd) r.implied_value_usd = Math.max(1, rows[i-1].implied_value_usd-1);
  });
  const live = snapshot.protocols.filter(p => !isPreToken(p) && (p.mcap_usd ?? 0) > 0 && p.category !== 'CEX')
    .sort((a,b) => b.mcap_usd!-a.mcap_usd! || (a.slug < b.slug ? -1 : 1)).slice(0,24);
  return {as_of: snapshot.as_of, source: snapshot.source, floor_usd: snapshot.floor_usd,
    universe_size: snapshot.protocols.length, watchlist_size: snapshot.watchlist.length,
    early_size: rows.filter(r => !r.watchlist).length, market_multiple: multiple, market_sample_size: ratios.length,
    candidate_count: snapshot.protocols.filter(isLaunchCandidate).length, rows, live};
}
