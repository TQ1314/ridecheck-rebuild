"use client";

import { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils/format";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList,
  Search,
  Inbox,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
} from "lucide-react";

const AVAILABILITY_LABELS: Record<string, string> = {
  weekdays:              "Weekdays (Mon–Fri)",
  weekends:              "Weekends (Sat–Sun)",
  weekdays_and_weekends: "Weekdays & Weekends",
  mornings:              "Mornings only",
  evenings:              "Evenings only",
  flexible:              "Flexible / open schedule",
};

interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  availability: string | null;
  willing_to_use_tools: boolean | null;
  experience: string | null;
  notes: string | null;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
}

type StatusFilter = "all" | "submitted" | "under_review" | "approved" | "rejected";

const STATUS_LABELS: Record<string, string> = {
  submitted:    "Submitted",
  under_review: "Under Review",
  approved:     "Approved",
  rejected:     "Rejected",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  submitted:    "secondary",
  under_review: "outline",
  approved:     "default",
  rejected:     "destructive",
};

export default function AdminApplicationsPage() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Application | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function loadApplications() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadApplications(); }, []);

  const counts = useMemo(() => ({
    all:          applications.length,
    submitted:    applications.filter((a) => a.status === "submitted").length,
    under_review: applications.filter((a) => a.status === "under_review").length,
    approved:     applications.filter((a) => a.status === "approved").length,
    rejected:     applications.filter((a) => a.status === "rejected").length,
  }), [applications]);

  const filtered = useMemo(() => {
    let list = statusFilter === "all" ? applications : applications.filter((a) => a.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.full_name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.city?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [applications, statusFilter, search]);

  const handleAction = async (id: string, action: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, review_notes: reviewNotes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast({ title: action === "approve" ? "Applicant approved — invite sent" : `Status updated` });
      setSelected(null);
      setReviewNotes("");
      loadApplications();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const TABS: { key: StatusFilter; label: string }[] = [
    { key: "all",          label: "All" },
    { key: "submitted",    label: "Submitted" },
    { key: "under_review", label: "Under Review" },
    { key: "approved",     label: "Approved" },
    { key: "rejected",     label: "Rejected" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <ClipboardList className="h-6 w-6 text-primary" />
          RideChecker Applications
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review incoming applications. Approved applicants receive an invite link to create their account.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setSearch(""); }}
            data-testid={`tab-${tab.key}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              statusFilter === tab.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${statusFilter === tab.key ? "opacity-80" : "opacity-60"}`}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-applications"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
            <Inbox className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">No applications</h3>
          <p className="text-sm text-muted-foreground">
            {search ? "No matches for your search." : "No applications in this category yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <Card key={app.id} data-testid={`card-application-${app.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" data-testid={`text-name-${app.id}`}>{app.full_name}</span>
                      <Badge
                        variant={STATUS_VARIANT[app.status] ?? "secondary"}
                        className="no-default-hover-elevate no-default-active-elevate"
                        data-testid={`badge-status-${app.id}`}
                      >
                        {STATUS_LABELS[app.status] ?? app.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{app.email}</p>
                    {(app.phone || app.city) && (
                      <p className="text-xs text-muted-foreground">
                        {[app.phone, app.city].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    {app.experience && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{app.experience}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Applied {formatDate(app.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {app.status === "submitted" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(app.id, "under_review")}
                          disabled={actionLoading}
                          data-testid={`button-review-${app.id}`}
                        >
                          <Clock className="h-3.5 w-3.5 mr-1" />
                          Mark Under Review
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => { setSelected(app); setReviewNotes(""); }}
                          data-testid={`button-open-${app.id}`}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Review
                        </Button>
                      </>
                    )}
                    {app.status === "under_review" && (
                      <Button
                        size="sm"
                        onClick={() => { setSelected(app); setReviewNotes(""); }}
                        data-testid={`button-open-${app.id}`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Decide
                      </Button>
                    )}
                    {(app.status === "approved" || app.status === "rejected") && app.review_notes && (
                      <p className="text-xs text-muted-foreground italic">
                        "{app.review_notes}"
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setReviewNotes(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Application — {selected?.full_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div><span className="font-medium text-muted-foreground">Email</span><p>{selected.email}</p></div>
                <div><span className="font-medium text-muted-foreground">Phone</span><p>{selected.phone ?? "—"}</p></div>
                <div><span className="font-medium text-muted-foreground">City</span><p>{selected.city ?? "—"}</p></div>
                <div><span className="font-medium text-muted-foreground">Applied</span><p>{formatDate(selected.created_at)}</p></div>
                <div>
                  <span className="font-medium text-muted-foreground">Availability</span>
                  <p>{selected.availability ? AVAILABILITY_LABELS[selected.availability] ?? selected.availability : "—"}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Willing to use tools</span>
                  <p>
                    {selected.willing_to_use_tools === true
                      ? "✓ Yes"
                      : selected.willing_to_use_tools === false
                      ? "✗ No"
                      : "—"}
                  </p>
                </div>
                {selected.profile_id && (
                  <div className="col-span-2">
                    <span className="font-medium text-muted-foreground">Account</span>
                    <p className="text-xs font-mono text-emerald-600">Account created ✓</p>
                  </div>
                )}
              </div>
              {selected.experience && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Experience</p>
                  <p className="text-sm bg-muted rounded p-3">{selected.experience}</p>
                </div>
              )}
              {selected.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Notes from applicant</p>
                  <p className="text-sm bg-muted rounded p-3">{selected.notes}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Review notes (optional)</p>
                <Textarea
                  placeholder="Internal notes or message to the applicant..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                  data-testid="input-review-notes"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={actionLoading}
                  onClick={() => handleAction(selected.id, "reject")}
                  data-testid="button-reject"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  disabled={actionLoading}
                  onClick={() => handleAction(selected.id, "approve")}
                  data-testid="button-approve"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve & Send Invite
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Approving will email the applicant a secure link to create their RideChecker account.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
