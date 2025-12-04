/**
 * Organic Price Books Web Scraper
 * Scrapes discount deals from multiple sale categories on panelboundcomics.com/
 */
import * as cheerio from "cheerio";
import { parsePrice, calculateDiscount, getSiteName } from "../utils/utils.js";
const SOURCE = "organicpricedbooks";
const BASE_URL = "https://www.panelboundcomics.com";
/**
 * Scrape a single category page with pagination
 *
 * @param startUrl - The URL to start scraping from
 * @param category - The category name (e.g., "Black Friday Sales")
 * @returns Array of scraped items from all pages
 */
// Scrape a single category page
async function scrapeCategoryPage(url, category) {
    const items = [];
    let maxPage = "";
    try {
        console.log(`[OPB] Fetching ${url}`);
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        });
        if (!response.ok) {
            console.error(`[OPB] Failed to fetch ${url}: ${response.status}`);
            return [items, maxPage];
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        //Grab max page number
        const pageEl = $(".pagination__item.link");
        maxPage = pageEl.eq(-2).text();
        // Try multiple selectors for products
        const productSelectors = [
            ".card--standard.card--media",
        ];
        let $products = $();
        for (const selector of productSelectors) {
            const found = $(selector);
            if (found.length > 0) {
                $products = found;
                console.log(`[OPB] Found ${found.length} products with selector: ${selector}`);
                break;
            }
        }
        $products.each((_, element) => {
            try {
                const $el = $(element);
                // Get title - try multiple selectors
                const titleEl = $el.find(".card__heading, h3 a, h4 a, a.title, .name a").first();
                const title = titleEl.text().trim() || $el.find("a").first().text().trim();
                if (!title || title.length < 3)
                    return;
                // Get URL
                const href = titleEl.attr("href") || $el.find("a").first().attr("href");
                if (!href)
                    return;
                const productUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;
                // Get image
                const imgEl = $el.find("img").first();
                let imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
                if (imageUrl) {
                    if (imageUrl.startsWith("//")) {
                        imageUrl = `https:${imageUrl}`;
                    }
                    else if (!imageUrl.startsWith("http")) {
                        imageUrl = `${BASE_URL}${imageUrl}`;
                    }
                    // Convert to larger image size
                    imageUrl = imageUrl.replace("/small/", "/media/").replace("/thumb/", "/media/");
                }
                // Get prices - try multiple patterns
                const priceText = $el.find(".price-item--sale").text();
                const wasPrice = $el.find(".price__sale .price-item--regular").text();
                const salePrice = $el.find(".price-item--sale").text();
                let finalSalePrice = parsePrice(salePrice) || parsePrice(priceText);
                let originalPrice = parsePrice(wasPrice);
                // If no original price, try to find it from discount
                if (originalPrice === 0 && finalSalePrice > 0) {
                    const discountText = $el.find(".discount, .save, .off").text();
                    const discountMatch = discountText.match(/(\d+)%/);
                    if (discountMatch) {
                        const discountPercent = parseInt(discountMatch[1]);
                        originalPrice = finalSalePrice / (1 - discountPercent / 100);
                    }
                }
                // Skip if no valid prices
                if (finalSalePrice <= 0)
                    return;
                if (originalPrice <= 0)
                    originalPrice = finalSalePrice * 1.4;
                const discount = calculateDiscount(originalPrice, finalSalePrice);
                // Use a placeholder if no image
                if (!imageUrl || imageUrl.includes("undefined")) {
                    imageUrl = `https://via.placeholder.com/200x300?text=${encodeURIComponent(title.substring(0, 20))}`;
                }
                items.push({
                    title,
                    imageUrl,
                    originalPrice,
                    salePrice: finalSalePrice,
                    discount,
                    url: productUrl,
                    category,
                    source: SOURCE,
                    sourceName: getSiteName(SOURCE),
                });
            }
            catch (err) {
                console.error("Error parsing OPB product:", err);
            }
        });
        console.log(`[OPB] Scraped ${items.length} items from ${category}`);
    }
    catch (err) {
        console.error(`Error scraping ${url}:`, err);
    }
    return [items, maxPage];
}
// Scrape all OrganicPriceBooks sale categories
export async function scrapeOrganicPriceBooks() {
    const allItems = [];
    // Use the correct URLs based on web search
    const categories = [
        { url: `${BASE_URL}/collections/early-black-friday-image-sale`, name: "2025 Black Friday Sales" },
    ];
    for (const category of categories) {
        const [items, maxPage] = await scrapeCategoryPage(category.url, category.name);
        allItems.push(...items);
        if (items.length > 0) {
            // Try pagination if items were found
            let page = 2;
            let hasMore = true;
            while (hasMore && page <= parseInt(maxPage)) {
                const pageUrl = `${category.url}?page=${page}`;
                const [pageItems] = await scrapeCategoryPage(pageUrl, category.name);
                if (pageItems.length === 0) {
                    hasMore = false;
                }
                else {
                    allItems.push(...pageItems);
                    page++;
                }
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
        // Be polite - wait between requests
        await new Promise((r) => setTimeout(r, 1000));
    }
    // Dedupe by URL
    const uniqueItems = Array.from(new Map(allItems.map((item) => [item.url, item])).values());
    console.log(`[OPB] Total scraped: ${uniqueItems.length} items`);
    return uniqueItems;
}
