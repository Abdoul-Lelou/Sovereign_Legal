import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase";
import dns from "node:dns";

dns.setDefaultResultOrder("ipv4first");

const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEMINI_API_KEY! });

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_ID = "gemini-3.1-flash-lite-preview";
const EMBEDDING_MODEL = "gemini-embedding-001";
const TARGET_DIMENSION = 1536;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 10;
const MATCH_THRESHOLD = 0.1;
const MATCH_COUNT = 5;

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionCategory = "GREETING" | "IN_DOMAIN" | "OUT_OF_DOMAIN";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface MatchDocument {
  content: string;
  metadata?: { source?: string };
}

// ─── Classification Prompt ────────────────────────────────────────────────────
// Lightweight call (temperature=0, maxTokens=10) — runs before any RAG.
// Three categories to route each message to the correct handler.

const CLASSIFICATION_PROMPT = `Tu es un classificateur strict. Analyse le message de l'utilisateur et classe-le dans l'une de ces trois catégories :

GREETING
→ salutations, politesse, remerciements, questions sur l'identité ou le rôle de l'assistant, questions sur ce que peut faire le chat.
Exemples : "bonjour", "qui es-tu ?", "que peux-tu faire ?", "comment ça marche ?", "merci", "au revoir", "hello"

IN_DOMAIN
→ questions portant sur le droit OHADA (sociétés, contrats, recouvrement, arbitrage, comptabilité, sûretés, etc.) ou le droit minier en Guinée (code minier, permis, concessions, exploitation, environnement minier, etc.)

OUT_OF_DOMAIN
→ toute autre question sans rapport avec le droit OHADA ou le droit minier en Guinée.

Réponds UNIQUEMENT par l'un de ces trois mots exacts, sans ponctuation ni explication :
GREETING
IN_DOMAIN
OUT_OF_DOMAIN`;

// ─── Greeting System Prompt ───────────────────────────────────────────────────
// Used ONLY for GREETING messages — no RAG, no context needed.

const GREETING_SYSTEM_INSTRUCTION = `Tu es un assistant juridique spécialisé dans le droit OHADA et le droit minier en Guinée.

Réponds de manière chaleureuse, concise et professionnelle aux salutations et questions générales sur ton identité ou tes capacités.

RÈGLES :
- Si on te salue : réponds poliment et présente-toi brièvement.
- Si on te demande qui tu es ou ce que tu fais : explique ton rôle clairement.
- Si on te demande ce que tu peux faire : explique que tu peux répondre à des questions sur le droit OHADA et le droit minier en Guinée, à partir d'une base de connaissances interne.
- Ne mentionne jamais de modèle d'IA, d'API ou de technologie sous-jacente.
- Reste toujours dans ton rôle d'assistant juridique.
- Ne fournis aucun conseil juridique dans cette réponse.`;

// ─── RAG System Prompt ────────────────────────────────────────────────────────
// Used ONLY for IN_DOMAIN messages — after semantic search in Supabase.

const RAG_SYSTEM_INSTRUCTION = `Tu es un assistant juridique expert spécialisé dans le droit OHADA et le droit minier en Guinée.

RÈGLE ABSOLUE :
Tu ne dois jamais inventer d'information, de loi, d'arrêt ou d'article.
Toutes les informations doivent provenir exclusivement du CONTEXTE fourni dans chaque message.

CONSIGNES DE STRUCTURE (OBLIGATOIRES) :

1. PARAGRAPHE EXPLICATIF
Réponds directement à la question de manière claire et structurée.

2. ÉLÉMENTS ISSUS DE LA BASE DE CONNAISSANCES
Ajoute SYSTEMATIQUEMENT une section intitulée exactemenent : 
### Éléments issus de la base de connaissances
Sous ce titre, fournis une liste à puces résumant les points clés extraits du contexte. 
Chaque puce doit être au format : **Titre de l'élément** : Explication concise.
Exemples de titres (si présents) : Nature du document, Modèle de référence, Champ d'application, Contenu du contrat, Droits des tiers, Numérotation, etc. Ne liste QUE ce qui est présent dans le contexte.

3. AVERTISSEMENT LÉGAL
Termine TOUJOURS ta réponse par la ligne exacte suivante :
[AVERTISSEMENT_LEGAL]

INTERDICTIONS :
- Ne mentionne jamais "Aucun document trouvé" si des extraits sont présents.
- Si le contexte est vide, réponds : "Je ne dispose pas d'informations suffisantes dans la base de connaissances pour répondre à cette question." et finis par [AVERTISSEMENT_LEGAL].`;

// ─── Fixed response for out-of-domain questions ───────────────────────────────

const OUT_OF_DOMAIN_RESPONSE =
  "Je suis spécialisé uniquement dans le droit OHADA et le droit minier en Guinée.\nJe ne peux donc pas répondre à cette question.";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Classifies the message into one of three categories:
 * - GREETING     : salutation, identity/capability question
 * - IN_DOMAIN    : OHADA or Guinea mining law question
 * - OUT_OF_DOMAIN: anything else
 *
 * Uses temperature=0, maxOutputTokens=10 for speed and determinism.
 * Falls back to IN_DOMAIN on error to never silently block real questions.
 */
async function classifyMessage(message: string): Promise<QuestionCategory> {
  try {
    const result = await genAI.models.generateContent({
      model: MODEL_ID,
      config: { temperature: 0, maxOutputTokens: 10 },
      contents: [
        {
          role: "user",
          parts: [{ text: `${CLASSIFICATION_PROMPT}\n\nMessage : ${message}` }],
        },
      ],
    });
    const label = result.text?.trim().toUpperCase() as QuestionCategory;
    if (label === "GREETING" || label === "IN_DOMAIN" || label === "OUT_OF_DOMAIN") {
      return label;
    }
    return "IN_DOMAIN"; // safe default
  } catch {
    return "IN_DOMAIN"; // never block on classifier failure
  }
}

