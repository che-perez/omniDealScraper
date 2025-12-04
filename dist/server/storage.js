import { scrapeAllSources, getCachedProducts, getScrapeStatus } from "./scrapers/index.js";
export class MemStorage {
    async getProducts() {
        return getCachedProducts();
    }
    async scrapeProducts(productsCollection) {
        return scrapeAllSources(productsCollection);
    }
    getStatus() {
        return getScrapeStatus();
    }
}
export const storage = new MemStorage();
