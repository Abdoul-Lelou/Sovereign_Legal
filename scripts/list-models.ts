
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

async function listModels() {
    try {
        const response = await genAI.models.list();
        console.log("Available models:");
        for await (const model of response) {
            console.log(`- ${model.name} (${model.supportedMethods?.join(", ") || "no methods"})`);
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
