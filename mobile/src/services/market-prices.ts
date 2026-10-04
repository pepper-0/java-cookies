export const marketCrops = ['maize', 'cassava', 'rice'] as const;

export type MarketCrop = (typeof marketCrops)[number];

export type MarketPrice = {
  id: string;
  crop: MarketCrop;
  market: string;
  province: string;
  amount: number;
};

export type MarketPriceFeed = {
  source: 'static-demo';
  currency: 'CDF';
  unit: 'kg';
  observedOn: string;
  pulledAt: string;
  prices: MarketPrice[];
};

const demonstrationPrices: readonly MarketPrice[] = [
  { id: 'maize-kinshasa', crop: 'maize', market: 'Kinshasa', province: 'Kinshasa', amount: 1600 },
  { id: 'maize-lubumbashi', crop: 'maize', market: 'Lubumbashi', province: 'Haut-Katanga', amount: 1450 },
  { id: 'maize-goma', crop: 'maize', market: 'Goma', province: 'Nord-Kivu', amount: 1700 },
  { id: 'cassava-kinshasa', crop: 'cassava', market: 'Kinshasa', province: 'Kinshasa', amount: 950 },
  { id: 'cassava-lubumbashi', crop: 'cassava', market: 'Lubumbashi', province: 'Haut-Katanga', amount: 850 },
  { id: 'cassava-goma', crop: 'cassava', market: 'Goma', province: 'Nord-Kivu', amount: 1100 },
  { id: 'rice-kinshasa', crop: 'rice', market: 'Kinshasa', province: 'Kinshasa', amount: 3600 },
  { id: 'rice-lubumbashi', crop: 'rice', market: 'Lubumbashi', province: 'Haut-Katanga', amount: 3300 },
  { id: 'rice-goma', crop: 'rice', market: 'Goma', province: 'Nord-Kivu', amount: 3900 },
];

/**
 * Returns the bundled demonstration feed through the same async boundary that a
 * future live market-price provider can implement.
 */
export async function pullMarketPrices(): Promise<MarketPriceFeed> {
  return {
    source: 'static-demo',
    currency: 'CDF',
    unit: 'kg',
    observedOn: '2026-10-03',
    pulledAt: new Date().toISOString(),
    prices: demonstrationPrices.map((price) => ({ ...price })),
  };
}
