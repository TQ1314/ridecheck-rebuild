"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserInvite } from "@/types/orders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";
import { getRoleLabel, type Role } from "@/lib/utils/roles";
import { useToast } from "@/hooks/use-toast";
import { Inbox, UserPlus, Copy, Search } from "lucide-react";

const ROLES: Role[] = [
  "customer",
  "operations",
  "operations_lead",
  "ridechecker",
  "ridechecker_active",
  "qa",
  "developer",
  "platform",
  "owner",
];

const INVITE_ROLES: Role[] = [
  "operations",
  "operations_lead",
  "ridechecker",
  "qa",
];

export default function AdminUsersPage() {
  const supabase = createClient();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("ridechecker");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState("");

  async function loadUsers() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  }

  async function loadInvites() {
    const res = await fetch("/api/admin/users/invite");
    if (res.ok) {
      const data = await res.json();
      setInvites(data.invites || []);
    }
  }

  useEffect(() => {
    loadUsers();
    loadInvites();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      toast({ title: "Error updating role", variant: "destructive" });
      return;
    }
    toast({ title: "Role updated" });
    loadUsers();
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !isActive }),
    });
    if (!res.ok) {
      toast({ title: "Error updating status", variant: "destructive" });
      return;
    }
    toast({ title: `User ${isActive ? "deactivated" : "activated"}` });
    loadUsers();
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole) return;
    setInviteLoading(true);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create invite");
      }
      setLastInviteUrl(data.inviteUrl || "");
      toast({ title: "Invite created" });
      loadInvites();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Invite link copied" });
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const filteredUsers = search
    ? users.filter(
        (u) =>
          u.email?.toLowerCase().includes(search.toLowerCase()) ||
          u.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

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
            Users
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage user roles, access, and invitations
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={(v) => { setInviteOpen(v); if (!v) { setLastInviteUrl(""); setInviteEmail(""); } }}>
          <DialogTrigger asChild>
            <Button data-testid="button-invite-user">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite a Team Member</DialogTitle>
            </DialogHeader>
            {lastInviteUrl ? (
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Invite created. Share this link with <strong>{inviteEmail}</strong>:
                </p>
                <div className="flex items-center gap-2">
                  <Input value={lastInviteUrl} readOnly className="text-xs" data-testid="input-invite-url" />
                  <Button size="icon" variant="outline" onClick={() => copyInviteUrl(lastInviteUrl)} data-testid="button-copy-invite">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" className="w-full" onClick={() => { setLastInviteUrl(""); setInviteEmail(""); }}>
                  Create Another
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="mb-2 block">Email Address</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="team@ridecheck.com"
                    data-testid="input-invite-email"
                  />
                </div>
                <div>
                  <Label className="mb-2 block">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger data-testid="select-invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {getRoleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={inviteLoading || !inviteEmail}
                    data-testid="button-send-invite"
                  >
                    {inviteLoading ? "Creating..." : "Create Invite"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {invites.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invites
                .filter((i) => !i.used_at && new Date(i.expires_at) > new Date())
                .map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between gap-4 flex-wrap text-sm py-1"
                    data-testid={`invite-${invite.id}`}
                  >
                    <span>{invite.email}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                        {getRoleLabel(invite.role as Role)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Expires {formatDate(invite.expires_at)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-users"
        />
      </div>

      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
            <Inbox className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">No users found</h3>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell className="font-medium">
                    {user.full_name}
                  </TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      onValueChange={(v) => handleRoleChange(user.id, v)}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {getRoleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.is_active ? "default" : "destructive"}
                      className="no-default-hover-elevate no-default-active-elevate"
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleToggleActive(user.id, user.is_active)
                      }
                      data-testid={`button-toggle-${user.id}`}
                    >
                      {user.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
