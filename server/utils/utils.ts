import type { ScrapedItem, Product, PriceSource, SourceSite } from "../schema/schema.ts";

// Normalize title for deduplication
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\b(tp|hc|sc|vol|volume|issue|deluxe|edition|omnibus|compendium)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Calculate discount percentage
export function calculateDiscount(original: number, sale: number): number {
  if (original <= 0 || sale <= 0 || sale >= original) return 0;
  return Math.round(((original - sale) / original) * 100);
}

// Parse price string to number
export function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[^0-9.]/g, "");
  const price = parseFloat(cleaned);
  return isNaN(price) ? 0 : price;
}

// Merge scraped items into products with multiple price sources
export function mergeProducts(items: ScrapedItem[]): Product[] {
  const productMap = new Map<string, { item: ScrapedItem; prices: PriceSource[] }>();

  for (const item of items) {
    const normalized = normalizeTitle(item.title);
    const priceSource: PriceSource = {
      site: item.source,
      siteName: item.sourceName,
      originalPrice: item.originalPrice,
      salePrice: item.salePrice,
      discount: item.discount,
      url: item.url,
      inStock: true,
    };

    const existing = productMap.get(normalized);
    if (existing) {
      // Check if this source already exists
      const sourceExists = existing.prices.some((p) => p.site === item.source);
      if (!sourceExists) {
        existing.prices.push(priceSource);
      }
      // Keep the better image (prefer non-placeholder)
      if (item.imageUrl && !item.imageUrl.includes("placeholder")) {
        existing.item.imageUrl = item.imageUrl;
      }
    } else {
      productMap.set(normalized, {
        item: { ...item },
        prices: [priceSource],
      });
    }
  }

  // Convert to Product array
  const products: Product[] = [];
  let id = 1;

  const entries = Array.from(productMap.entries());
  for (const entry of entries) {
    const normalizedTitle = entry[0];
    const data = entry[1];
    // Sort prices by sale price (lowest first)
    data.prices.sort((a: PriceSource, b: PriceSource) => a.salePrice - b.salePrice);
    const bestPrice = data.prices[0];
    const maxDiscount = Math.max(...data.prices.map((p: PriceSource) => p.discount));

    products.push({
      id: `product-${id++}`,
      title: data.item.title,
      normalizedTitle,
      imageUrl: data.item.imageUrl,
      category: data.item.category,
      prices: data.prices,
      bestPrice,
      maxDiscount,
    });
  }

  // Sort by max discount (highest first)
  products.sort((a, b) => b.maxDiscount - a.maxDiscount);

  return products;
}

// Get site display name
export function getSiteName(site: SourceSite): string {
  const names: Record<SourceSite, string> = {
    instocktrades: "InStockTrades",
    cheapgraphicnovels: "Cheap Graphic Novels",
    organicpricedbooks: "Organic Priced Books",
  };
  return names[site];
}

// Validate image URL
export async function validateImageUrl(url: string): Promise<boolean> {
  if (!url || url.includes("placeholder")) return false;
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

// Create a placeholder image URL
export function getPlaceholderImage(): string {
  return "https://via.placeholder.com/200x300?text=No+Image";
}
