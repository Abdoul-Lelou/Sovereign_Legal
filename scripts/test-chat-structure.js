
require('dotenv').config();

async function testChatStructure() {
    console.log("Testing Chat API for structured response...");
    try {
        const response = await fetch("http://localhost:3000/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Quelles sont les clauses types d'un contrat de travail OHADA ?",
                history: []
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        console.log("\n--- API RESPONSE ---");
        console.log(data.response);
        console.log("\n--- CHECKLIST ---");
        console.log("Contains '### Éléments issus de la base de connaissances':", data.response.includes("### Éléments issus de la base de connaissances"));
        console.log("Contains '[AVERTISSEMENT_LEGAL]':", data.response.includes("[AVERTISSEMENT_LEGAL]"));

    } catch (error) {
        console.error("Test failed:", error.message);
    }
}

testChatStructure();
