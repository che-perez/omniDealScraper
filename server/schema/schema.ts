// Product source types
export type SourceSite = "instocktrades" | "cheapgraphicnovels" | "organicpricedbooks";

// Price from a specific source
export interface PriceSource {
  site: SourceSite;
  siteName: string;
  originalPrice: number;
  salePrice: number;
  discount: number;
  url: string;
  inStock: boolean;
}

// Product with multiple price sources
export interface Product {
  id: string;
  title: string;
  normalizedTitle: string;
  imageUrl: string;
  category: string;
  prices: PriceSource[];
  bestPrice: PriceSource;
  maxDiscount: number;
  lastUpdated: Date
}

// Raw scraped item from a single source
export interface ScrapedItem {
  title: string;
  imageUrl: string;
  originalPrice: number;
  salePrice: number;
  discount: number;
  url: string;
  category: string;
  source: SourceSite;
  sourceName: string;
}

// Scrape status
export interface ScrapeStatus {
  lastScraped: Date | null;
  isScaping: boolean;
  totalProducts: number;
  sourceStats: {
    site: SourceSite;
    siteName: string;
    itemCount: number;
    lastScraped: Date | null;
  }[];
}