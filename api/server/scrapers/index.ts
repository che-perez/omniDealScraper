import type { ScrapedItem, Product, ScrapeStatus, SourceSite } from "../schema/schema";
import { scrapeInStockTrades } from "./instockTradeScraper";
import { scrapeCheapGraphicNovels } from "./cheapgraphicnovel";
import { scrapeOrganicPriceBooks } from "./organicpricedbooksScraper";
import { mergeProducts, getSiteName } from "../utils/utils";

// Import MongoDB
import { Collection } from 'mongodb';

// In-memory cache for scraped products
let cachedProducts: Product[] = [];
let itemsId: Set<string>;
let scrapeStatus: ScrapeStatus = {
  lastScraped: null,
  isScaping: false,
  totalProducts: 0,
  sourceStats: [],
};



// Scrape all sources and merge products
export async function scrapeAllSources(productsCollection: Collection): Promise<Product[]> {
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
    [cachedProducts, itemsId] = mergeProducts(allItems);

    console.log(`Merged into ${cachedProducts.length} unique products`);

    // Update status
    scrapeStatus = {
      lastScraped: now,
      isScaping: false,
      totalProducts: cachedProducts.length,
      sourceStats,
    };

    // Get existing product identifiers from the database
    const existingProductsInDb = await productsCollection.find({}, { projection: { normalizedTitle: 1 } }).toArray();
    const existingDbProductIds: Set<string> = new Set(existingProductsInDb.map(p => p.normalizedTitle));

    // Identify new products to add
    const productsToAdd = cachedProducts.filter(p => !existingDbProductIds.has(p.normalizedTitle));

    // Identify products to remove (no longer present on the scraped page)
    const productsToRemoveIdentifiers = Array.from(existingDbProductIds).filter(id => !itemsId.has(id));
    
    // Perform Database Operations - Add or Remove Products from DB
    if (productsToRemoveIdentifiers.length > 0) {
        const deleteResult = await productsCollection.deleteMany({ identifier: { $in: productsToRemoveIdentifiers } });
        console.log(`Removed ${deleteResult.deletedCount} products no longer found on the website.`);
    } else {
        console.log('No products to remove.');
    }

    if (productsToAdd.length > 0) {
        const insertResult = await productsCollection.insertMany(productsToAdd);
        console.log(`Added ${insertResult.insertedCount} new products.`);
    } else {
        console.log('No new products to add.');
    }

    // Update existing product, e.g., price.
    for (const product of cachedProducts) {
        if (existingDbProductIds.has(product.normalizedTitle)) {
            await productsCollection.updateOne(
                { identifier: product.normalizedTitle },
                { $set: { id: product.id,
                          title: product.title,
                          normalizedTitle: product.normalizedTitle,
                          imageUrl: product.imageUrl,
                          category: product.category,
                          prices: product.prices,
                          bestPrice: product.bestPrice,
                          maxDiscount: product.maxDiscount,
                          lastUpdated: now } }
            );
        }
    }

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
