const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'new', 'used', 'barely', 'clean', 'set', 'pro', 'in', 'of', 'a',
]);

const tokens = (title: string) =>
  (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

const categoryOf = (p: any) => p.category || p.category_name || '';
const priceOf = (p: any) => parseFloat(p.price) || 0;

const median = (nums: number[]) => {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// A product is an "exclusive offer" when its price is far below the median
// of similar products. Similar = same category + shared title keywords.
const MAX_PRICE_RATIO = 0.6;  // must be 40%+ below the median of its peers
const MIN_PEERS_KEYWORD = 3;  // peers that share title keywords
const MIN_PEERS_CATEGORY = 5; // fallback: same category only

export type ExclusiveOffer = { product: any; discountPct: number; marketPrice: number };

export function getExclusiveOffers(products: any[], limit = 10): ExclusiveOffer[] {
  const available = products.filter((p) => (p.stock ?? 1) > 0 && priceOf(p) > 0);
  const results: ExclusiveOffer[] = [];

  for (const p of available) {
    const myTokens = new Set(tokens(p.title));
    const sameCategory = available.filter(
      (o) => o.id !== p.id && categoryOf(o) === categoryOf(p)
    );

    let peers = sameCategory.filter((o) =>
      tokens(o.title).filter((t) => myTokens.has(t)).length >= 2
    );
    if (peers.length < MIN_PEERS_KEYWORD) {
      peers = sameCategory.length >= MIN_PEERS_CATEGORY ? sameCategory : [];
    }
    if (peers.length === 0) continue;

    const market = median(peers.map(priceOf));
    const ratio = priceOf(p) / market;
    if (ratio <= MAX_PRICE_RATIO) {
      results.push({
        product: p,
        marketPrice: market,
        discountPct: Math.round((1 - ratio) * 100),
      });
    }
  }

  return results.sort((a, b) => b.discountPct - a.discountPct).slice(0, limit);
}