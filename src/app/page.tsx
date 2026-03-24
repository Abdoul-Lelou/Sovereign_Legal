// import { Chatbot } from "@/components/Chatbot";

import { Chatbot } from "@/components/Chatbot";

export default function Home() {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-hidden relative">
        <Chatbot />
      </div>
    </div>
  );
}
