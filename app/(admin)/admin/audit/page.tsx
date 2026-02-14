"use client";

import { useEffect, useState, useCallback } from "react";
import type { AuditLogEntry } from "@/types/orders";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/utils/format";
import { Search } from "lucide-react";

const RESOURCE_TYPES = ["all", "order", "inspector", "user", "profile", "audit"];

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [resourceType, setResourceType] = useState("all");
  const [actionSearch, setActionSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 25;

  const loadEntries = useCallback(
    async (append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const params = new URLSearchParams();
      params.set("limit", String(LIMIT));
      params.set("offset", String(append ? offset : 0));
      if (resourceType !== "all") params.set("resource_type", resourceType);
      if (actionSearch.trim()) params.set("action", actionSearch.trim());

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) {
        setError("Failed to load audit log");
        if (append) setLoadingMore(false);
        else setLoading(false);
        return;
      }
      setError(null);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data?.entries || [];

      if (append) {
        setEntries((prev) => [...prev, ...list]);
      } else {
        setEntries(list);
      }
      setHasMore(list.length === LIMIT);
      setOffset((append ? offset : 0) + list.length);

      if (append) setLoadingMore(false);
      else setLoading(false);
    },
    [resourceType, actionSearch, offset],
  );

  useEffect(() => {
    setOffset(0);
    loadEntries(false);
  }, [resourceType, actionSearch]);

  const loadMore = () => {
    loadEntries(true);
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
          Audit Log
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide audit trail (owner access)
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger className="w-[180px]" data-testid="select-resource-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESOURCE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "All Resources" : t.charAt(0).toUpperCase() + t.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={actionSearch}
            onChange={(e) => setActionSearch(e.target.value)}
            placeholder="Search action..."
            className="pl-9 w-[200px]"
            data-testid="input-action-search"
          />
        </div>
      </div>

      {error ? (
        <div className="bg-destructive/10 text-destructive p-4 rounded-md" data-testid="text-error">
          {error}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No audit entries found.</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} data-testid={`row-audit-${entry.id}`}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDateTime(entry.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.actor_email || "System"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.actor_role || "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {entry.action}
                  </TableCell>
                  <TableCell className="text-sm">
                    {entry.resource_type}
                    {entry.resource_id && (
                      <span className="text-muted-foreground ml-1 font-mono text-xs">
                        {entry.resource_id.slice(0, 8)}...
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {entry.new_value
                      ? JSON.stringify(entry.new_value).slice(0, 80)
                      : entry.metadata
                      ? JSON.stringify(entry.metadata).slice(0, 80)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {hasMore && entries.length > 0 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
            data-testid="button-load-more"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
