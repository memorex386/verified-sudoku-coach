import OpenAI from "openai/helpers/zod";

export const unsafeBrowserClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
