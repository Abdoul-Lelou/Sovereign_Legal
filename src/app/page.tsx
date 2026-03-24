// import { Chatbot } from "@/components/Chatbot";

import { Suspense } from "react";
import { Chatbot } from "@/components/Chatbot";
export default function Home() {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-hidden relative">
        <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-slate-500">Chargement...</div>}>
          <Chatbot />
        </Suspense>
      </div>
    </div>
  );
}
