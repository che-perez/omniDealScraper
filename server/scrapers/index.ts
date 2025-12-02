import type { ScrapedItem, Product, ScrapeStatus, SourceSite } from "../schema/schema.ts";
import { scrapeInStockTrades } from "./instockTradeScraper.ts";
import { scrapeCheapGraphicNovels } from "./cheapgraphicnovel.ts";
import { scrapeOrganicPriceBooks } from "./organicpricedbooksScraper.ts";
import { mergeProducts, getSiteName } from "../utils/utils.ts";

// In-memory cache for scraped products
let cachedProducts: Product[] = [];
let scrapeStatus: ScrapeStatus = {
  lastScraped: null,
  isScaping: false,
  totalProducts: 0,
  sourceStats: [],
};

// Scrape all sources and merge products
export async function scrapeAllSources(): Promise<Product[]> {
  if (scrapeStatus.isScaping) {
    console.log("Scrape already in progress, returning cached data");
    return cachedProducts;
  }

  scrapeStatus.isScaping = true;
  const allItems: ScrapedItem[] = [];
  const sourceStats: ScrapeStatus["sourceStats"] = [];

  try {
    console.log("Starting scrape of all sources...");

    // Scrape all sources in parallel
    const [istItems, cgnItems, opbItems] = await Promise.all([
      scrapeInStockTrades().catch((err) => {
        console.error("IST scrape failed:", err);
        return [] as ScrapedItem[];
      }),
      scrapeCheapGraphicNovels().catch((err) => {
        console.error("CGN scrape failed:", err);
        return [] as ScrapedItem[];
      }),
      scrapeOrganicPriceBooks().catch((err) => {
        console.error("OPB scrape failed", err);
        return [] as ScrapedItem[];
      })
    ]);

    const now = new Date();

    // Add IST items
    allItems.push(...istItems);
    sourceStats.push({
      site: "instocktrades" as SourceSite,
      siteName: getSiteName("instocktrades"),
      itemCount: istItems.length,
      lastScraped: now
    });

    // Add CGN items
    allItems.push(...cgnItems);
    sourceStats.push({
      site: "cheapgraphicnovels" as SourceSite,
      siteName: getSiteName("cheapgraphicnovels"),
      itemCount: cgnItems.length,
      lastScraped: now
    });

    // Add OPB items
    allItems.push(...opbItems);
    sourceStats.push({
        site: "organicpricedbooks" as SourceSite,
        siteName: getSiteName("organicpricedbooks"),
        itemCount: opbItems.length,
        lastScraped: now
    })

    console.log(`Total items scraped: ${allItems.length}`);

    // Merge products to dedupe by title
    cachedProducts = mergeProducts(allItems);

    console.log(`Merged into ${cachedProducts.length} unique products`);

    // Update status
    scrapeStatus = {
      lastScraped: now,
      isScaping: false,
      totalProducts: cachedProducts.length,
      sourceStats,
    };

    return cachedProducts;
  } catch (err) {
    console.error("Scrape all sources failed:", err);
    scrapeStatus.isScaping = false;
    throw err;
  }
}

// Get cached products
export function getCachedProducts(): Product[] {
  return cachedProducts;
}

// Get scrape status
export function getScrapeStatus(): ScrapeStatus {
  return scrapeStatus;
}

// Check if we have data
export function hasData(): boolean {
  return cachedProducts.length > 0;
}
