"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { getWhatsAppUrl } from "@/lib/config/whatsapp";
import type { Language } from "@/lib/i18n/translations";

export function WhatsAppButton() {
  const pathname = usePathname();
  const lang: Language = pathname.startsWith("/es") ? "es" : "en";
  const url = getWhatsAppUrl(lang);

  if (!url) return null;

  const label = lang === "es"
    ? "Habla con nosotros por WhatsApp"
    : "Chat with us on WhatsApp";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="button-whatsapp"
      aria-label={label}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-white shadow-lg hover:bg-[#20bd5a] transition-colors"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline text-sm font-semibold">{label}</span>
    </a>
  );
}
