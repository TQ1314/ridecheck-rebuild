import "server-only";
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { GeneratedReport, ReportMeta, SystemStatus, RepairPriority, VerdictType } from "./types";

Font.register({
  family: "Helvetica",
  fonts: [],
});

const C = {
  green_dark:    "#14532d",
  green_medium:  "#16a34a",
  green_light:   "#dcfce7",
  white:         "#ffffff",
  gray_50:       "#f9fafb",
  gray_100:      "#f3f4f6",
  gray_200:      "#e5e7eb",
  gray_400:      "#9ca3af",
  gray_600:      "#4b5563",
  gray_700:      "#374151",
  gray_900:      "#111827",
  muted:         "#6b7280",
  border:        "#e5e7eb",
  good:          "#16a34a",
  good_bg:       "#f0fdf4",
  monitor:       "#d97706",
  monitor_bg:    "#fffbeb",
  risk:          "#ea580c",
  risk_bg:       "#fff7ed",
  fail:          "#dc2626",
  fail_bg:       "#fef2f2",
};

function verdictColor(v: VerdictType): string {
  switch (v) {
    case "BUY":                  return "#15803d";
    case "NEGOTIATE":            return "#d97706";
    case "DO_NOT_BUY_AT_ASKING": return "#ea580c";
    case "WALK_AWAY":            return "#dc2626";
  }
}

function verdictLabel(v: VerdictType): string {
  switch (v) {
    case "BUY":                  return "BUY";
    case "NEGOTIATE":            return "NEGOTIATE";
    case "DO_NOT_BUY_AT_ASKING": return "DO NOT BUY AT ASKING PRICE";
    case "WALK_AWAY":            return "WALK AWAY";
  }
}

function statusColor(s: SystemStatus): string {
  switch (s) {
    case "GOOD":    return C.good;
    case "MONITOR": return C.monitor;
    case "RISK":    return C.risk;
    case "FAIL":    return C.fail;
  }
}

function statusBg(s: SystemStatus): string {
  switch (s) {
    case "GOOD":    return C.good_bg;
    case "MONITOR": return C.monitor_bg;
    case "RISK":    return C.risk_bg;
    case "FAIL":    return C.fail_bg;
  }
}

function priorityColor(p: RepairPriority): string {
  switch (p) {
    case "Immediate": return C.fail;
    case "Soon":      return C.risk;
    case "Optional":  return C.monitor;
    case "Monitor":   return C.gray_600;
  }
}

