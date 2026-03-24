"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Bot, Loader2, Info, AlertTriangle } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

// ─── Sub-component for formatted text (Markdown bold) ───────────────────────

function FormattedText({ text }: { text: string }) {
    // Basic Markdown bold parser that doesn't use dangerouslySetInnerHTML
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}

// ─── Sub-component for structured AI responses ───────────────────────────────

function StructuredResponse({ content }: { content: string }) {
    // 1. Check for warning marker
    const hasLegalWarning = content.includes("[AVERTISSEMENT_LEGAL]");
    const cleanContent = content.replace("[AVERTISSEMENT_LEGAL]", "").trim();

    // 2. Split into blocks: Intro and Knowledge Base
    const parts = cleanContent.split("### Éléments issus de la base de connaissances");
    const intro = parts[0]?.trim();
    const knowledgeBase = parts[1]?.trim();

    return (
        <div className="space-y-4">
            {/* Introductory paragraph */}
            {intro && (
                <div className="text-slate-800 leading-relaxed">
                    <FormattedText text={intro} />
                </div>
            )}

            {/* Knowledge base section */}
            {knowledgeBase && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Info size={14} className="text-blue-500" />
                        Éléments issus de la base de connaissances
                    </h4>
                    <ul className="space-y-2 list-none p-0">
                        {knowledgeBase
                            .split("\n")
                            .filter((line) => line.trim().match(/^[-•*]/))
                            .map((line, idx) => {
                                const cleanLine = line.replace(/^[-•*]\s*/, "").trim();
                                const [title, ...rest] = cleanLine.split(":");
                                return (
                                    <li key={idx} className="flex gap-2 items-start text-slate-700">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                        <span>
                                            <strong className="text-slate-900">
                                                <FormattedText text={title.trim()} />
                                            </strong>
                                            {rest.length > 0 && (
                                                <>
                                                    {" : "}
                                                    <FormattedText text={rest.join(":").trim()} />
                                                </>
                                            )}
                                        </span>
                                    </li>
                                );
                            })}
                    </ul>
                </div>
            )}

            {/* Legal Warning Card */}
            {hasLegalWarning && (
                <div className="mt-6 rounded-xl border-l-4 border-yellow-500 bg-yellow-50 p-4 shadow-sm flex gap-3 items-start animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <AlertTriangle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                    <p className="text-sm text-yellow-900 leading-relaxed font-semibold">
                        ⚠️ Cette information est fournie uniquement à titre informatif à partir de la base de connaissances disponible.
                    </p>
                </div>
            )}
        </div>
    );
}

