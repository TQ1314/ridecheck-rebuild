"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, Star, TrendingUp, Zap } from "lucide-react";
import { formatRelative } from "@/lib/utils/format";

interface ScoreEvent {
  id: string;
  event_type: string;
  points: number;
  reason: string;
  assignment_id: string | null;
  created_at: string;
}

interface NextTierInfo {
  tier: string;
  threshold: number;
  pointsNeeded: number;
}

interface ScoreData {
  score: number;
  tier: string;
  prevThreshold: number;
  nextTier: NextTierInfo | null;
  events: ScoreEvent[];
  stats: {
    jobsCompleted: number;
    onTimePct: number;
    lastUpdated: string | null;
  };
}

const TIER_STYLE: Record<string, string> = {
  "Rookie":              "bg-slate-100 text-slate-700 border-slate-200",
  "Trusted":             "bg-blue-100  text-blue-700  border-blue-200",
  "Elite":               "bg-purple-100 text-purple-700 border-purple-200",
  "Master RideChecker":  "bg-amber-100 text-amber-700  border-amber-200",
};

const TIER_BAR: Record<string, string> = {
  "Rookie":             "from-slate-400  to-slate-500",
  "Trusted":            "from-blue-400   to-blue-600",
  "Elite":              "from-purple-400 to-purple-600",
  "Master RideChecker": "from-amber-400  to-amber-600",
};

function TierIcon({ tier, className }: { tier: string; className?: string }) {
  const cls = className ?? "h-3 w-3 mr-1";
  if (tier === "Master RideChecker") return <Award className={cls} />;
  if (tier === "Elite")              return <Zap   className={cls} />;
  if (tier === "Trusted")            return <TrendingUp className={cls} />;
  return <Star className={cls} />;
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3 animate-pulse">
        <div className="h-3 bg-muted rounded w-28" />
        <div className="h-12 bg-muted rounded w-20" />
        <div className="h-4 bg-muted rounded w-20" />
        <div className="h-2 bg-muted rounded-full" />
      </CardContent>
    </Card>
  );
}

export function ScoreCard() {
  const [data, setData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ridechecker/scorecard")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonCard />;
  if (!data) return null;

  const { score, tier, prevThreshold, nextTier, events, stats } = data;
  const recentEvents = events.slice(0, 5);

  const rangeSize = nextTier ? nextTier.threshold - prevThreshold : Math.max(score - prevThreshold, 1);
  const progressInRange = score - prevThreshold;
  const progressPct = nextTier
    ? Math.min(100, Math.max(0, Math.round((progressInRange / rangeSize) * 100)))
    : 100;

  const mostRecent = recentEvents[0];

  return (
    <div className="space-y-3" data-testid="scorecard-container">

      {/* ── Main score card ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
            Your RideCheck Score
          </p>

          <div className="flex items-end gap-3 mb-2">
            <span
              className="text-5xl font-black tracking-tight tabular-nums leading-none"
              data-testid="text-ridechecker-score"
            >
              {score.toLocaleString()}
            </span>
            {mostRecent && (
              <span
                className={`text-sm font-bold mb-1 ${
                  mostRecent.points > 0 ? "text-green-600" : mostRecent.points < 0 ? "text-red-500" : "text-muted-foreground"
                }`}
                data-testid="text-recent-delta"
              >
                {mostRecent.points > 0 ? "+" : ""}{mostRecent.points}
              </span>
            )}
          </div>

          <Badge
            className={`text-xs font-semibold border ${TIER_STYLE[tier] ?? TIER_STYLE["Rookie"]}`}
            data-testid="badge-tier"
          >
            <TierIcon tier={tier} />
            {tier}
          </Badge>

          {/* Progress bar */}
          {nextTier ? (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{tier}</span>
                <span>{nextTier.tier}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${TIER_BAR[tier] ?? "from-slate-400 to-slate-600"} rounded-full transition-all duration-700`}
                  style={{ width: `${progressPct}%` }}
                  data-testid="progress-bar-tier"
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-right">
                {nextTier.pointsNeeded} pts to reach {nextTier.tier}
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-semibold border">
                <Award className="h-3 w-3 mr-1" />
                Top tier reached — keep it up!
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent activity ─────────────────────────────────────────────── */}
      {recentEvents.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Recent Activity
            </p>
            <div className="space-y-0">
              {recentEvents.map((ev, i) => (
                <div
                  key={ev.id}
                  className={`flex items-center justify-between gap-3 py-2.5 ${
                    i < recentEvents.length - 1 ? "border-b" : ""
                  }`}
                  data-testid={`score-event-${ev.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{ev.reason}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatRelative(ev.created_at)}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-bold flex-shrink-0 tabular-nums ${
                      ev.points > 0 ? "text-green-600" : ev.points < 0 ? "text-red-500" : "text-muted-foreground"
                    }`}
                  >
                    {ev.points > 0 ? "+" : ""}{ev.points !== 0 ? ev.points : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Jobs Done</p>
            <p className="text-2xl font-bold mt-0.5 tabular-nums" data-testid="text-jobs-completed">
              {stats.jobsCompleted}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">On-Time Rate</p>
            <p className="text-2xl font-bold mt-0.5 tabular-nums" data-testid="text-on-time-pct">
              {stats.onTimePct > 0 ? `${Math.round(stats.onTimePct)}%` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
