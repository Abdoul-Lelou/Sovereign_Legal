import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createAdminClient } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import dns from "node:dns";

dns.setDefaultResultOrder('ipv4first');

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendProgress = (type: string, message: string, progress: number) => {
                controller.enqueue(encoder.encode(JSON.stringify({ type, message, progress }) + "\n"));
            };

            try {
                const formData = await req.formData();
                const file = formData.get("file") as File;

                if (!file) {
                    sendProgress("error", "Aucun fichier n'a été fourni", 0);
                    controller.close();
                    return;
                }

                // 1. Extract text from PDF
                sendProgress("start", "Extraction du texte du PDF...", 5);
                const workerPath = `file://${process.cwd()}/node_modules/pdfjs-dist/build/pdf.worker.mjs`;
                PDFParse.setWorker(workerPath);

                const buffer = Buffer.from(await file.arrayBuffer());
                const parser = new PDFParse({ data: buffer });
                const pdfData = await parser.getText();
                const fullText = pdfData.text;

                if (!fullText || fullText.trim().length === 0) {
                    sendProgress("error", "Le PDF est vide ou n'a pas pu être lu", 0);
                    controller.close();
                    return;
                }

                // 2. Chunk text
                sendProgress("chunking", "Découpage du texte en segments...", 10);
                const splitter = new RecursiveCharacterTextSplitter({
                    chunkSize: 1000,
                    chunkOverlap: 200,
                });
                const chunks = await splitter.createDocuments([fullText]);

                // 3. Generate Case ID
                const caseId = uuidv4();
                const supabase = createAdminClient();

                // 4. Batch generate embeddings
                sendProgress("generating", `Génération des embeddings pour ${chunks.length} segments...`, 15);
                const chunkTexts = chunks.map(c => c.pageContent);
                const allEmbeddings: any[] = [];
                const BATCH_SIZE = 100;
                const totalBatches = Math.ceil(chunkTexts.length / BATCH_SIZE);

                for (let i = 0; i < chunkTexts.length; i += BATCH_SIZE) {
                    const batchIndex = Math.floor(i / BATCH_SIZE);
                    const batch = chunkTexts.slice(i, i + BATCH_SIZE);

                    sendProgress("embedding", `Traitement du sous-lot ${batchIndex + 1}/${totalBatches}...`, 15 + Math.floor((batchIndex / totalBatches) * 70));

                    const embeddingResponse = await genAI.models.embedContent({
                        model: "gemini-embedding-001",
                        contents: batch.map(text => ({ parts: [{ text }] })),
                        config: {
                            taskType: "RETRIEVAL_DOCUMENT",
                            outputDimensionality: 1536
                        }
                    });

                    if (embeddingResponse.embeddings) {
                        allEmbeddings.push(...embeddingResponse.embeddings);
                    }
                }

                if (allEmbeddings.length !== chunks.length) {
                    throw new Error(`Échec de la génération des embeddings. Attendu ${chunks.length}, reçu ${allEmbeddings.length}`);
                }

                // 5. Batch insert
                sendProgress("inserting", `Insertion de ${chunks.length} lignes dans la base de connaissance...`, 90);
                const rowsToInsert = chunks.map((doc, index) => ({
                    case_id: caseId,
                    content: doc.pageContent,
                    embedding: allEmbeddings[index].values,
                    metadata: {
                        source: file.name,
                        chunk_index: index,
                        total_chunks: chunks.length,
                        date: new Date().toISOString(),
                    },
                }));

                const { error: insertError } = await supabase.from("case_embeddings_chat").insert(rowsToInsert);

                if (insertError) {
                    console.error("Supabase insert error:", insertError);
                    throw insertError;
                }

                sendProgress("success", "Document traité et indexé avec succès.", 100);
                controller.close();
            } catch (error: any) {
                console.error("Processing error:", error);
                sendProgress("error", error.message || "Erreur interne du serveur", 0);
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
