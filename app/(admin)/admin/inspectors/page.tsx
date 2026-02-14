"use client";

import { useEffect, useState } from "react";
import type { Inspector } from "@/types/orders";
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

interface InspectorForm {
  full_name: string;
  email: string;
  phone: string;
  region: string;
  specialties: string;
  max_daily_capacity: number;
}

const emptyForm: InspectorForm = {
  full_name: "",
  email: "",
  phone: "",
  region: "",
  specialties: "",
  max_daily_capacity: 5,
};

export default function InspectorsPage() {
  const { toast } = useToast();
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InspectorForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadInspectors() {
    try {
      const res = await fetch("/api/admin/inspectors");
      if (!res.ok) {
        setError("Failed to load inspectors");
        setLoading(false);
        return;
      }
      setError(null);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.inspectors || [];
      setInspectors(list);
    } catch {
      setError("Failed to load inspectors");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadInspectors();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (inspector: Inspector) => {
    setEditingId(inspector.id);
    setForm({
      full_name: inspector.full_name,
      email: inspector.email || "",
      phone: inspector.phone || "",
      region: inspector.region || "",
      specialties: (inspector.specialties || []).join(", "),
      max_daily_capacity: inspector.max_daily_capacity,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const body = {
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      region: form.region || null,
      specialties: form.specialties
        ? form.specialties.split(",").map((s) => s.trim()).filter(Boolean)
        : null,
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
    toast({ title: editingId ? "Inspector updated" : "Inspector created" });
    setDialogOpen(false);
    loadInspectors();
  };

  const toggleActive = async (inspector: Inspector) => {
    const res = await fetch(`/api/admin/inspectors/${inspector.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !inspector.is_active }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: `Inspector ${inspector.is_active ? "deactivated" : "activated"}` });
    loadInspectors();
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
            Inspector Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your inspection team
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAdd} data-testid="button-add-inspector">
              <Plus className="h-4 w-4 mr-2" />
              Add Inspector
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Inspector" : "Add Inspector"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="mb-2 block">Name *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Full name"
                  data-testid="input-inspector-name"
                />
              </div>
              <div>
                <Label className="mb-2 block">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email address"
                  data-testid="input-inspector-email"
                />
              </div>
              <div>
                <Label className="mb-2 block">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                  data-testid="input-inspector-phone"
                />
              </div>
              <div>
                <Label className="mb-2 block">Region</Label>
                <Input
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="e.g. GTA, Montreal"
                  data-testid="input-inspector-region"
                />
              </div>
              <div>
                <Label className="mb-2 block">Specialties (comma-separated)</Label>
                <Input
                  value={form.specialties}
                  onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                  placeholder="e.g. EV, European, Heavy Duty"
                  data-testid="input-inspector-specialties"
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
                  data-testid="input-inspector-capacity"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  data-testid="button-save-inspector"
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
      ) : inspectors.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inspectors yet. Add one to get started.</p>
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
              {inspectors.map((inspector) => (
                <TableRow key={inspector.id} data-testid={`row-inspector-${inspector.id}`}>
                  <TableCell className="font-medium">{inspector.full_name}</TableCell>
                  <TableCell className="text-sm">{inspector.email || "—"}</TableCell>
                  <TableCell className="text-sm">{inspector.phone || "—"}</TableCell>
                  <TableCell className="text-sm">{inspector.region || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={inspector.is_active ? "default" : "secondary"}
                      className="no-default-hover-elevate no-default-active-elevate cursor-pointer"
                      onClick={() => toggleActive(inspector)}
                      data-testid={`badge-status-${inspector.id}`}
                    >
                      {inspector.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{inspector.max_daily_capacity}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(inspector)}
                      data-testid={`button-edit-${inspector.id}`}
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
