import Fastify, { type FastifyInstance, type RouteShorthandOptions } from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";

import { scrapeAllSources } from "./server/scrapers/index.ts";

const server: FastifyInstance = Fastify({});

const opts: RouteShorthandOptions = {
    schema: {
        body: {
            type: "object",
            properties: {
                
            }
        }
    }
}

server.get("/scrape", async (request, reply) => {

    try {
        const scrapedResults = await scrapeAllSources();
        
        const moreThanOne = scrapedResults.filter(item => item.prices.length > 1);

        console.log("Hello", moreThanOne);

        return scrapedResults;
    
    } catch (err) {
        reply.code(500).send({error: err});
    }
})


const start = async () => {
    try {
        await server.listen({ port: 3005, host: "0.0.0.0" });

        const address = server.server.address();
        const port = typeof address === "string" ? address : address?.port;

        console.log("Listening on port:", port);

    } catch (err) {
        server.log.error(err)
        process.exit(1)
    }
}

start()