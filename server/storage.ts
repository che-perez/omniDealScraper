import { type Product, type ScrapeStatus } from "./schema/schema.ts";
import { scrapeAllSources, getCachedProducts, getScrapeStatus } from "./scrapers/index.ts";

export interface IStorage {
  getProducts(): Promise<Product[]>;
  scrapeProducts(): Promise<Product[]>;
  getStatus(): ScrapeStatus;
}

export class MemStorage implements IStorage {

  async getProducts(): Promise<Product[]> {
    return getCachedProducts();
  }

  async scrapeProducts(): Promise<Product[]> {
    return scrapeAllSources();
  }

  getStatus(): ScrapeStatus {
    return getScrapeStatus();
  }
}

export const storage = new MemStorage();