function fmt(n?: number): string {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    fontSize: 8.5,
    color: C.gray_900,
    paddingBottom: 45,
  },

  // ─── HEADER ──────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.green_dark,
    paddingVertical: 14,
    paddingHorizontal: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "column" },
  headerBrand: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 3,
  },
  headerSub: {
    fontSize: 7.5,
    color: "#bbf7d0",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  headerRight: { alignItems: "flex-end" },
  headerUrl: {
    fontSize: 8,
    color: "#86efac",
    fontFamily: "Helvetica-Oblique",
  },

  // ─── VEHICLE BLOCK ───────────────────────────────────────────────────────
  vehicleBlock: {
    paddingHorizontal: 36,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  vehicleTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: C.green_dark,
    marginBottom: 2,
  },
  vehicleSubtitle: {
    fontSize: 9,
    color: C.gray_600,
    marginBottom: 10,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metaCell: {
    width: "50%",
    flexDirection: "row",
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.gray_400,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    width: 90,
  },
  metaValue: {
    fontSize: 7.5,
    color: C.gray_900,
    flex: 1,
  },

  // ─── VERDICT ─────────────────────────────────────────────────────────────
  verdictBanner: {
    marginHorizontal: 36,
    marginVertical: 10,
    padding: 11,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  verdictLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  verdictSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginRight: 8,
  },
  verdictLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    flex: 1,
  },
  verdictTagline: {
    fontSize: 7.5,
    color: "rgba(255,255,255,0.88)",
    textAlign: "right",
    maxWidth: 180,
  },

  // ─── CONTENT ─────────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 36,
    paddingTop: 6,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 10,
  },
  sectionBar: {
    width: 3,
    height: 12,
    backgroundColor: C.green_medium,
    borderRadius: 2,
    marginRight: 6,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.green_dark,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  // ─── INSIGHTS ────────────────────────────────────────────────────────────
  insightBlock: {
    flexDirection: "row",
    marginBottom: 9,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.gray_100,
  },
  insightBulletBox: {
    width: 16,
    height: 16,
    backgroundColor: C.green_dark,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    marginTop: 1,
    flexShrink: 0,
  },
  insightBulletText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  insightContent: { flex: 1 },
  insightTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.gray_900,
    marginBottom: 3,
  },
  insightBody: {
    fontSize: 8,
    color: C.gray_700,
    lineHeight: 1.45,
  },

  // ─── SYSTEMS ─────────────────────────────────────────────────────────────
  systemRow: {
    flexDirection: "row",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.gray_100,
  },
  systemNameCol: { width: 115 },
  systemName: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.gray_900,
    marginBottom: 4,
    lineHeight: 1.2,
  },
  statusBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  systemDescCol: { flex: 1, paddingHorizontal: 10 },
  systemDesc: { fontSize: 8, color: C.gray_700, lineHeight: 1.4 },
  systemCostCol: { width: 95, alignItems: "flex-end" },
  systemCost: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.gray_900,
    textAlign: "right",
  },
  systemCostNote: {
    fontSize: 7,
    color: C.muted,
    textAlign: "right",
    lineHeight: 1.3,
  },

  // ─── OBD TABLE ───────────────────────────────────────────────────────────
  table: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: C.gray_100,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.gray_100,
  },
  tableRowLast: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  thText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.gray_600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tdText: { fontSize: 8, color: C.gray_900 },
  tdMuted: { fontSize: 7.5, color: C.muted },
  col_sys:    { width: 95 },
  col_stat:   { width: 60 },
  col_codes:  { width: 85 },
  col_desc:   { flex: 1 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot_on:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.fail,  marginRight: 4 },
  dot_off: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.good,  marginRight: 4 },
  dot_ok:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.monitor, marginRight: 4 },

  // ─── PHOTO GRID ──────────────────────────────────────────────────────────
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoBlock: {
    width: "48%",
    marginBottom: 8,
  },
  photoImg: {
    width: "100%",
    height: 110,
    objectFit: "cover",
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  photoCaption: {
    fontSize: 6.5,
    color: C.muted,
    marginTop: 3,
    textAlign: "center",
  },
  photoPlaceholder: {
    width: "100%",
    height: 110,
    backgroundColor: C.gray_100,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    fontSize: 7,
    color: C.gray_400,
  },

  // ─── REPAIR ESTIMATES ────────────────────────────────────────────────────
  repairRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.gray_100,
    alignItems: "center",
  },
  repairTotalRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: C.gray_50,
    borderTopWidth: 2,
    borderTopColor: C.gray_200,
    alignItems: "center",
  },
  rCol_item:     { flex: 1 },
  rCol_priority: { width: 75 },
  rCol_low:      { width: 65, textAlign: "right" },
  rCol_high:     { width: 65, textAlign: "right" },
  priorityBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  priorityText: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  // ─── NEGOTIATION ─────────────────────────────────────────────────────────
  negotiationOption: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: C.gray_50,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: C.green_medium,
  },
  negotiationLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.green_dark,
    marginBottom: 4,
  },
  negotiationDesc: {
    fontSize: 8,
    color: C.gray_700,
    lineHeight: 1.4,
  },

  // ─── DISCLAIMER ──────────────────────────────────────────────────────────
  disclaimer: {
    marginTop: 10,
    padding: 9,
    backgroundColor: C.gray_50,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  disclaimerText: {
    fontSize: 6.5,
    color: C.muted,
    lineHeight: 1.4,
    textAlign: "center",
  },

  // ─── FOOTER ──────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 14,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 5,
  },
  footerText: { fontSize: 6.5, color: C.muted },
  footerPage: { fontSize: 6.5, color: C.muted },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 8,
    marginHorizontal: 36,
  },
});

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function Header() {
  return (
    <View style={s.header} fixed>
      <View style={s.headerLeft}>
        <Text style={s.headerBrand}>RIDECHECK</Text>
        <Text style={s.headerSub}>Pre-Purchase Vehicle Inspection Report</Text>
      </View>
      <View style={s.headerRight}>
        <Text style={s.headerUrl}>ridecheckauto.com</Text>
      </View>
    </View>
  );
}

function Footer({ meta }: { meta: ReportMeta }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>
        Report #{meta.report_number} | Inspection Date: {meta.inspection_date}
      </Text>
      <Text
        style={s.footerPage}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={s.sectionRow}>
      <View style={s.sectionBar} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: SystemStatus }) {
  return (
    <View style={[s.statusBadge, { backgroundColor: statusBg(status) }]}>
      <Text style={[s.statusText, { color: statusColor(status) }]}>
        ■ {status}
      </Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: RepairPriority }) {
  return (
    <View style={[s.priorityBadge, { backgroundColor: `${priorityColor(priority)}15` }]}>
      <Text style={[s.priorityText, { color: priorityColor(priority) }]}>
        ■ {priority}
      </Text>
    </View>
  );
}

