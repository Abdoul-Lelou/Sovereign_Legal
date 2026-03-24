import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sovereign_Legal",
  description: "Assistant juridique intelligent expert en droit de l'OHADA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className={`${inter.className} h-full overflow-hidden bg-slate-50 flex text-slate-900`}>
        {/* Main Layout wrapper */}
        <div className="flex w-full h-full">
          {/* Persistent Sidebar */}
          <Suspense fallback={<div className="w-72 bg-slate-900 h-screen shrink-0 border-r border-slate-800"></div>}>
            <Sidebar />
          </Suspense>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Top Navbar */}
            <Navbar />

            {/* Main Page Content */}
            <main className="flex-1 overflow-y-auto relative bg-white">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
