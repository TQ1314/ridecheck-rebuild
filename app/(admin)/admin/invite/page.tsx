"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Copy,
  Check,
  Link2,
  UserPlus,
  Clock,
  Wrench,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

const STAFF_INVITE_ROLES = [
  { value: "operations",      label: "Operations" },
  { value: "operations_lead", label: "Operations Lead" },
  { value: "ridechecker",     label: "RideChecker (invite)" },
  { value: "qa",              label: "QA Reviewer" },
];

const ROLE_LABELS: Record<string, string> = {
  operations:        "Operations",
  operations_lead:   "Operations Lead",
  ridechecker:       "RideChecker",
  ridechecker_active:"RideChecker (Active)",
  qa:                "QA Reviewer",
  customer:          "Customer",
  inspector:         "Inspector",
  developer:         "Developer",
  platform:          "Platform",
  owner:             "Owner",
};

const PRODUCTION_URL = "https://www.ridecheckauto.com";
const SIGNUP_URL = `${PRODUCTION_URL}/careers`;

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0 gap-1.5"
      data-testid="button-copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : label}
    </Button>
  );
}

function inviteStatus(invite: { used_at?: string | null; expires_at: string }) {
  if (invite.used_at)                               return { label: "Used",    variant: "secondary"    as const };
  if (new Date(invite.expires_at) < new Date())     return { label: "Expired", variant: "destructive"  as const };
  return                                                   { label: "Pending", variant: "default"      as const };
}

export default function InvitePage() {
  const { toast } = useToast();

  const [email,        setEmail]        = useState("");
  const [role,         setRole]         = useState("operations");
  const [loading,      setLoading]      = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");

  const [invites,        setInvites]        = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);

  async function loadInvites() {
    setInvitesLoading(true);
    try {
      const res = await fetch("/api/admin/users/invite");
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites || []);
      }
    } finally {
      setInvitesLoading(false);
    }
  }

  useEffect(() => { loadInvites(); }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setGeneratedUrl("");
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invite");
      // inviteUrl comes from the server — always the correct domain
      setGeneratedUrl(data.inviteUrl);
      setEmail("");
      await loadInvites();
      toast({ title: "Invite created", description: `Link ready for ${role}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Connection Links</h1>
        <p className="text-sm text-gray-500 mt-1">
          Share these links to onboard RideCheckers and staff.
        </p>
      </div>

      {/* RideChecker open signup — static link */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-emerald-600" />
            RideChecker Open Signup
          </CardTitle>
          <p className="text-sm text-gray-600">
            Anyone can use this link to apply as a RideChecker. Share it on job boards,
            social media, or directly with candidates.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-white border px-3 py-2 text-sm font-mono text-gray-800 truncate select-all">
              {SIGNUP_URL}
            </code>
            <CopyButton text={SIGNUP_URL} label="Copy Link" />
            <a href="/careers" target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                Preview
              </Button>
            </a>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Applications are reviewed before any account is created. No auth until approved.
          </p>
        </CardContent>
      </Card>

      {/* Staff invite — email-specific */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-gray-700" />
            Generate Staff Invite Link
          </CardTitle>
          <p className="text-sm text-gray-500">
            Email-specific, one-time invite links for Operations, Operations Lead, or QA.
            Links expire in 7 days.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="invite-email" className="text-xs font-semibold mb-1 block">
                  Their email address
                </Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  data-testid="input-invite-email"
                />
              </div>
              <div>
                <Label htmlFor="invite-role" className="text-xs font-semibold mb-1 block">
                  Role
                </Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger id="invite-role" data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_INVITE_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !email.trim()}
              className="gap-2"
              data-testid="button-generate-invite"
            >
              <Link2 className="h-4 w-4" />
              {loading ? "Generating…" : "Generate Invite Link"}
            </Button>
          </form>

          {generatedUrl && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-2">
                Invite link ready — copy and send it now
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-white border px-3 py-2 text-sm font-mono text-gray-800 break-all select-all">
                  {generatedUrl}
                </code>
                <CopyButton text={generatedUrl} label="Copy" />
              </div>
              <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Expires in 7 days. Single use only.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent invites table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gray-700" />
            Recent Invites
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invitesLoading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : invites.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-400">No invites yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((inv) => {
                    const status = inviteStatus(inv);
                    const isPending = status.label === "Pending";
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="text-sm font-medium">{inv.email}</TableCell>
                        <TableCell>
                          <span className="text-xs text-gray-600">
                            {ROLE_LABELS[inv.role] || inv.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="text-xs">
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(inv.expires_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <CopyButton text={inv.inviteUrl} label="Copy" />
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
