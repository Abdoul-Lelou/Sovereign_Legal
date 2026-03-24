"use client";

import { useState } from "react";
import { Upload, File, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function PDFUploader() {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const [progress, setProgress] = useState(0);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== "application/pdf") {
                setStatus("error");
                setMessage("Veuillez sélectionner un fichier PDF valide.");
                return;
            }
            if (selectedFile.size > 8 * 1024 * 1024) {
                setStatus("error");
                setMessage("La taille du fichier dépasse la limite autorisée de 10 MB.");
                return;
            }
            setFile(selectedFile);
            setStatus("idle");
            setMessage("");
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setStatus("uploading");
        setProgress(0);
        setMessage("Démarrage du traitement...");

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Erreur lors de l'envoi du fichier.");
            }

            if (!response.body) {
                throw new Error("Aucun flux de réponse reçu.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;

            while (!done) {
                const { value, done: doneReading } = await reader.read();
                done = doneReading;
                if (value) {
                    const chunk = decoder.decode(value, { stream: !done });
                    const lines = chunk.split("\n").filter(line => line.trim() !== "");

                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            if (data.type === "error") {
                                throw new Error(data.message);
                            }
                            setProgress(data.progress);
                            setMessage(data.message);
                            if (data.type === "success") {
                                setStatus("success");
                                setFile(null);
                            }
                        } catch (e) {
                            console.error("Error parsing stream chunk:", e);
                        }
                    }
                }
            }
        } catch (err: unknown) {
            const error = err as Error;
            console.error("Upload error:", error);
            setStatus("error");
            setMessage(error.message || "Une erreur est survenue lors du traitement du PDF.");
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
            <div
                className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center transition-colors ${file ? "border-blue-400 bg-blue-50/30" : "border-slate-200 hover:border-slate-300"
                    }`}
            >
                <input
                    type="file"
                    id="pdf-input"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleFileChange}
                    disabled={status === "uploading"}
                />

                {!file ? (
                    <label
                        htmlFor="pdf-input"
                        className="cursor-pointer flex flex-col items-center group"
                    >
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                            <Upload className="text-slate-400 group-hover:text-blue-500" size={32} />
                        </div>
                        <p className="text-lg font-medium text-slate-700">Cliquez pour téléverser un PDF</p>
                        <p className="text-sm text-slate-500 mt-1">ou glissez-déposez le fichier ici</p>
                        <p className="text-xs text-rose-500 font-medium mt-2 flex gap-1 items-center">
                            <AlertCircle size={14} /> Attention : Taille maximale 10 MB
                        </p>
                    </label>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <File className="text-blue-600" size={32} />
                        </div>
                        <p className="text-lg font-medium text-slate-800">{file.name}</p>
                        <p className="text-sm text-slate-500 mb-6">{(file.size / 1024 / 1024).toFixed(2)} MB</p>

                        {status !== "uploading" && (
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setFile(null)}
                                    className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors font-medium border border-slate-200"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleUpload}
                                    className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium shadow-md shadow-blue-200"
                                >
                                    Démarrer l&apos;indexation
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {status === "uploading" && (
                <div className="mt-8">
                    <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-blue-600 flex items-center gap-2">
                            <Loader2 className="animate-spin" size={16} />
                            Traitement en cours...
                        </span>
                        <span className="text-sm font-medium text-slate-600">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-slate-500 mt-2 italic">{message}</p>
                </div>
            )}

            {status === "success" && (
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" size={20} />
                    <div>
                        <p className="text-sm font-medium text-emerald-800">{message}</p>
                        <button
                            onClick={() => setStatus("idle")}
                            className="text-xs font-semibold text-emerald-600 mt-1 hover:underline underline-offset-2"
                        >
                            Envoyer un autre fichier
                        </button>
                    </div>
                </div>
            )}

            {status === "error" && (
                <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={20} />
                    <p className="text-sm font-medium text-rose-800">{message}</p>
                </div>
            )}
        </div>
    );
}
