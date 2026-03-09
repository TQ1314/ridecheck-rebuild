"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/layout/Logo";
import { MessageCircle } from "lucide-react";
import { getWhatsAppUrl } from "@/lib/config/whatsapp";

export function Footer() {
  const pathname = usePathname();
  const isSpanish = pathname.startsWith("/es");
  const whatsAppUrl = getWhatsAppUrl(isSpanish ? "es" : "en");

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <Link
              href={isSpanish ? "/es" : "/"}
              className="flex items-center gap-2 font-bold text-lg mb-3"
            >
              <Logo size={28} />
              <span>RideCheck</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {isSpanish
                ? "Inteligencia pre-compra de vehículos en la que puedes confiar."
                : "Pre-car-purchase intelligence you can trust."}
            </p>
            {!isSpanish && (
              <Link
                href="/es"
                className="mt-3 inline-block text-sm text-emerald-700 hover:underline"
                data-testid="link-spanish-footer"
              >
                ¿Habla español? También atendemos en español.
              </Link>
            )}
            {isSpanish && (
              <Link
                href="/"
                className="mt-3 inline-block text-sm text-emerald-700 hover:underline"
                data-testid="link-english-footer"
              >
                English version available
              </Link>
            )}
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">
              {isSpanish ? "Servicios" : "Services"}
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  {isSpanish ? "Precios" : "Pricing"}
                </Link>
              </li>
              <li>
                <Link href={isSpanish ? "/es/how-it-works" : "/how-it-works"} className="hover:text-foreground transition-colors">
                  {isSpanish ? "Cómo Funciona" : "How It Works"}
                </Link>
              </li>
              <li>
                <Link href="/what-we-check" className="hover:text-foreground transition-colors">
                  {isSpanish ? "Qué Revisamos" : "What We Check"}
                </Link>
              </li>
              <li>
                <Link href={isSpanish ? "/es/book" : "/book"} className="hover:text-foreground transition-colors">
                  {isSpanish ? "Reservar Evaluación" : "Book Assessment"}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">
              {isSpanish ? "Compañía" : "Company"}
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/faq" className="hover:text-foreground transition-colors">
                  {isSpanish ? "Preguntas Frecuentes" : "FAQ"}
                </Link>
              </li>
              <li>
                <Link href="/join" className="hover:text-foreground transition-colors">
                  {isSpanish ? "Únete al Equipo" : "Join Our Team"}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground transition-colors">
                  {isSpanish ? "Contáctanos" : "Contact Us"}
                </Link>
              </li>
              {whatsAppUrl && (
                <li>
                  <a
                    href={whatsAppUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-foreground transition-colors inline-flex items-center gap-1"
                    data-testid="link-whatsapp-footer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {isSpanish ? "Habla con nosotros por WhatsApp" : "Chat with us on WhatsApp"}
                  </a>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/terms" className="hover:text-foreground transition-colors">
                  {isSpanish ? "Términos de Servicio" : "Terms of Service"}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground transition-colors">
                  {isSpanish ? "Política de Privacidad" : "Privacy Policy"}
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} {isSpanish ? "RideCheck. Todos los derechos reservados." : "RideCheck. All rights reserved."}
        </div>
      </div>
    </footer>
  );
}
