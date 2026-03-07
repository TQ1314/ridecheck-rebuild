"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RideCheckerForm {
  full_name: string;
  email: string;
  phone: string;
  region: string;
  specialties: string;
  max_daily_capacity: number;
}

interface RideCheckerRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  region: string | null;
  is_active: boolean;
  max_daily_capacity: number;
  rating: number | null;
  quality_score: number | null;
  role: string;
}

const emptyForm: RideCheckerForm = {
  full_name: "",
  email: "",
  phone: "",
  region: "",
  specialties: "",
  max_daily_capacity: 5,
};

export default function RideCheckersPage() {
  const { toast } = useToast();
  const [ridecheckers, setRidecheckers] = useState<RideCheckerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RideCheckerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadRidecheckers() {
    try {
      const res = await fetch("/api/admin/inspectors");
      if (!res.ok) {
        setError("Failed to load RideCheckers");
        setLoading(false);
        return;
      }
      setError(null);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.inspectors || [];
      setRidecheckers(list);
    } catch {
      setError("Failed to load RideCheckers");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRidecheckers();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (rc: RideCheckerRow) => {
    setEditingId(rc.id);
    setForm({
      full_name: rc.full_name,
      email: rc.email || "",
      phone: rc.phone || "",
      region: rc.region || "",
      specialties: "",
      max_daily_capacity: rc.max_daily_capacity,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!form.email.trim()) {
      toast({ title: "Email is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const body = {
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      region: form.region || null,
      max_daily_capacity: form.max_daily_capacity,
    };

    let res: Response;
    if (editingId) {
      res = await fetch(`/api/admin/inspectors/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      res = await fetch("/api/admin/inspectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    setSaving(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "RideChecker updated" : "RideChecker created" });
    setDialogOpen(false);
    loadRidecheckers();
  };

  const toggleActive = async (rc: RideCheckerRow) => {
    const res = await fetch(`/api/admin/inspectors/${rc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !rc.is_active }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: `RideChecker ${rc.is_active ? "deactivated" : "activated"}` });
    loadRidecheckers();
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            RideChecker Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your RideChecker workforce
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} data-testid="button-add-ridechecker">
              <Plus className="h-4 w-4 mr-2" />
              Add RideChecker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit RideChecker" : "Add RideChecker"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="mb-2 block">Name *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Full name"
                  data-testid="input-ridechecker-name"
                />
              </div>
              <div>
                <Label className="mb-2 block">Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email address"
                  data-testid="input-ridechecker-email"
                />
              </div>
              <div>
                <Label className="mb-2 block">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                  data-testid="input-ridechecker-phone"
                />
              </div>
              <div>
                <Label className="mb-2 block">Region</Label>
                <Input
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="e.g. Lake County, IL"
                  data-testid="input-ridechecker-region"
                />
              </div>
              <div>
                <Label className="mb-2 block">Max Daily Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_daily_capacity}
                  onChange={(e) =>
                    setForm({ ...form, max_daily_capacity: parseInt(e.target.value) || 1 })
                  }
                  data-testid="input-ridechecker-capacity"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  data-testid="button-save-ridechecker"
                >
                  {saving ? "Saving..." : editingId ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md" data-testid="text-error">
          {error}
        </div>
      ) : ridecheckers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground mb-2">No RideCheckers yet.</p>
          <p className="text-xs text-muted-foreground">RideCheckers sign up at <span className="font-mono">/ridechecker/signup</span>, then you activate them here.</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ridecheckers.map((rc) => (
                <TableRow key={rc.id} data-testid={`row-ridechecker-${rc.id}`}>
                  <TableCell className="font-medium">{rc.full_name}</TableCell>
                  <TableCell className="text-sm">{rc.email || "—"}</TableCell>
                  <TableCell className="text-sm">{rc.phone || "—"}</TableCell>
                  <TableCell className="text-sm">{rc.region || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={rc.is_active ? "default" : "secondary"}
                      className="no-default-hover-elevate no-default-active-elevate cursor-pointer"
                      onClick={() => toggleActive(rc)}
                      data-testid={`badge-status-${rc.id}`}
                    >
                      {rc.is_active ? "Active" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{rc.max_daily_capacity}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(rc)}
                      data-testid={`button-edit-${rc.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
