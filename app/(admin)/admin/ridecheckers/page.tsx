"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Wrench,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RideChecker {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  service_area: string | null;
  experience: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  rating: number | null;
  referral_code: string | null;
}

interface Stats {
  total: number;
  pending: number;
  active: number;
}

export default function RideCheckersAdminPage() {
  const { toast } = useToast();
  const [ridecheckers, setRidecheckers] = useState<RideChecker[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "active">("all");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<RideChecker | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function loadData() {
    try {
      const res = await fetch(`/api/admin/ridecheckers?status=${filter}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setRidecheckers(data.ridecheckers || []);
      setStats(data.stats || { total: 0, pending: 0, active: 0 });
    } catch {
      toast({ title: "Failed to load RideCheckers", variant: "destructive" });
    }
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [filter]);

  const handleApprove = async (rc: RideChecker) => {
    setActionLoading(rc.id);
    try {
      const res = await fetch("/api/admin/ridecheckers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: rc.id, action: "approve" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast({ title: `${rc.full_name} has been approved` });
      loadData();
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  const openRejectDialog = (rc: RideChecker) => {
    setRejectTarget(rc);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(rejectTarget.id);
    try {
      const res = await fetch("/api/admin/ridecheckers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: rejectTarget.id,
          action: "reject",
          reason: rejectReason || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast({ title: `${rejectTarget.full_name} has been rejected` });
      setRejectDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          RideChecker Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Review applications and manage active RideCheckers
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-total">
              {stats.total}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approval
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-pending">
              {stats.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-stat-active">
              {stats.active}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "active"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            data-testid={`button-filter-${f}`}
          >
            {f === "all" ? "All" : f === "pending" ? "Pending" : "Active"}
          </Button>
        ))}
      </div>

      {ridecheckers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-1">No RideCheckers Found</h3>
            <p className="text-sm text-muted-foreground">
              {filter === "pending"
                ? "No pending applications at this time."
                : "No RideCheckers match this filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Service Area</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ridecheckers.map((rc) => (
                <TableRow key={rc.id} data-testid={`row-ridechecker-${rc.id}`}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{rc.full_name}</span>
                      {rc.phone && (
                        <span className="block text-xs text-muted-foreground">
                          {rc.phone}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{rc.email}</TableCell>
                  <TableCell className="text-sm">
                    {rc.service_area ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {rc.service_area}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={rc.role === "ridechecker_active" ? "default" : "secondary"}
                      data-testid={`badge-role-${rc.id}`}
                    >
                      {rc.role === "ridechecker_active" ? "Active" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(rc.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {rc.role === "ridechecker" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(rc)}
                          disabled={actionLoading === rc.id}
                          data-testid={`button-approve-${rc.id}`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRejectDialog(rc)}
                          disabled={actionLoading === rc.id}
                          data-testid={`button-reject-${rc.id}`}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                    {rc.role === "ridechecker_active" && rc.approved_at && (
                      <span className="text-xs text-muted-foreground">
                        Approved {new Date(rc.approved_at).toLocaleDateString()}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Rejecting <strong>{rejectTarget?.full_name}</strong>'s application.
              Optionally provide a reason.
            </p>
            <div>
              <Label className="mb-2 block">Reason (optional)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Insufficient experience in vehicle assessment"
                className="resize-none"
                rows={3}
                data-testid="input-reject-reason"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={actionLoading === rejectTarget?.id}
                data-testid="button-confirm-reject"
              >
                {actionLoading === rejectTarget?.id ? "Rejecting..." : "Reject Application"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
