import { VercelRequest, VercelResponse } from "@vercel/node";
import buildServer from "../server/index.ts";

const app = buildServer();

export default async (req: VercelRequest, res: VercelResponse) => {

    // Ready Fastify and Connect MongoDb
    await app.ready();

    // Forward the request to Fastify
    app.server.emit('request', req, res);
};