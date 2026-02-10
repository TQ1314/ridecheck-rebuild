"use client";

import { useState, useEffect } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { UserPlus } from "lucide-react";

interface AssignOpsDialogProps {
  orderId: string;
  currentOpsId: string | null;
  onAssign: (opsId: string) => Promise<void>;
}

export function AssignOpsDialog({
  orderId,
  currentOpsId,
  onAssign,
}: AssignOpsDialogProps) {
  const [open, setOpen] = useState(false);
  const [opsUsers, setOpsUsers] = useState<{ id: string; full_name: string }[]>(
    [],
  );
  const [selected, setSelected] = useState(currentOpsId || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const supabase = createClient();
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["operations", "operations_lead"])
        .eq("is_active", true)
        .then(({ data }) => {
          if (data) setOpsUsers(data);
        });
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      await onAssign(selected);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-assign-ops">
          <UserPlus className="h-4 w-4 mr-2" />
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Operations Staff</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Select Staff Member
            </label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger data-testid="select-ops-user">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {opsUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
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
              disabled={loading || !selected}
              size="sm"
              data-testid="button-confirm-assign"
            >
              {loading ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
