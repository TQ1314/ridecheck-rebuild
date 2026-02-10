"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Shield, Menu, X } from "lucide-react";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/how-it-works", label: "How It Works" },
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
          <Shield className="h-6 w-6 text-primary" />
          <span>RideCheck</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button
                variant={pathname === link.href ? "secondary" : "ghost"}
                size="sm"
                data-testid={`link-nav-${link.label.toLowerCase().replace(/ /g, "-")}`}
              >
                {link.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm" data-testid="link-login">
              Log In
            </Button>
          </Link>
          <Link href="/book">
            <Button size="sm" data-testid="link-book-inspection">
              Book Inspection
            </Button>
          </Link>
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
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
            >
              <Button variant="ghost" className="w-full justify-start">
                {link.label}
              </Button>
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            <Link href="/auth/login" className="flex-1">
              <Button variant="outline" className="w-full">
                Log In
              </Button>
            </Link>
            <Link href="/book" className="flex-1">
              <Button className="w-full">Book Inspection</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
