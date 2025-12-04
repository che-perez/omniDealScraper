import { type Product, type ScrapeStatus } from "./schema/schema";
import { scrapeAllSources, getCachedProducts, getScrapeStatus } from "./scrapers/index";

import { Collection } from "mongodb";

export interface IStorage {
  getProducts(): Promise<Product[]>;
  scrapeProducts(productsCollection: Collection): Promise<Product[]>;
  getStatus(): ScrapeStatus;
}

export class MemStorage implements IStorage {

  async getProducts(): Promise<Product[]> {
    return getCachedProducts();
  }

  async scrapeProducts(productsCollection: Collection): Promise<Product[]> {
    return scrapeAllSources(productsCollection);
  }

  getStatus(): ScrapeStatus {
    return getScrapeStatus();
  }
}

export const storage = new MemStorage();
