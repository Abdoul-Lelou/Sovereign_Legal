"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase";

interface Conversation {
    id: string;
    title: string;
    created_at: string;
}

export function Sidebar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentConvId = searchParams.get("c");
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    const fetchConversations = useCallback(async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from("conversations")
            .select("*")
            .order("created_at", { ascending: false });

        if (!error && data) {
            setConversations(data);
        }
        setIsLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Écouter les changements d'URL (currentConvId)
    // Si l'ID de la conversation dans l'URL n'est pas dans notre liste, on rafraîchit
    useEffect(() => {
        if (currentConvId && !isLoading) {
            const exists = conversations.some(c => c.id === currentConvId);
            if (!exists) {
                fetchConversations();
            }
        }
    }, [currentConvId, conversations, isLoading, fetchConversations]);

    const handleNewChat = async () => {
        const existingNewConv = conversations.find(c => c.title === "nouveau");
        if (existingNewConv) {
            router.push(`/?c=${existingNewConv.id}`);
            return;
        }

        const newConvId = crypto.randomUUID();
        const newConv = {
            id: newConvId,
            title: "nouveau",
            created_at: new Date().toISOString()
        };

        setConversations(prev => [newConv, ...prev]);
        router.push(`/?c=${newConvId}`);

        const { error } = await supabase.from("conversations").insert({
            id: newConvId,
            title: "nouveau",
        });

        if (error) {
            console.error("Erreur lors de la création de la conversation:", error);
        }
    };

    const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();

        const { error } = await supabase.from("conversations").delete().eq("id", id);
        if (!error) {
            setConversations((prev) => prev.filter((c) => c.id !== id));
            if (currentConvId === id) {
                router.push("/");
            }
        }
    };

    return (
        <div className="w-72 bg-slate-900 h-screen text-slate-300 flex flex-col font-sans shrink-0 border-r border-slate-800">
            <div className="p-6">
                <Link href="/" className="text-xl font-bold text-white tracking-wide flex items-center gap-2 mb-8">
                    <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm">⚖️</span>
                    Sovereign_Legal
                </Link>

                <button
                    onClick={handleNewChat}
                    style={{ cursor: "pointer" }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg shadow-blue-900/20"
                >
                    <Plus size={20} />
                    Nouvelle conversation
                </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col px-4">
                <h3 className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                    Historique
                </h3>

                <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                    {isLoading ? (
                        <div className="px-4 py-3 text-sm text-slate-500 italic">Chargement...</div>
                    ) : conversations.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500 italic">Aucune conversation</div>
                    ) : (
                        conversations.map((conv) => {
                            const isActive = currentConvId === conv.id;
                            return (
                                <Link
                                    key={conv.id}
                                    href={`/?c=${conv.id}`}
                                    className={`group flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive
                                        ? "bg-slate-800 text-white font-medium"
                                        : "hover:bg-slate-800/50 hover:text-white"
                                        }`}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <MessageSquare size={18} className={isActive ? "text-blue-400" : "opacity-50"} />
                                        <span className="truncate text-sm">{conv.title}</span>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </Link>
                            );
                        })
                    )}
                </div>
            </div>

            <div className="p-4 text-xs text-slate-500 text-center border-t border-slate-800">
                Assistant IA Juridique
            </div>
        </div>
    );
}
