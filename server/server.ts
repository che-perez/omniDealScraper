import Fastify, { type FastifyInstance, type RouteShorthandOptions } from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import { MongoClient, Collection } from 'mongodb';

import { storage } from "./storage.ts";

// MongoDB Connection String
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "OmniDeal";
const COLLECTION_NAME = "scrapeData";

// MongoDB Client Initialization
let productsCollection: Collection;
let mongoClient: MongoClient;

export async function connectToMongoDB() {
    try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        const db = mongoClient.db(DB_NAME);
        productsCollection = db.collection(COLLECTION_NAME);
        console.log('Connected to MongoDB successfully!');
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        // Exit process or handle error appropriately if DB connection is critical
        process.exit(1);
    }
}

export default function buildServer() {

    const server: FastifyInstance = Fastify({
    logger: true
    });

    server.get("/products", async (request, reply) => {
        try {

            const products = await productsCollection.find({}).toArray();

            const status = storage.getStatus();

            reply.send({ products, status });

        } catch(err) {
            console.error("Error getting products:", err);
            reply.code(500).send({ error: "Failed to get products" });
        }
    }),

    server.post("/scrape", async (request, reply) => {
        try {
            const status = storage.getStatus();

            if(status.isScaping) {
                return reply.code(409).send({ error: "Scrape already in progress", status });
            }

            reply.send({ message: "Scrape started", status: { ...status, isScalping: true }});
            
            await storage.scrapeProducts(productsCollection);
            
        } catch (err) {
            console.error("Error scraping:", err);
        }
    }),

    server.get("/status", async (request, reply) => {
        try {
            // Retrive the current scrape status from storage
            const status = storage.getStatus();
            reply.send({ status });
        } catch (err) {
            console.error("Error getting status", err);
            reply.code(500).send({ error: "Failed to get status" });
        }
    })

    server.addHook('onReady', async () => {
        await connectToMongoDB();
    });

    server.addHook('onClose', async () => {
        if(mongoClient) {
            await mongoClient.close();
            console.log("MongoDB connection clossed.");
        }
    });

    return server;
}


// const start = async () => {
//     await connectToMongoDB(); // Connect to MongoDB before starting the server

//     try {
//         await server.listen({ port: 3005, host: "0.0.0.0" });

//         const address = server.server.address();
//         const port = typeof address === "string" ? address : address?.port;

//         console.log("Listening on port:", port);

//     } catch (err) {
//         server.log.error(err)
//         process.exit(1)
//     }
// }

// start()

// // --- Graceful Shutdown ---
// // Ensure the MongoDB connection is closed when the server shuts down.
// process.on('SIGINT', async () => {
//     server.log.info('Shutting down server...');
//     await server.close();
//     if (mongoClient) {
//         await mongoClient.close();
//         server.log.info('MongoDB connection closed.');
//     }
//     process.exit(0);
// });

// // Handle unhandled promise rejections
// process.on('unhandledRejection', (err) => {
//     server.log.error('Unhandled Rejection:', err);
// });