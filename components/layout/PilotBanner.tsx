"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n/translations";
import type { Language } from "@/lib/i18n/translations";

export function PilotBanner() {
  const pathname = usePathname();
  const lang: Language = pathname.startsWith("/es") ? "es" : "en";
  const bookHref = lang === "es" ? "/es/book" : "/book";

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800" data-testid="banner-pilot-global">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex items-center justify-between">
        <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
          <span className="font-semibold">{t("pilot.banner", lang)}</span>
          <span className="hidden sm:inline">{t("pilot.bannerDetail", lang)}</span>
        </p>
        <Link
          href={bookHref}
          className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline whitespace-nowrap ml-4"
          data-testid="link-book-now"
        >
          {t("pilot.bookNow", lang)}
        </Link>
      </div>
    </div>
  );
}
