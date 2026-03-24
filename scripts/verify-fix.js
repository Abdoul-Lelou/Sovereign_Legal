
const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY });
const TARGET_DIMENSION = 1536;
const EMBEDDING_MODEL = "gemini-embedding-001";

async function verify() {
    console.log("Verifying Embedding Dimensionality...");
    try {
        const embeddingResult = await genAI.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: [{ parts: [{ text: "Bonjour" }] }],
        });

        const fullEmbedding = embeddingResult.embeddings?.[0]?.values;
        if (!fullEmbedding || fullEmbedding.length === 0) {
            throw new Error("Embedding failed");
        }

        console.log("Original Dimensionality:", fullEmbedding.length);

        // Logic from route.ts
        const queryEmbedding = fullEmbedding.slice(0, TARGET_DIMENSION);
        if (queryEmbedding.length < TARGET_DIMENSION) {
            while (queryEmbedding.length < TARGET_DIMENSION) queryEmbedding.push(0);
        }

        console.log("Processed Dimensionality:", queryEmbedding.length);

        if (queryEmbedding.length === TARGET_DIMENSION) {
            console.log("✅ Verification Successful: Dimensionality matched target (1536)");
        } else {
            console.error("❌ Verification Failed: Dimensionality mismatch");
        }
    } catch (error) {
        console.error("Verification Error:", error.message);
    }
}

verify();
