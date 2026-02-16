"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils/format";
import { useToast } from "@/hooks/use-toast";
import {
  Car,
  Calendar,
  MapPin,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Upload,
} from "lucide-react";
import Link from "next/link";

const INSPECTOR_STATUSES = [
  { value: "en_route", label: "En Route" },
  { value: "on_site", label: "On Site" },
  { value: "inspecting", label: "Inspecting" },
  { value: "wrapping_up", label: "Wrapping Up" },
  { value: "completed", label: "Completed" },
];

interface OrderEvent {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
  performed_by: string | null;
}

export default function InspectorJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<any>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [selectedStatus, setSelectedStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  async function loadJob() {
    const res = await fetch(`/api/inspector/jobs/${orderId}`);
    if (!res.ok) {
      toast({ title: "Job not found", variant: "destructive" });
      router.push("/inspector");
      return;
    }
    const data = await res.json();
    setOrder(data.order);
    setEvents(data.events || []);
    setSelectedStatus(data.order.inspector_status || "");
    setNotes(data.order.inspector_notes || "");
    setLoading(false);
  }

  useEffect(() => {
    if (orderId) loadJob();
  }, [orderId]);

  const handleStatusUpdate = async () => {
    if (!selectedStatus) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/inspector/jobs/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspector_status: selectedStatus,
          inspector_notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }
      toast({ title: "Status updated" });
      loadJob();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const res = await fetch(`/api/inspector/jobs/${orderId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      toast({ title: "Report uploaded successfully" });
      setUploadFile(null);
      loadJob();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) return null;

  const isCompleted = order.inspector_status === "completed";
  const needsUpload = order.report_status === "pending_upload";

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/inspector" data-testid="link-back-inspector">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold" data-testid="text-job-title">
            Assessment {order.order_id}
          </h1>
          <p className="text-sm text-muted-foreground">
            {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Vehicle Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span>
                {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
              </span>
            </div>
            {order.vehicle_vin && (
              <div>
                <span className="text-muted-foreground">VIN: </span>
                <span className="font-mono">{order.vehicle_vin}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Package: </span>
              <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate capitalize">
                {order.package}
              </Badge>
            </div>
            {order.listing_url && (
              <div>
                <span className="text-muted-foreground">Listing: </span>
                <a
                  href={order.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline text-xs break-all"
                >
                  View Listing
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Schedule & Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {order.scheduled_date ? (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  {formatDate(order.scheduled_date)}
                  {order.scheduled_time && ` at ${order.scheduled_time}`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Not yet scheduled</span>
              </div>
            )}
            {order.inspection_address ? (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span>{order.inspection_address}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>No address set</span>
              </div>
            )}
            {order.seller_name && (
              <div>
                <span className="text-muted-foreground">Seller: </span>
                <span>{order.seller_name}</span>
              </div>
            )}
            {order.seller_phone && (
              <div>
                <span className="text-muted-foreground">Seller Phone: </span>
                <span>{order.seller_phone}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Update Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Assessment Status</Label>
            <Select
              value={selectedStatus}
              onValueChange={setSelectedStatus}
              disabled={isCompleted}
            >
              <SelectTrigger data-testid="select-inspector-status">
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {INSPECTOR_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Notes (internal)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this assessment..."
              className="resize-none"
              rows={3}
              disabled={isCompleted}
              data-testid="textarea-inspector-notes"
            />
          </div>
          {!isCompleted && (
            <Button
              onClick={handleStatusUpdate}
              disabled={updating || !selectedStatus}
              data-testid="button-update-status"
            >
              {updating ? "Updating..." : "Update Status"}
            </Button>
          )}
          {isCompleted && needsUpload && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
              <Upload className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Assessment Complete</p>
                <p className="text-xs text-muted-foreground">
                  Upload your report using the upload section below.
                </p>
              </div>
            </div>
          )}
          {isCompleted && !needsUpload && order.report_status && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-muted">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Report Status: {order.report_status}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(isCompleted && (needsUpload || order.report_status === "revision_needed")) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Upload Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload your completed assessment report (PDF, DOCX, or images up to 50MB).
            </p>
            <div>
              <Label className="mb-2 block">Report File</Label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground"
                data-testid="input-report-file"
              />
            </div>
            {uploadFile && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  data-testid="button-upload-report"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Upload Report"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Activity Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 text-sm"
                  data-testid={`event-${event.id}`}
                >
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm">{event.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(event.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
