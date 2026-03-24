"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navbar() {
    const pathname = usePathname();

    const navLinks = [
        { name: "Chatbot Juridique", href: "/" },
        { name: "Importer PDF", href: "/upload" },
    ];

    return (
        <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-center px-6 sticky top-0 z-20 w-full backdrop-blur-md bg-white/80">
            <div className="flex items-center gap-12 font-medium">
                {navLinks.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={`text-sm transition-all duration-200 relative py-2 ${isActive
                                ? "text-blue-600 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600"
                                : "text-slate-600 hover:text-blue-500"
                                }`}
                        >
                            {link.name}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
