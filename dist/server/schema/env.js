import { z } from "zod";
const envSchema = z.object({
    MONGODB_URI: z.string()
});
export const env = envSchema.parse(process.env);
