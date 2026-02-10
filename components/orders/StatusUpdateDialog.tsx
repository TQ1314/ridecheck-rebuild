"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { statusLabel } from "@/lib/utils/format";
import { RefreshCw } from "lucide-react";

const STATUSES = [
  "submitted",
  "payment_requested",
  "payment_received",
  "seller_contacted",
  "seller_confirmed",
  "inspection_scheduled",
  "inspection_in_progress",
  "report_drafting",
  "report_ready",
  "completed",
  "cancelled",
];

interface StatusUpdateDialogProps {
  orderId: string;
  currentStatus: string;
  onUpdate: (status: string) => Promise<void>;
}

export function StatusUpdateDialog({
  orderId,
  currentStatus,
  onUpdate,
}: StatusUpdateDialogProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onUpdate(status);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-update-status">
          <RefreshCw className="h-4 w-4 mr-2" />
          Update Status
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium mb-2 block">
              New Status
            </label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || status === currentStatus}
              size="sm"
              data-testid="button-confirm-status"
            >
              {loading ? "Updating..." : "Update"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
