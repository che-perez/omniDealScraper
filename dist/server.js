import Fastify from "fastify";
import { MongoClient } from 'mongodb';
import '@dotenvx/dotenvx/config';
import { storage } from "./server/storage.js";
import { env } from './server/schema/env.js';
// MongoDB Connection String
const MONGODB_URI = env.MONGODB_URI;
const DB_NAME = "OmniDeal";
const COLLECTION_NAME = "scrapeData";
// MongoDB Client Initialization
let productsCollection;
let mongoClient;
export async function connectToMongoDB() {
    try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        const db = mongoClient.db(DB_NAME);
        productsCollection = db.collection(COLLECTION_NAME);
        console.log('Connected to MongoDB successfully!');
    }
    catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        // Exit process or handle error appropriately if DB connection is critical
        throw error;
    }
}
const server = Fastify({
    logger: true
});
server.get('/', async (request, reply) => {
    const msg = { OMNI_DEALS: 'Scraper API' };
    return reply.send(msg);
});
server.get("/products", async (request, reply) => {
    try {
        if (!productsCollection) {
            reply.code(500).send({ error: "Database not connected" });
        }
        const products = await productsCollection.find({}).toArray();
        const status = storage.getStatus();
        reply.code(200).header('Content-Type', 'application/json');
        return reply.send({ products, status });
    }
    catch (err) {
        console.error("Error getting products:", err);
        reply.code(500).send({ error: "Failed to get products" });
    }
});
server.post("/scrape", async (request, reply) => {
    try {
        const status = storage.getStatus();
        if (status.isScaping) {
            return reply.code(409).send({ error: "Scrape already in progress", status });
        }
        reply.send({ message: "Scrape started", status: { ...status, isScalping: true } });
        await storage.scrapeProducts(productsCollection);
    }
    catch (err) {
        console.error("Error scraping:", err);
    }
});
server.get("/status", async (request, reply) => {
    try {
        // Retrive the current scrape status from storage
        const status = storage.getStatus();
        reply.send({ status });
    }
    catch (err) {
        console.error("Error getting status", err);
        reply.code(500).send({ error: "Failed to get status" });
    }
});
await connectToMongoDB();
export default server;
