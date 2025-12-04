/**
 * Cheap Graphic Novels Web Scraper
 * Scrapes discount deals from the Bargain Bin section
 * Uses Puppeteer to handle pagination and JavaScript-rendered content
 */

import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import type { ScrapedItem } from "../schema/schema";
import { parsePrice, calculateDiscount, getSiteName } from "../utils/utils";

const SOURCE: "cheapgraphicnovels" = "cheapgraphicnovels";
const BASE_URL = "https://cheapgraphicnovels.com";

/**
 * Get subcategory links from the bargain bin page
 * Parses the main bargain bin page to find all subcategory links
 */
async function getSubcategoryLinks(): Promise<string[]> {
  const links: string[] = [];

  try {
    console.log(`[CGN] Fetching subcategory links from ${BASE_URL}/bargain-bin/`);
    const response = await fetch(`${BASE_URL}/bargain-bin/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      console.error(`[CGN] Failed to fetch bargain bin: ${response.status}`);
      return links;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find links under block-subcategories class as specified by user
    $(".block-subcategories a").each((_, element) => {
      const href = $(element).attr("href");
      if (href) {
        const fullUrl = href.startsWith("http") ? href : `${BASE_URL}/${href}`;
        if (!links.includes(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });

    // Also try other common patterns for robustness
    $("[class*='subcategor'] a, .subcategories a, .category-list a").each((_, element) => {
      const href = $(element).attr("href");
      if (href && (href.includes("bargain") || href.includes("sale") || href.includes("clearance"))) {
        const fullUrl = href.startsWith("http") ? href : `${BASE_URL}/${href}`;
        if (!links.includes(fullUrl)) {
          links.push(fullUrl);
        }
      }
    });

    console.log(`[CGN] Found ${links.length} subcategory links`);
  } catch (err) {
    console.error("[CGN] Error getting subcategory links:", err);
  }

  return links;
}

/**
 * Scrape products from a category page with pagination
 * Uses Puppeteer to navigate through all pages of a category
 * 
 * @param startUrl - The URL to start scraping
 * @returns Array of scraped items from all pages
 */
async function scrapeCategoryWithPagination(startUrl: string): Promise<ScrapedItem[]> {
  const allItems: ScrapedItem[] = [];
  let browser = null;

  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    let currentUrl: string | null = startUrl;
    let pageNumber = 1;
    let maxPages = 1;

    // Paginate through all pages
    while (currentUrl && pageNumber <= maxPages) {
      try {
        console.log(`[CGN] Scraping page ${pageNumber}: ${currentUrl}`);

        // Navigate to page
        await page.goto(currentUrl, { waitUntil: "networkidle2" });

        // Wait for products to load
        await page.waitForSelector(".product-cell, .product-layout, .product-thumb, .product-item, .product", {
          timeout: 10000,
        }).catch(() => {
          console.log("[CGN] No products selector found on page");
        });

        // Extract page HTML
        const html = await page.content();
        const $ = cheerio.load(html);

        // Find product containers
        const productSelectors = [
          ".product-cell",
        ];

        let $products = $();
        for (const selector of productSelectors) {
          const found = $(selector);
          if (found.length > 0) {
            $products = found;
            console.log(`[CGN] Found ${found.length} products with selector: ${selector}`);
            break;
          }
        }

        // Parse each product
        $products.each((_, element) => {
          try {
            const $el = $(element);

            // Extract title
            const titleEl = $el.find(".name a, .product-name a, h4 a, h3 a, .title a, a[href*='product']").first();
            const title = titleEl.text().trim();
            if (!title || title.length < 3) return;

            // Extract product URL
            let href = titleEl.attr("href");
            if (!href) return;
            if (!href.startsWith("http")) {
              href = href.startsWith("/") ? href : `/${href}`;
            }
            const productUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

            // Extract and normalize image URL
            const imgEl = $el.find("img").first();
            let imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
            if (imageUrl) {
              if (imageUrl.startsWith("//")) {
                imageUrl = `https:${imageUrl}`;
              } else if (!imageUrl.startsWith("http")) {
                imageUrl = `${BASE_URL}${imageUrl}`;
              }
            }

            // Extract pricing
            const newPriceText = $el.find(".price, product-price").text();
            const youSaveText = $el.find(".you-save").text();

            let salePrice = parsePrice(newPriceText);
            let originalPrice = parsePrice(newPriceText) + parsePrice(youSaveText);

            // Skip if no valid sale price
            if (salePrice <= 0) return;
            if (originalPrice <= 0) originalPrice = salePrice * 1.4;

            const discount = calculateDiscount(originalPrice, salePrice);

            // Use placeholder if no image
            if (!imageUrl || imageUrl.includes("undefined")) {
              imageUrl = `https://via.placeholder.com/200x300?text=${encodeURIComponent(title.substring(0, 20))}`;
            }

            allItems.push({
              title,
              imageUrl,
              originalPrice,
              salePrice,
              discount,
              url: productUrl,
              category: "Bargain Bin",
              source: SOURCE,
              sourceName: getSiteName(SOURCE),
            });
          } catch (err) {
            console.error("[CGN] Error parsing product:", err);
          }
        });

        console.log(`[CGN] Found ${$products.length} product elements on page ${pageNumber}`);

        // Find and evaluate next page button
        const nextPageUrl = await page.evaluate(() => {
          const selectors = [
            '[title="Next page"]'
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
              const href = element.getAttribute("href");
              if (href) return href;
            }
          }
          return null;
        });

        if (nextPageUrl) {
          currentUrl = nextPageUrl.startsWith("http") ? nextPageUrl : `${BASE_URL}/${nextPageUrl}`;
          pageNumber++;
          maxPages = pageNumber + 1;
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          currentUrl = null;
        }
      } catch (err) {
        console.error(`[CGN] Error scraping page ${pageNumber}:`, err);
        currentUrl = null;
      }
    }

    console.log(`[CGN] Finished scraping after ${pageNumber - 1} pages, found ${allItems.length} items`);
  } catch (err) {
    console.error("[CGN] Error in scrapeCategoryWithPagination:", err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return allItems;
}

/**
 * Main scraper for Cheap Graphic Novels
 * Scrapes the bargain bin and all subcategories
 */
export async function scrapeCheapGraphicNovels(): Promise<ScrapedItem[]> {
  const allItems: ScrapedItem[] = [];

  // Get all subcategory links
  const subcategoryLinks = await getSubcategoryLinks();

  // Create list of pages to scrape (main bargain bin + subcategories)
  const pagesToScrape = [`${BASE_URL}/bargain-bin/`, ...subcategoryLinks];

  console.log(`[CGN] Starting to scrape ${pagesToScrape.length} category pages`);

  // Scrape each category
  for (const pageUrl of pagesToScrape) {
    const items = await scrapeCategoryWithPagination(pageUrl);
    allItems.push(...items);

    // Be polite between categories
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Remove duplicates by URL
  const uniqueItems = Array.from(
    new Map(allItems.map((item) => [item.url, item])).values()
  );

  console.log(`[CGN] Total scraped: ${uniqueItems.length} unique items from ${pagesToScrape.length} categories`);
  return uniqueItems;
}