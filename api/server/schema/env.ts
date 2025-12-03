import { z } from "zod";

const envSchema = z.object({
    MONGODB_URI: z.string()
});

envSchema.parse(process.env);

declare global {
    namespace NodeJs {
        interface ProcessEnv extends z.infer<typeof envSchema>{}
}}