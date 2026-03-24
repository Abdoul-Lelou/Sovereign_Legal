import { PDFUploader } from "@/components/PDFUploader";

export default function UploadPage() {
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <div className="flex-1 overflow-y-auto p-8 flex justify-center">
                <div className="w-full max-w-3xl">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Importer des documents</h1>
                        <p className="text-slate-500 mt-2">
                            Ajoutez des documents PDF (jurisprudence, actes uniformes, doctrine) pour enrichir la base de connaissances de l&apos;assistant.
                        </p>
                    </div>

                    <PDFUploader />
                </div>
            </div>
        </div>
    );
}