function PhotoBlock({ url, caption }: { url?: string; caption: string }) {
  return (
    <View style={s.photoBlock}>
      {url ? (
        <Image style={s.photoImg} src={url} />
      ) : (
        <View style={s.photoPlaceholder}>
          <Text style={s.photoPlaceholderText}>Photo</Text>
        </View>
      )}
      <Text style={s.photoCaption}>■ {caption}</Text>
    </View>
  );
}

// ─── MAIN DOCUMENT ───────────────────────────────────────────────────────────

interface Props {
  report: GeneratedReport;
  meta: ReportMeta;
}

export function RideCheckReport({ report, meta }: Props) {
  const verdictBg = verdictColor(report.verdict);

  const allPhotos: Array<{ url?: string; caption: string }> = [
    { url: meta.vin_photo_url,          caption: "VIN — Vehicle identification" },
    { url: meta.odometer_photo_url,     caption: "Odometer — Mileage reading" },
    { url: meta.under_hood_photo_url,   caption: "Engine bay — Under hood condition" },
    { url: meta.undercarriage_photo_url,caption: "Undercarriage — Frame and underbody" },
    ...(meta.extra_photos || []).map((url, i) => ({
      url,
      caption: `Additional photo ${i + 1}`,
    })),
  ];

  return (
    <Document
      title={`RideCheck Report — ${meta.vehicle_year} ${meta.vehicle_make} ${meta.vehicle_model}`}
      author="RideCheck"
    >
      <Page size="LETTER" style={s.page}>
        <Header />

        {/* ── Vehicle info ── */}
        <View style={s.vehicleBlock}>
          <Text style={s.vehicleTitle}>
            {meta.vehicle_year} {meta.vehicle_make}
          </Text>
          <Text style={s.vehicleSubtitle}>
            Pre-Purchase Vehicle Inspection — {meta.vehicle_model}
            {meta.vehicle_trim ? ` ${meta.vehicle_trim}` : ""} —{" "}
            {meta.package_tier}
          </Text>
          <View style={s.metaGrid}>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Mileage</Text>
              <Text style={s.metaValue}>{meta.vehicle_mileage}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Inspection Date</Text>
              <Text style={s.metaValue}>{meta.inspection_date}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Asking Price</Text>
              <Text style={s.metaValue}>{meta.vehicle_price}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Report #</Text>
              <Text style={s.metaValue}>{meta.report_number}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Location</Text>
              <Text style={s.metaValue}>{meta.inspection_location}</Text>
            </View>
            <View style={s.metaCell}>
              <Text style={s.metaLabel}>Inspector</Text>
              <Text style={s.metaValue}>RideCheck Specialist</Text>
            </View>
          </View>
        </View>

        {/* ── Verdict banner ── */}
        <View style={[s.verdictBanner, { backgroundColor: verdictBg }]}>
          <View style={s.verdictLeft}>
            <View style={s.verdictSquare} />
            <Text style={s.verdictLabel}>
              {verdictLabel(report.verdict)}
            </Text>
          </View>
          <Text style={s.verdictTagline}>{report.verdict_tagline}</Text>
        </View>

        {/* ── Top Insights ── */}
        <View style={s.content}>
          <SectionTitle title="Top 3 Buyer Insights" />
          {report.top_insights.slice(0, 3).map((insight, i) => (
            <View key={i} style={s.insightBlock}>
              <View style={s.insightBulletBox}>
                <Text style={s.insightBulletText}>■</Text>
              </View>
              <View style={s.insightContent}>
                <Text style={s.insightTitle}>{insight.title}</Text>
                <Text style={s.insightBody}>{insight.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── System assessment ── */}
        <View style={s.content} break>
          <SectionTitle title="System-by-System Assessment" />
          {report.systems.map((sys, i) => (
            <View key={i} style={s.systemRow} wrap={false}>
              <View style={s.systemNameCol}>
                <Text style={s.systemName}>{sys.name}</Text>
                <StatusBadge status={sys.status} />
              </View>
              <View style={s.systemDescCol}>
                <Text style={s.systemDesc}>{sys.description}</Text>
              </View>
              <View style={s.systemCostCol}>
                {sys.cost_low != null && sys.cost_high != null ? (
                  <Text style={s.systemCost}>
                    {fmt(sys.cost_low)} – {fmt(sys.cost_high)}
                  </Text>
                ) : null}
                {sys.cost_note ? (
                  <Text style={s.systemCostNote}>{sys.cost_note}</Text>
                ) : null}
                {sys.cost_low == null && sys.cost_high == null && !sys.cost_note ? (
                  <Text style={s.systemCost}>No action needed</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {/* ── OBD Table ── */}
        {report.obd_entries.length > 0 && (
          <View style={s.content} wrap={false}>
            <SectionTitle title="OBD-II Diagnostic Data" />
            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.thText, s.col_sys]}>System</Text>
                <Text style={[s.thText, s.col_stat]}>Status</Text>
                <Text style={[s.thText, s.col_codes]}>Code(s)</Text>
                <Text style={[s.thText, s.col_desc]}>Description</Text>
              </View>
              {report.obd_entries.map((entry, i) => {
                const isLast = i === report.obd_entries.length - 1;
                return (
                  <View key={i} style={isLast ? s.tableRowLast : s.tableRow}>
                    <Text style={[s.tdText, s.col_sys]}>{entry.system}</Text>
                    <View style={[s.col_stat, s.statusPill]}>
                      <View style={entry.is_active ? s.dot_on : s.dot_off} />
                      <Text style={entry.is_active ? [s.tdText, { color: C.fail }] : [s.tdText, { color: C.good }]}>
                        {entry.status_label}
                      </Text>
                    </View>
                    <Text style={[s.tdMuted, s.col_codes]}>{entry.codes}</Text>
                    <Text style={[s.tdText, s.col_desc]}>{entry.description}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Photo Documentation ── */}
        {allPhotos.length > 0 && (
          <View style={s.content} break>
            <SectionTitle title="Photo Documentation" />
            <View style={s.photoGrid}>
              {allPhotos.map((photo, i) => (
                <PhotoBlock key={i} url={photo.url} caption={photo.caption} />
              ))}
            </View>
          </View>
        )}

        {/* ── Repair Estimates ── */}
        <View style={s.content} break>
          <SectionTitle title="Repair Cost Estimate Summary" />
          <Text style={{ fontSize: 7, color: C.muted, marginBottom: 6 }}>
            All estimates reflect Chicago-area labor rates. Actual costs may vary. These are informed estimates, not binding quotes.
          </Text>
          <View style={s.table}>
            <View style={s.tableHead}>
              <Text style={[s.thText, s.rCol_item]}>Item</Text>
              <Text style={[s.thText, s.rCol_priority]}>Priority</Text>
              <Text style={[s.thText, { ...s.rCol_low, textAlign: "right" }]}>Est. Low</Text>
              <Text style={[s.thText, { ...s.rCol_high, textAlign: "right" }]}>Est. High</Text>
            </View>
            {report.repair_estimates.map((est, i) => (
              <View key={i} style={s.repairRow} wrap={false}>
                <Text style={[s.tdText, s.rCol_item]}>{est.item}</Text>
                <View style={s.rCol_priority}>
                  <PriorityBadge priority={est.priority} />
                </View>
                <Text style={[s.tdText, { width: 65, textAlign: "right" }]}>{fmt(est.cost_low)}</Text>
                <Text style={[s.tdText, { width: 65, textAlign: "right" }]}>{fmt(est.cost_high)}</Text>
              </View>
            ))}
            <View style={s.repairTotalRow} wrap={false}>
              <Text style={[s.tdText, s.rCol_item, { fontFamily: "Helvetica-Bold" }]}>
                Total Estimated Repairs
              </Text>
              <View style={s.rCol_priority} />
              <Text style={[s.tdText, { width: 65, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                {fmt(report.total_repair_low)}
              </Text>
              <Text style={[s.tdText, { width: 65, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>
                {fmt(report.total_repair_high)}
              </Text>
            </View>
          </View>

          {/* ── Negotiation Guidance ── */}
          <SectionTitle title="Negotiation Guidance" />
          {report.negotiation_options.map((opt, i) => (
            <View key={i} style={s.negotiationOption} wrap={false}>
              <Text style={s.negotiationLabel}>{opt.label}</Text>
              <Text style={s.negotiationDesc}>{opt.description}</Text>
            </View>
          ))}

          {/* ── Disclaimer ── */}
          <View style={s.disclaimer} wrap={false}>
            <Text style={s.disclaimerText}>
              This report reflects visual observations and OBD-II diagnostic data collected at the time of inspection. It is not a guarantee of condition and does not constitute a warranty. RideCheck
              is not responsible for undisclosed issues or post-inspection changes. Repair cost estimates are approximations based on Chicago-area rates and may vary significantly by shop and
              market conditions. This report is intended to inform — not replace — a buyer&apos;s own due diligence. Governed by Illinois law, Lake County venue.
              ridecheckauto.com
            </Text>
          </View>
        </View>

        <Footer meta={meta} />
      </Page>
    </Document>
  );
}
