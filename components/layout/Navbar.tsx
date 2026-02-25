"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/join", label: "Join Our Team" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg"
          data-testid="link-home"
        >
          <Logo size={32} />
          <span>RideCheck</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
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
          <Button variant="ghost" size="sm" asChild data-testid="link-login">
            <Link href="/auth/login">Log In</Link>
          </Button>
          <Button size="sm" asChild data-testid="link-book-inspection">
            <Link href="/book">Book Assessment</Link>
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
          {NAV_LINKS.map((link) => (
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
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/auth/login">Log In</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href="/book">Book Assessment</Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