function buildGeminiHistory(history: ChatMessage[]) {
  const turns = history.slice(-MAX_HISTORY_TURNS * 2);
  return turns.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

function buildContextString(documents: MatchDocument[]): string {
  if (!documents || documents.length === 0) {
    return "Aucun document pertinent trouvé dans la base de connaissances pour cette requête.";
  }
  return documents
    .map(
      (doc, i) =>
        `[Extrait ${i + 1}] Source : ${doc.metadata?.source ?? "Inconnue"}\n${doc.content}`
    )
    .join("\n\n---\n\n");
}

/** Fire-and-forget DB persistence — never blocks the HTTP response. */
function persistMessages(
  supabase: ReturnType<typeof createAdminClient>,
  userMsg: string,
  assistantMsg: string,
  sessionId?: string
) {
  (async () => {
    try {
      await supabase.from("chat_messages").insert([
        {
          role: "user",
          content: userMsg,
          session_id: sessionId ?? null,
          created_at: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: assistantMsg,
          session_id: sessionId ?? null,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("Failed to persist chat messages:", err);
    }
  })();
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [], session_id } = body as {
      message: string;
      history: ChatMessage[];
      session_id?: string;
    };

    // ── Input validation ──────────────────────────────────────────────────────
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message manquant." }, { status: 400 });
    }
    if (message.trim().length === 0) {
      return NextResponse.json({ error: "Message vide." }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message trop long (max ${MAX_MESSAGE_LENGTH} caractères).` },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // ── 1. Classify the message ───────────────────────────────────────────────
    const category = await classifyMessage(message);

    // ── 2a. GREETING ─ respond warmly without RAG ────────────────────────────
    if (category === "GREETING") {
      const result = await genAI.models.generateContent({
        model: MODEL_ID,
        config: {
          systemInstruction: GREETING_SYSTEM_INSTRUCTION,
          temperature: 0.5,
          maxOutputTokens: 500,
        },
        contents: [
          ...buildGeminiHistory(history),
          { role: "user", parts: [{ text: message }] },
        ],
      });

      const responseText = result.text ?? "Bonjour ! Comment puis-je vous aider ?";
      persistMessages(supabase, message, responseText, session_id);
      return NextResponse.json({ response: responseText, sources: [] }, { status: 200 });
    }

    // ── 2b. OUT_OF_DOMAIN ─ fixed response, no LLM generation needed ─────────
    if (category === "OUT_OF_DOMAIN") {
      persistMessages(supabase, message, OUT_OF_DOMAIN_RESPONSE, session_id);
      return NextResponse.json(
        { response: OUT_OF_DOMAIN_RESPONSE, sources: [] },
        { status: 200 }
      );
    }

    // ── 2c. IN_DOMAIN ─ full RAG pipeline ────────────────────────────────────

    // Step A: Generate query embedding
    const embeddingResult = await genAI.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [{ parts: [{ text: message }] }],
    });

    const fullEmbedding = embeddingResult.embeddings?.[0]?.values;
    if (!fullEmbedding || fullEmbedding.length === 0) {
      throw new Error("La génération d'embedding a échoué.");
    }

    // Truncate or pad to exactly TARGET_DIMENSION (1536) for Supabase
    const queryEmbedding = fullEmbedding.slice(0, TARGET_DIMENSION);
    if (queryEmbedding.length < TARGET_DIMENSION) {
      // Pad with zeros if it's somehow shorter
      while (queryEmbedding.length < TARGET_DIMENSION) queryEmbedding.push(0);
    }

    // Step B: Semantic search in Supabase
    const { data: documents, error: searchError } = await supabase.rpc(
      "match_case_embeddings_chat",
      {
        query_embedding: queryEmbedding,
        match_threshold: MATCH_THRESHOLD,
        match_count: MATCH_COUNT,
      }
    );

    if (searchError) {
      console.error("Supabase RPC error:", searchError);
      throw new Error("Erreur lors de la recherche dans la base de connaissances.");
    }

    // Step C: Build context — sentinel phrase "Aucun document pertinent trouvé"
    // triggers the "pas d'info suffisante" message in the LLM (RAG rule 3).
    const contextString = buildContextString(documents);

    // Step D: Generate answer grounded in the retrieved context
    const userMessageWithContext = `CONTEXTE (base de connaissances) :\n${contextString}\n\n---\n\nQUESTION : ${message}`;

    const ragResult = await genAI.models.generateContent({
      model: MODEL_ID,
      config: {
        systemInstruction: RAG_SYSTEM_INSTRUCTION,
        temperature: 0.2,
        maxOutputTokens: 4096,
      },
      contents: [
        ...buildGeminiHistory(history),
        { role: "user", parts: [{ text: userMessageWithContext }] },
      ],
    });

    const responseText = ragResult.text;
    if (!responseText) {
      throw new Error("La génération de la réponse a échoué (réponse vide).");
    }

    persistMessages(supabase, message, responseText, session_id);

    return NextResponse.json(
      {
        response: responseText,
        sources:
          documents
            ?.map((d: MatchDocument) => d.metadata?.source)
            .filter(Boolean) ?? [],
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error.message ?? "Erreur interne du serveur." },
      { status: 500 }
    );
  }
}