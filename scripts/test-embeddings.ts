
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

async function testTruncation() {
    try {
        console.log(`Testing gemini-embedding-001 with outputDimensionality: 1536`);
        const result = await genAI.models.embedContent({
            model: "gemini-embedding-001",
            contents: ["Hello world"],
            config: {
                outputDimensionality: 1536
            }
        });
        if (!result.embeddings || result.embeddings.length === 0) {
            throw new Error("No embeddings returned from the API");
        }
        console.log(`Success! Dimension: ${result.embeddings[0].values.length}`);
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
    }
}

testTruncation();
