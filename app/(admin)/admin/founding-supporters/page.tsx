"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, Users, DollarSign, CheckCircle, Clock } from "lucide-react";

interface Credit {
  id:                    string;
  tier:                  string;
  amount_cents:          number;
  credits_count:         number;
  credit_code:           string;
  supporter_name:        string;
  supporter_email:       string;
  gift_recipient_name:   string | null;
  gift_recipient_email:  string | null;
  list_on_partners_page: boolean;
  status:                string;
  expires_at:            string;
  created_at:            string;
}

interface Stats {
  supporter_count:     number;
  total_raised_cents:  number;
  active_count:        number;
  redeemed_count:      number;
  expiring_soon_count: number;
}

const TIER_LABELS: Record<string, string> = {
  backer:           "Backer",
  believer:         "Believer",
  founding_partner: "Founding Partner",
};

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  redeemed: "bg-blue-100 text-blue-800 border-blue-200",
  expired:  "bg-gray-100 text-gray-600 border-gray-200",
};

function formatDollars(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminFoundingSupportersPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/admin/founding-supporters");
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setCredits(json.credits ?? []);
      setStats(json.stats   ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleExport() {
    window.open("/api/admin/founding-supporters/export", "_blank");
  }

  const statCards = stats ? [
    { label: "Total Supporters",   value: stats.supporter_count,               icon: Users,        color: "text-emerald-600" },
    { label: "Total Raised",       value: formatDollars(stats.total_raised_cents), icon: DollarSign, color: "text-emerald-600" },
    { label: "Active Credits",     value: stats.active_count,                  icon: CheckCircle,  color: "text-blue-600"    },
    { label: "Expiring (30 days)", value: stats.expiring_soon_count,           icon: Clock,        color: "text-amber-600"   },
  ] : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Founding Supporters</h1>
          <p className="text-muted-foreground text-sm mt-1">Campaign credit management &amp; reporting</p>
        </div>
        <Button
          data-testid="button-export-csv"
          onClick={handleExport}
          variant="outline"
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-16 text-destructive text-sm">{error}</div>
          ) : credits.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">No supporters yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Gift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {credits.map((c) => (
                    <TableRow key={c.id} data-testid={`row-credit-${c.id}`}>
                      <TableCell className="font-medium whitespace-nowrap">{c.supporter_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.supporter_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {TIER_LABELS[c.tier] ?? c.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{formatDollars(c.amount_cents)}</TableCell>
                      <TableCell>
                        <code
                          data-testid={`text-code-${c.id}`}
                          className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono"
                        >
                          {c.credit_code}
                        </code>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status] ?? ""}`}
                        >
                          {c.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(c.expires_at)}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(c.created_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.gift_recipient_name ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