export function Chatbot() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const conversationId = searchParams.get("c");
    const supabase = createClient();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const isSendingRef = useRef(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const loadMessages = useCallback(async (id: string) => {
        if (isSendingRef.current) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from("chat_messages")
            .select("*")
            .eq("conversation_id", id)
            .order("created_at", { ascending: true });

        if (!error && data) {
            setMessages(data.map(m => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                timestamp: new Date(m.created_at)
            })));
        }
        setIsLoading(false);
    }, [supabase]);

    // Load messages when conversationId changes
    useEffect(() => {
        if (!mounted) return;

        if (conversationId) {
            loadMessages(conversationId);
        } else {
            setMessages([
                {
                    id: "initial",
                    role: "assistant",
                    content: `Bonjour ! Je suis votre assistant juridique IA. Ma rigueur repose sur l'utilisation exclusive de ma base documentaire interne. 
Si vous ne trouvez pas une information, n'hésitez pas à télécharger un nouveau PDF : je l'intégrerai immédiatement à mon analyse pour vous éclairer. Que recherchons-nous aujourd'hui ?`,
                    timestamp: new Date(),
                },
            ]);
        }
    }, [conversationId, mounted, loadMessages]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const updateConversationTitle = async (id: string, firstMessage: string) => {
        const title = firstMessage.substring(0, 40).toLowerCase() + (firstMessage.length > 40 ? "..." : "");
        const { error } = await supabase.from("conversations").update({ title }).eq("id", id);
        if (error) {
            console.error("Erreur lors de la mise à jour du titre:", error);
        } else {
            router.refresh();
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsgContent = input;
        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: userMsgContent,
            timestamp: new Date(),
        };

        // UI OPTIMISTE : Affichage immédiat du message et du loader
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);
        isSendingRef.current = true;

        let currentConvId = conversationId;
        let dbInsertPromise: Promise<void> = Promise.resolve();

        // 1. Création asynchrone de conversation si nécessaire (Cold Start)
        if (!currentConvId) {
            currentConvId = crypto.randomUUID();
            const title = userMsgContent.substring(0, 40).toLowerCase() + (userMsgContent.length > 40 ? "..." : "");

            dbInsertPromise = (async () => {
                const { error: convError } = await supabase.from("conversations").insert({ id: currentConvId, title });
                if (convError) {
                    console.error(convError);
                } else {
                    // Update URL params sans recharger la page et de manière fluide
                    router.push(`/?c=${currentConvId}`, { scroll: false });
                }
            })();
        } else {
            const isFirstUserMessage = messages.filter(m => m.id !== "initial").length === 0;
            if (isFirstUserMessage) {
                dbInsertPromise = updateConversationTitle(currentConvId, userMsgContent);
            }
        }

        // 2. Sauvegarde asynchrone du message utilisateur (ne bloque pas l'IA)
        dbInsertPromise.then(async () => {
            const { error: msgError } = await supabase.from("chat_messages").insert({
                conversation_id: currentConvId,
                role: "user",
                content: userMsgContent
            });
            if (msgError) console.error(msgError);
        });

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMsgContent,
                    history: messages.filter(m => m.id !== "initial"),
                    session_id: currentConvId
                }),
            });

            if (!response.ok) {
                throw new Error("Erreur de connexion au serveur");
            }

            const data = await response.json();

            const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.response,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, botMessage]);

            // Save assistant message to DB
            supabase.from("chat_messages").insert({
                conversation_id: currentConvId,
                role: "assistant",
                content: data.response
            }).then(({ error: botMsgError }) => {
                if (botMsgError) console.error(botMsgError);
            });

        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "Désolé, j'ai rencontré une difficulté pour traiter votre demande. Veuillez réessayer plus tard.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            isSendingRef.current = false;
        }
    };

    return (
        <div className="flex flex-col h-full max-w-5xl mx-auto w-full">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex items-start gap-4 ${message.role === "assistant" ? "justify-start" : "justify-end"
                            }`}
                    >
                        {message.role === "assistant" && (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                                <Bot size={18} className="text-white" />
                            </div>
                        )}

                        <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base leading-relaxed ${message.role === "assistant"
                                ? "bg-white border border-slate-200 text-slate-800 shadow-sm"
                                : "bg-blue-600 text-white shadow-md shadow-blue-100"
                                }`}
                        >
                            {message.role === "assistant" && message.id === "initial" ? (
                                <div className="whitespace-pre-wrap">{message.content}</div>
                            ) : message.role === "assistant" ? (
                                <StructuredResponse content={message.content} />
                            ) : (
                                <div className="whitespace-pre-wrap">{message.content}</div>
                            )}

                            <div
                                className={`text-[10px] mt-2 opacity-50 ${message.role === "assistant" ? "text-slate-500" : "text-blue-100"
                                    }`}
                            >
                                {mounted && message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>

                        {message.role === "user" && (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                                <User size={18} className="text-slate-600" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && messages.length > 0 && (
                    <div className="flex items-start gap-4 animate-in fade-in duration-300">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
                            <Bot size={18} className="text-white" />
                        </div>
                        <div className="bg-white border border-slate-200 text-slate-600 rounded-2xl px-5 py-3 shadow-sm flex items-center gap-3">
                            <Loader2 className="animate-spin text-blue-500" size={18} />
                            <span className="text-sm font-medium animate-pulse">Recherche et analyse en cours...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 md:p-6 border-t border-slate-200 bg-white/50 backdrop-blur-sm">
                <div className="flex gap-4 items-center max-w-4xl mx-auto relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Posez votre question juridique ici..."
                        rows={1}
                        className="flex-1 rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none shadow-sm pr-12 text-slate-800 bg-white"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className={`absolute right-2 top-1.5 p-2 rounded-lg transition-all ${input.trim() && !isLoading
                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200"
                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            }`}
                    >
                        <Send size={20} />
                    </button>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500 uppercase tracking-widest font-semibold">
                    <Info size={12} strokeWidth={3} />
                    Attention : Les réponses sont fournies à titre informatif à partir de la base de connaissances disponible.
                </div>
            </div>
        </div>
    );
}
