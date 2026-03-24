
const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });

async function test() {
    console.log("Listing models...");
    try {
        const list = await genAI.models.list();
        // In this SDK, list() might return an async iterator or a paginated response
        // Let's try to iterate or check if it's an array somewhere
        for await (const model of list) {
            console.log("Model:", model.name, "Capabilities:", model.supportedMethods);
        }
    } catch (error) {
        console.error("List Models Failed:", error.message);
    }
}

test();
