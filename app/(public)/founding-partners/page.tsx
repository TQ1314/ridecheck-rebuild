"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";

interface Partner {
  display: string;
  month:   string;
}

export default function FoundingPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/founding/partners")
      .then((r) => r.json())
      .then((d) => setPartners(d.partners ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <section className="bg-emerald-950 text-white py-16 px-4 text-center">
        <Badge className="bg-emerald-700 text-white border-0 mb-4 text-xs tracking-widest uppercase">
          Founding Partners
        </Badge>
        <h1 className="text-4xl font-bold mb-4">The People Who Made This Possible</h1>
        <p className="text-emerald-200 max-w-xl mx-auto text-lg">
          These supporters believed in RideCheck early and helped us build a safer used-car marketplace
          across Illinois.
        </p>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-16">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
          </div>
        ) : partners.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-semibold">No Founding Partners yet</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Be the first to join at the Founding Partner tier and have your name listed here.
            </p>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700 mt-2">
              <Link href="/founding-supporters">Become a Founding Partner</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-8 text-center">
              {partners.length} Founding Partner{partners.length !== 1 ? "s" : ""} — names shown as first name + last initial.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {partners.map((p, i) => (
                <div
                  key={i}
                  data-testid={`card-partner-${i}`}
                  className="rounded-xl border bg-card p-4 text-center hover:border-emerald-300 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mx-auto mb-3">
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      {p.display.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="font-semibold text-sm">{p.display}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.month}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center space-y-3">
              <p className="text-muted-foreground text-sm">Want your name here?</p>
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <Link href="/founding-supporters">
                  Become a Founding Partner <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
