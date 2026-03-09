"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X, Globe } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { useState } from "react";

const EN_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/join", label: "Join Our Team" },
];

const ES_LINKS = [
  { href: "/pricing", label: "Precios" },
  { href: "/es/how-it-works", label: "Cómo Funciona" },
  { href: "/join", label: "Únete al Equipo" },
];

const LOCALIZED_ROUTES: Record<string, string> = {
  "/": "/es",
  "/how-it-works": "/es/how-it-works",
  "/book": "/es/book",
  "/es": "/",
  "/es/how-it-works": "/how-it-works",
  "/es/book": "/book",
};

function getLanguageToggle(pathname: string) {
  const isSpanish = pathname.startsWith("/es");
  const mapped = LOCALIZED_ROUTES[pathname];
  const href = mapped || (isSpanish ? "/" : "/es");
  return {
    current: isSpanish ? "ES" : "EN",
    switchTo: isSpanish ? "EN" : "ES",
    href,
  };
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isSpanish = pathname.startsWith("/es");
  const links = isSpanish ? ES_LINKS : EN_LINKS;
  const langToggle = getLanguageToggle(pathname);
  const bookHref = isSpanish ? "/es/book" : "/book";
  const bookLabel = isSpanish ? "Reservar Evaluación" : "Book Assessment";
  const loginLabel = isSpanish ? "Iniciar Sesión" : "Log In";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={isSpanish ? "/es" : "/"}
          className="flex items-center gap-2 font-bold text-lg"
          data-testid="link-home"
        >
          <Logo size={32} />
          <span>RideCheck</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Button
              key={link.href}
              variant={pathname === link.href ? "secondary" : "ghost"}
              size="sm"
              asChild
              data-testid={`link-nav-${link.label.toLowerCase().replace(/ /g, "-")}`}
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            href={langToggle.href}
            data-testid="link-language-toggle"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            {langToggle.current} | {langToggle.switchTo}
          </Link>
          <Button variant="ghost" size="sm" asChild data-testid="link-login">
            <Link href="/auth/login">{loginLabel}</Link>
          </Button>
          <Button size="sm" asChild data-testid="link-book-inspection">
            <Link href={bookHref}>{bookLabel}</Link>
          </Button>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="md:hidden"
          onClick={() => setOpen(!open)}
          data-testid="button-mobile-menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {open && (
        <div className="md:hidden border-t bg-background px-4 pb-4 pt-2 space-y-2">
          {links.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              className="w-full justify-start"
              asChild
            >
              <Link href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            </Button>
          ))}
          <div className="flex items-center justify-center py-1">
            <Link
              href={langToggle.href}
              onClick={() => setOpen(false)}
              data-testid="link-language-toggle-mobile"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <Globe className="h-3.5 w-3.5" />
              {langToggle.current} | {langToggle.switchTo}
            </Link>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/auth/login">{loginLabel}</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href={bookHref}>{bookLabel}</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
