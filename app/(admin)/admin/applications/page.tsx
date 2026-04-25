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
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  Loader2,
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

interface VerificationData {
  profile: {
    full_name: string;
    email: string;
    legal_name: string | null;
    date_of_birth: string | null;
    address_line1: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
    verification_submitted_at: string | null;
    verification_review_notes: string | null;
  };
  id_document_url: string | null;
  selfie_url: string | null;
}

type StatusFilter =
  | "all"
  | "submitted"
  | "under_review"
  | "pending_verification"
  | "verification_submitted"
  | "active"
  | "rejected";

const STATUS_LABELS: Record<string, string> = {
  submitted:              "Submitted",
  under_review:           "Under Review",
  pending_verification:   "Pending Verification",
  verification_submitted: "Verification Submitted",
  active:                 "Active",
  approved:               "Approved",
  rejected:               "Rejected",
  verification_rejected:  "Verification Rejected",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  submitted:              "secondary",
  under_review:           "outline",
  pending_verification:   "outline",
  verification_submitted: "secondary",
  active:                 "default",
  approved:               "default",
  rejected:               "destructive",
  verification_rejected:  "destructive",
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

  // Verification review state
  const [verifyApp, setVerifyApp] = useState<Application | null>(null);
  const [verifyData, setVerifyData] = useState<VerificationData | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [verifyActionLoading, setVerifyActionLoading] = useState(false);

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
    all:                    applications.length,
    submitted:              applications.filter((a) => a.status === "submitted").length,
    under_review:           applications.filter((a) => a.status === "under_review").length,
    pending_verification:   applications.filter((a) => a.status === "pending_verification").length,
    verification_submitted: applications.filter((a) => a.status === "verification_submitted").length,
    active:                 applications.filter((a) => a.status === "active").length,
    rejected:               applications.filter((a) => ["rejected", "verification_rejected"].includes(a.status)).length,
  }), [applications]);

  const filtered = useMemo(() => {
    let list = statusFilter === "all"
      ? applications
      : statusFilter === "rejected"
      ? applications.filter((a) => ["rejected", "verification_rejected"].includes(a.status))
      : applications.filter((a) => a.status === statusFilter);

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
      toast({
        title: action === "approve"
          ? "Applicant approved — verification link sent"
          : "Status updated",
      });
      setSelected(null);
      setReviewNotes("");
      loadApplications();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  async function openVerificationReview(app: Application) {
    if (!app.profile_id) {
      toast({ title: "No profile linked to this application yet.", variant: "destructive" });
      return;
    }
    setVerifyApp(app);
    setVerifyData(null);
    setVerifyNotes("");
    setVerifyLoading(true);
    try {
      const res = await fetch(`/api/admin/ridecheckers/${app.profile_id}/verification-review`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to load verification data");
      }
      const d = await res.json();
      setVerifyData(d);
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
      setVerifyApp(null);
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleVerificationAction(action: "approve" | "reject") {
    if (!verifyApp?.profile_id) return;
    if (action === "reject" && !verifyNotes.trim()) {
      toast({ title: "Please provide a reason for rejection.", variant: "destructive" });
      return;
    }
    setVerifyActionLoading(true);
    try {
      const res = await fetch(`/api/admin/ridecheckers/${verifyApp.profile_id}/verification-review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: verifyNotes.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Action failed");
      toast({
        title: action === "approve"
          ? "Verification approved — account is now active"
          : "Verification rejected — applicant notified",
      });
      setVerifyApp(null);
      setVerifyData(null);
      setVerifyNotes("");
      loadApplications();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setVerifyActionLoading(false);
    }
  }

  const TABS: { key: StatusFilter; label: string }[] = [
    { key: "all",                    label: "All" },
    { key: "submitted",              label: "Submitted" },
    { key: "under_review",           label: "Under Review" },
    { key: "pending_verification",   label: "Pending Verification" },
    { key: "verification_submitted", label: "Verify Queue" },
    { key: "active",                 label: "Active" },
    { key: "rejected",               label: "Rejected" },
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
          Review applications and identity verifications across the full applicant lifecycle.
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
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
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
                    {app.status === "pending_verification" && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Awaiting verification from applicant
                      </Badge>
                    )}
                    {app.status === "verification_submitted" && (
                      <Button
                        size="sm"
                        onClick={() => openVerificationReview(app)}
                        data-testid={`button-verify-${app.id}`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                        Review Verification
                      </Button>
                    )}
                    {(app.status === "active") && (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                    {(app.status === "rejected" || app.status === "verification_rejected") && app.review_notes && (
                      <p className="text-xs text-muted-foreground italic max-w-[200px]">
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

      {/* Application Review dialog (approve / reject application) */}
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
                  Approve & Send Verification Link
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Approving will email the applicant a secure link to complete identity verification before their account is activated.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verification Review dialog */}
      <Dialog open={!!verifyApp} onOpenChange={(open) => { if (!open) { setVerifyApp(null); setVerifyData(null); setVerifyNotes(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Verification Review — {verifyApp?.full_name}
            </DialogTitle>
          </DialogHeader>

          {verifyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : verifyData ? (
            <div className="space-y-5 pt-2">
              {/* Personal Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Personal Information
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm bg-muted/40 rounded-lg p-3">
                  <div>
                    <span className="font-medium text-muted-foreground block">Legal Name</span>
                    <span>{verifyData.profile.legal_name ?? "—"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground block">Date of Birth</span>
                    <span>{verifyData.profile.date_of_birth ?? "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-muted-foreground block">Address</span>
                    <span>
                      {[
                        verifyData.profile.address_line1,
                        verifyData.profile.address_city,
                        verifyData.profile.address_state,
                        verifyData.profile.address_zip,
                      ].filter(Boolean).join(", ") || "—"}
                    </span>
                  </div>
                  {verifyData.profile.verification_submitted_at && (
                    <div className="col-span-2">
                      <span className="font-medium text-muted-foreground block">Submitted</span>
                      <span>{formatDate(verifyData.profile.verification_submitted_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Document Images */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Identity Documents
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Driver's License / State ID</p>
                    {verifyData.id_document_url ? (
                      <div className="rounded-lg border overflow-hidden bg-muted">
                        <img
                          src={verifyData.id_document_url}
                          alt="ID Document"
                          className="w-full object-contain max-h-48"
                          data-testid="img-id-document"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className="p-2 flex justify-center border-t">
                          <a
                            href={verifyData.id_document_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 hover:underline"
                            data-testid="link-id-document"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open full size
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted flex items-center justify-center h-32">
                        <p className="text-sm text-muted-foreground">No document uploaded</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selfie</p>
                    {verifyData.selfie_url ? (
                      <div className="rounded-lg border overflow-hidden bg-muted">
                        <img
                          src={verifyData.selfie_url}
                          alt="Selfie"
                          className="w-full object-contain max-h-48"
                          data-testid="img-selfie"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                        <div className="p-2 flex justify-center border-t">
                          <a
                            href={verifyData.selfie_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary flex items-center gap-1 hover:underline"
                            data-testid="link-selfie"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open full size
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border bg-muted flex items-center justify-center h-32">
                        <p className="text-sm text-muted-foreground">No selfie uploaded</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Review Notes */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Notes (required for rejection)</p>
                <Textarea
                  placeholder="Explain any issues or add context for the applicant..."
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                  data-testid="input-verify-notes"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={verifyActionLoading}
                  onClick={() => handleVerificationAction("reject")}
                  data-testid="button-reject-verification"
                >
                  {verifyActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 mr-2" />
                  )}
                  Reject Verification
                </Button>
                <Button
                  className="flex-1"
                  disabled={verifyActionLoading}
                  onClick={() => handleVerificationAction("approve")}
                  data-testid="button-approve-verification"
                >
                  {verifyActionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Approve & Activate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Approving will activate the RideChecker account and allow them to receive assignments.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
