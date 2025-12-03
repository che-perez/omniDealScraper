import Fastify from "fastify";
import { VercelRequest, VercelResponse } from "@vercel/node";
import * as dotenv from "dotenv";
dotenv.config();

const app = Fastify({
    logger: true,
})

app.register(import("./server/server"));

export default async (req: VercelRequest, res: VercelResponse) => {

    // Ready Fastify and Connect MongoDb
    await app.ready();

    // Forward the request to Fastify
    app.server.emit('request', req, res);
};