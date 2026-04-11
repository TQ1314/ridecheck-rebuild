"use client";

import { useEffect, useState, useMemo } from "react";
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
import { Inbox, UserPlus, Copy, Search, Users, ShoppingBag, ClipboardCheck, CheckCircle2 } from "lucide-react";

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

const STAFF_ROLES: Role[] = ["operations", "operations_lead", "qa", "developer", "platform", "owner"];
const RC_ROLES: Role[] = ["ridechecker", "ridechecker_active"];

type ViewTab = "all" | "customers" | "applicants" | "active";

interface PersonaTag {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  className: string;
}

function getPersonaTags(
  profile: Profile,
  orderUserIds: Set<string>,
  stageHistoryIds: Set<string>
): PersonaTag[] {
  const tags: PersonaTag[] = [];
  const role = profile.role as Role;

  if (role === "ridechecker_active") {
    tags.push({ label: "Active RideChecker", variant: "default", className: "bg-primary text-primary-foreground no-default-hover-elevate no-default-active-elevate" });
  } else if (role === "ridechecker" || stageHistoryIds.has(profile.id)) {
    tags.push({ label: "RC Applicant", variant: "secondary", className: "no-default-hover-elevate no-default-active-elevate" });
  }

  if (orderUserIds.has(profile.id)) {
    tags.push({ label: "Customer", variant: "outline", className: "border-blue-500 text-blue-600 dark:text-blue-400 no-default-hover-elevate no-default-active-elevate" });
  }

  if (STAFF_ROLES.includes(role)) {
    tags.push({ label: "Staff / Operations", variant: "outline", className: "border-amber-500 text-amber-700 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate" });
  }

  if (tags.length === 0) {
    tags.push({ label: "Customer", variant: "outline", className: "border-blue-500 text-blue-600 dark:text-blue-400 no-default-hover-elevate no-default-active-elevate" });
  }

  return tags;
}

function isInTab(
  profile: Profile,
  tab: ViewTab,
  orderUserIds: Set<string>,
  stageHistoryIds: Set<string>
): boolean {
  const role = profile.role as Role;
  switch (tab) {
    case "all":
      return true;
    case "customers":
      return orderUserIds.has(profile.id);
    case "applicants":
      return role === "ridechecker" || stageHistoryIds.has(profile.id);
    case "active":
      return role === "ridechecker_active";
  }
}

export default function AdminUsersPage() {
  const supabase = createClient();
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [orderUserIds, setOrderUserIds] = useState<Set<string>>(new Set());
  const [stageHistoryIds, setStageHistoryIds] = useState<Set<string>>(new Set());
  const [invites, setInvites] = useState<UserInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("all");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("ridechecker");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState("");

  async function loadData() {
    setLoading(true);
    const [profilesRes, ordersRes, historyRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("user_id"),
      supabase.from("ridechecker_stage_history").select("ridechecker_id"),
    ]);

    if (profilesRes.data) setUsers(profilesRes.data);

    const oIds = new Set<string>(
      (ordersRes.data || []).map((o: { user_id: string }) => o.user_id).filter(Boolean)
    );
    setOrderUserIds(oIds);

    const hIds = new Set<string>(
      (historyRes.data || []).map((h: { ridechecker_id: string }) => h.ridechecker_id).filter(Boolean)
    );
    setStageHistoryIds(hIds);

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
    loadData();
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
    loadData();
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
    loadData();
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
      if (!res.ok) throw new Error(data.error || "Failed to create invite");
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

  const counts = useMemo(() => ({
    all: users.length,
    customers: users.filter((u) => orderUserIds.has(u.id)).length,
    applicants: users.filter((u) => u.role === "ridechecker" || stageHistoryIds.has(u.id)).length,
    active: users.filter((u) => u.role === "ridechecker_active").length,
  }), [users, orderUserIds, stageHistoryIds]);

  const filteredUsers = useMemo(() => {
    let list = users.filter((u) => isInTab(u, activeTab, orderUserIds, stageHistoryIds));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) =>
          u.email?.toLowerCase().includes(q) ||
          u.full_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, activeTab, orderUserIds, stageHistoryIds, search]);

  const TABS: { key: ViewTab; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All Profiles", icon: <Users className="h-4 w-4" /> },
    { key: "customers", label: "Customers", icon: <ShoppingBag className="h-4 w-4" /> },
    { key: "applicants", label: "RC Applicants", icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: "active", label: "Active RideCheckers", icon: <CheckCircle2 className="h-4 w-4" /> },
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            People
          </h1>
          <p className="text-sm text-muted-foreground">
            All profiles — customers, applicants, and team members
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
                        <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
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

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch(""); }}
            data-testid={`card-tab-${tab.key}`}
            className={`text-left rounded-lg border p-4 transition-colors ${
              activeTab === tab.key
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/40"
            }`}
          >
            <div className={`flex items-center gap-2 mb-1 ${activeTab === tab.key ? "text-primary" : "text-muted-foreground"}`}>
              {tab.icon}
              <span className="text-xs font-medium">{tab.label}</span>
            </div>
            <p className="text-2xl font-bold">{counts[tab.key]}</p>
          </button>
        ))}
      </div>

      {/* Pending Invites */}
      {invites.filter((i) => !i.used_at && new Date(i.expires_at) > new Date()).length > 0 && (
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${TABS.find((t) => t.key === activeTab)?.label.toLowerCase()}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-users"
        />
      </div>

      {/* Table */}
      {filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
            <Inbox className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">No records found</h3>
          <p className="text-sm text-muted-foreground">
            {search ? "Try a different search term." : `No profiles match the "${TABS.find((t) => t.key === activeTab)?.label}" filter.`}
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const tags = getPersonaTags(user, orderUserIds, stageHistoryIds);
                return (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <Badge
                            key={tag.label}
                            variant={tag.variant}
                            className={tag.className}
                            data-testid={`badge-persona-${user.id}`}
                          >
                            {tag.label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
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
                            <SelectItem key={r} value={r}>{getRoleLabel(r)}</SelectItem>
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
                        onClick={() => handleToggleActive(user.id, user.is_active)}
                        data-testid={`button-toggle-${user.id}`}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
