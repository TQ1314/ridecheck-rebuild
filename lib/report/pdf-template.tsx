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
import type {
  GeneratedReport,
  ReportMeta,
  RoadTestModule,
  OBDModule,
  SystemStatus,
  RepairPriority,
  VerdictType,
  ScopeRow,
  ConfidenceLevel,
  TitleTransferReadinessSummary,
} from "./types";

Font.register({ family: "Helvetica", fonts: [] });

// ─── COLOR PALETTE ────────────────────────────────────────────────────────────
const C = {
  green_dark:   "#14532d",
  green_medium: "#16a34a",
  green_light:  "#dcfce7",
  green_100:    "#d1fae5",
  white:        "#ffffff",
  gray_50:      "#f9fafb",
  gray_100:     "#f3f4f6",
  gray_200:     "#e5e7eb",
  gray_300:     "#d1d5db",
  gray_400:     "#9ca3af",
  gray_600:     "#4b5563",
  gray_700:     "#374151",
  gray_900:     "#111827",
  muted:        "#6b7280",
  border:       "#e5e7eb",
  good:         "#16a34a",
  good_bg:      "#f0fdf4",
  monitor:      "#d97706",
  monitor_bg:   "#fffbeb",
  risk:         "#ea580c",
  risk_bg:      "#fff7ed",
  fail:         "#dc2626",
  fail_bg:      "#fef2f2",
  black:        "#000000",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function verdictColor(v: VerdictType): string {
  switch (v) {
    case "LOW_RISK":      return "#15803d";
    case "MODERATE_RISK": return "#b45309";
    case "HIGH_RISK":     return "#b91c1c";
  }
}
function verdictBg(v: VerdictType): string {
  switch (v) {
    case "LOW_RISK":      return "#f0fdf4";
    case "MODERATE_RISK": return "#fffbeb";
    case "HIGH_RISK":     return "#fef2f2";
  }
}
function verdictBorder(v: VerdictType): string {
  switch (v) {
    case "LOW_RISK":      return "#bbf7d0";
    case "MODERATE_RISK": return "#fde68a";
    case "HIGH_RISK":     return "#fecaca";
  }
}
function verdictLabel(v: VerdictType): string {
  switch (v) {
    case "LOW_RISK":      return "LOW RISK OBSERVED";
    case "MODERATE_RISK": return "MODERATE RISK OBSERVED";
    case "HIGH_RISK":     return "HIGH FINANCIAL RISK OBSERVED";
  }
}
function verdictDot(v: VerdictType): string {
  switch (v) {
    case "LOW_RISK":      return "●";
    case "MODERATE_RISK": return "●";
    case "HIGH_RISK":     return "●";
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
function confidenceColor(c: ConfidenceLevel): string {
  switch (c) {
    case "HIGH CONFIDENCE":     return C.good;
    case "MODERATE CONFIDENCE": return C.monitor;
    case "LIMITED CONFIDENCE":  return C.fail;
  }
}
function confidenceBg(c: ConfidenceLevel): string {
  switch (c) {
    case "HIGH CONFIDENCE":     return C.good_bg;
    case "MODERATE CONFIDENCE": return C.monitor_bg;
    case "LIMITED CONFIDENCE":  return C.fail_bg;
  }
}
function riskLevelColors(level: string): { bg: string; border: string; text: string } {
  switch (level) {
    case "HIGH":     return { bg: C.fail_bg,    border: "#FECACA", text: C.fail };
    case "ELEVATED": return { bg: C.risk_bg,    border: "#FED7AA", text: C.risk };
    case "MODERATE": return { bg: C.monitor_bg, border: "#FDE68A", text: C.monitor };
    default:         return { bg: C.good_bg,    border: "#BBF7D0", text: C.good };
  }
}
function riskLevelLabel(level: string): string {
  switch (level) {
    case "HIGH":     return "HIGH RISK";
    case "ELEVATED": return "ELEVATED RISK";
    case "MODERATE": return "MODERATE RISK";
    default:         return "LOW RISK";
  }
}
function dtcStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "active":  return C.fail;
    case "pending": return C.monitor;
    case "stored":  return C.gray_600;
    default:        return C.gray_400;
  }
}
function scopeDotStyle(status: ScopeRow["status"]) {
  switch (status) {
    case "assessed":     return s.scopeDotAssessed;
    case "partial":      return s.scopeDotPartial;
    case "not_assessed": return s.scopeDotNotAssessed;
  }
}
function fmt(n?: number): string {
  if (n == null) return "—";
  return `$${n.toLocaleString()}`;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    fontSize: 8.5,
    color: C.gray_900,
    paddingBottom: 50,
  },

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  coverPage: {
    backgroundColor: C.white,
    fontSize: 8.5,
    color: C.gray_900,
  },
  coverTopBand: {
    backgroundColor: C.green_dark,
    paddingVertical: 18,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  coverBrand: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 4,
  },
  coverBrandSub: {
    fontSize: 8,
    color: "#86efac",
    marginTop: 3,
    letterSpacing: 0.8,
  },
  coverTopRight: {
    alignItems: "flex-end",
  },
  coverTopRightLabel: {
    fontSize: 7,
    color: "#86efac",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  coverTopRightValue: {
    fontSize: 9,
    color: C.white,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  coverHeroContainer: {
    height: 200,
    backgroundColor: C.gray_100,
    overflow: "hidden",
  },
  coverHeroImage: {
    width: "100%",
    height: 200,
    objectFit: "cover",
  },
  coverHeroPlaceholder: {
    height: 200,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  coverHeroPlaceholderText: {
    fontSize: 8,
    color: C.gray_400,
    letterSpacing: 0.5,
  },
  coverBody: {
    paddingHorizontal: 40,
    paddingTop: 20,
    paddingBottom: 20,
  },
  coverVehicleTitle: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: C.green_dark,
    marginBottom: 2,
    lineHeight: 1.1,
  },
  coverVehicleSub: {
    fontSize: 12,
    color: C.gray_600,
    marginBottom: 16,
  },
  coverMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  coverMetaCell: {
    width: "33.33%",
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: C.border,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  coverMetaCellLast: {
    width: "33.33%",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  coverMetaLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.gray_400,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  coverMetaValue: {
    fontSize: 9,
    color: C.gray_900,
    fontFamily: "Helvetica-Bold",
  },
  coverBadgeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  coverRiskBadge: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
  },
  coverRiskLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  coverRiskValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
  },
  coverConfidenceBadge: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
  },
  coverConfLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  coverConfValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  coverFindingsTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.green_dark,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: C.green_dark,
  },
  coverFindingRow: {
    flexDirection: "row",
    marginBottom: 8,
    padding: 10,
    backgroundColor: C.gray_50,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: C.green_medium,
  },
  coverFindingNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.green_dark,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  coverFindingNumText: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.white,
  },
  coverFindingBody: { flex: 1 },
  coverFindingTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.gray_900,
    marginBottom: 2,
  },
  coverFindingText: {
    fontSize: 7.5,
    color: C.gray_700,
    lineHeight: 1.4,
  },
  coverTagline: {
    marginTop: 16,
    padding: 10,
    backgroundColor: C.gray_50,
    borderRadius: 3,
    borderTopWidth: 3,
    borderTopColor: C.green_dark,
    textAlign: "center",
  },
  coverTaglineText: {
    fontSize: 7.5,
    color: C.gray_600,
    lineHeight: 1.5,
    textAlign: "center",
  },

  // ── INTERIOR PAGE HEADER ────────────────────────────────────────────────────
  header: {
    backgroundColor: C.green_dark,
    paddingVertical: 10,
    paddingHorizontal: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerBrand: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 3,
  },
  headerDivider: {
    width: 1,
    height: 14,
    backgroundColor: "#4ade80",
    marginHorizontal: 2,
  },
  headerSub: {
    fontSize: 7,
    color: "#86efac",
    letterSpacing: 0.5,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerReportLine: {
    fontSize: 7,
    color: "#86efac",
    fontFamily: "Helvetica-Bold",
  },
  headerDateLine: {
    fontSize: 6.5,
    color: "#bbf7d0",
    marginTop: 1,
  },

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 12,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 5,
  },
  footerLeft: { flex: 1 },
  footerBrand: {
    fontSize: 6.5,
    color: C.muted,
    fontFamily: "Helvetica-Bold",
  },
  footerContact: {
    fontSize: 6,
    color: C.gray_400,
    marginTop: 1,
  },
  footerPage: {
    fontSize: 6.5,
    color: C.muted,
    textAlign: "right",
  },

  // ── CONTENT AREA ────────────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 36,
    paddingTop: 6,
  },

  // ── SECTION HEADER ──────────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 12,
  },
  sectionBar: {
    width: 4,
    height: 14,
    backgroundColor: C.green_medium,
    borderRadius: 2,
    marginRight: 7,
  },
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.green_dark,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // ── VERDICT BANNER ──────────────────────────────────────────────────────────
  verdictBanner: {
    marginHorizontal: 36,
    marginVertical: 8,
    padding: 12,
    borderRadius: 5,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  verdictLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  verdictDot: {
    fontSize: 18,
    marginRight: 10,
    lineHeight: 1,
  },
  verdictLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },
  verdictTagline: {
    fontSize: 7.5,
    color: C.gray_600,
    textAlign: "right",
    maxWidth: 200,
    lineHeight: 1.4,
  },

  // ── ON-SITE KEY FINDINGS (insights) ─────────────────────────────────────────
  insightBlock: {
    flexDirection: "row",
    marginBottom: 9,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: C.gray_100,
  },
  insightBulletBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.green_dark,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
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

  // ── SYSTEM OBSERVATIONS ──────────────────────────────────────────────────────
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
  systemFieldLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.gray_400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
    marginTop: 4,
  },
  systemFieldText: { fontSize: 8, color: C.gray_700, lineHeight: 1.4 },
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

  // ── SCOPE TABLE ─────────────────────────────────────────────────────────────
  scopeTable: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    marginBottom: 10,
  },
  scopeHead: {
    flexDirection: "row",
    backgroundColor: C.gray_100,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  scopeRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.gray_100,
    alignItems: "center",
  },
  scopeRowLast: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  scopeColSystem: { width: 130 },
  scopeColLevel:  { flex: 1 },
  scopeColDot:    { width: 20, alignItems: "center" },
  scopeDotAssessed:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.good },
  scopeDotPartial:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.monitor },
  scopeDotNotAssessed: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.gray_300 },

  // ── CONFIDENCE + MISSING ────────────────────────────────────────────────────
  confidenceRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  confidenceBox: {
    flex: 1,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
  },
  confidenceLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.gray_400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  confidenceValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
  },
  confidenceNote: {
    fontSize: 6.5,
    color: C.muted,
    marginTop: 4,
    lineHeight: 1.4,
  },
  missingBox: {
    flex: 2,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.gray_50,
  },
  missingTitle: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.gray_400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  missingItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  missingDash: {
    fontSize: 7.5,
    color: C.monitor,
    marginRight: 4,
    fontFamily: "Helvetica-Bold",
  },
  missingText: { fontSize: 7.5, color: C.gray_700, flex: 1, lineHeight: 1.3 },
  missingNone: { fontSize: 7.5, color: C.good, fontFamily: "Helvetica-Bold" },

  // ── OBD DIAGNOSTICS ──────────────────────────────────────────────────────────
  obdScanBanner: {
    padding: 9, borderRadius: 3, marginBottom: 8, borderWidth: 1,
  },
  obdScanLabel: {
    fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase",
    letterSpacing: 0.4, marginBottom: 2,
  },
  obdScanValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  obdTwoCol:  { flexDirection: "row", gap: 8, marginBottom: 8 },
  obdBox: {
    flex: 1, padding: 8, borderWidth: 1, borderColor: C.border,
    borderRadius: 3, backgroundColor: C.gray_50,
  },
  obdBoxTitle: {
    fontSize: 7, fontFamily: "Helvetica-Bold", color: C.gray_600,
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5,
    borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 3,
  },
  obdLightItem: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  obdLightDot:  { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  obdLightText: { fontSize: 7.5, color: C.gray_900, flex: 1 },
  obdDTCTable:  { borderWidth: 1, borderColor: C.border, borderRadius: 3, marginBottom: 8 },
  obdDTCHead: {
    flexDirection: "row", backgroundColor: C.gray_100,
    paddingVertical: 5, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  obdDTCRow: {
    flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: C.gray_100, alignItems: "flex-start",
  },
  obdDTCRowLast: {
    flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, alignItems: "flex-start",
  },
  obdCol_sys:  { width: 70 },
  obdCol_code: { width: 60 },
  obdCol_stat: { width: 58 },
  obdCol_desc: { flex: 1 },
  obdStatusPill: {
    paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2, alignSelf: "flex-start",
  },
  obdNotesBox: {
    padding: 8, backgroundColor: C.gray_50, borderWidth: 1, borderColor: C.border,
    borderRadius: 3, marginBottom: 8,
  },
  obdNotesLabel: {
    fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.gray_400,
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3,
  },
  obdNotesText: { fontSize: 8, color: C.gray_700, lineHeight: 1.4 },
  obdFileRef:  { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  obdFileIcon: { fontSize: 7.5, color: C.gray_600, marginRight: 5, fontFamily: "Helvetica-Bold" },
  obdFileName: { fontSize: 7.5, color: C.gray_700 },
  obdPhotoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },

  // ── ODOMETER SECTION ────────────────────────────────────────────────────────
  odometerGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  odometerBox: {
    flex: 1,
    padding: 9,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    backgroundColor: C.gray_50,
  },
  odometerBoxTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.gray_600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 3,
  },
  odometerValue: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.gray_900,
    marginBottom: 2,
  },
  odometerSub: {
    fontSize: 7.5,
    color: C.gray_600,
    lineHeight: 1.3,
  },
  odometerFlagRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
    padding: 6,
    backgroundColor: C.monitor_bg,
    borderRadius: 3,
    borderLeftWidth: 3,
    borderLeftColor: C.monitor,
  },
  odometerFlagText: {
    fontSize: 7.5,
    color: "#92400e",
    flex: 1,
    lineHeight: 1.4,
  },
  odometerNote: {
    fontSize: 7.5,
    color: C.muted,
    lineHeight: 1.4,
    marginTop: 4,
    fontFamily: "Helvetica-Oblique",
  },

  // ── TITLE & HISTORY FLAGS ───────────────────────────────────────────────────
  thfBanner: {
    padding: 9, borderRadius: 3, marginBottom: 8,
    borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10,
  },
  thfBannerLabel: {
    fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase",
    letterSpacing: 0.4, marginBottom: 2, color: C.gray_400,
  },
  thfBannerValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  thfBannerSub: { fontSize: 7.5, color: C.gray_600, marginTop: 1 },
  thfBannerCol: { flex: 1 },
  thfGrid2: { flexDirection: "row", gap: 8, marginBottom: 8 },
  thfGrid3: { flexDirection: "row", gap: 8, marginBottom: 8 },
  thfBox: {
    flex: 1, padding: 8, borderWidth: 1, borderColor: C.border,
    borderRadius: 3, backgroundColor: C.gray_50,
  },
  thfBoxTitle: {
    fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.muted,
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 3,
  },
  thfBoxValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.gray_900, marginBottom: 2 },
  thfBoxSub:   { fontSize: 7, color: C.gray_600 },
  thfIndicatorGroup: {
    marginBottom: 8, padding: 8, borderWidth: 1, borderColor: C.border,
    borderRadius: 3, backgroundColor: C.gray_50,
  },
  thfIndicatorGroupTitle: {
    fontSize: 7, fontFamily: "Helvetica-Bold", color: C.gray_600,
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5,
    borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 3,
  },
  thfIndicatorRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 3 },
  thfIndicatorDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6, marginTop: 2 },
  thfIndicatorText: { fontSize: 7.5, color: C.gray_900, flex: 1, lineHeight: 1.3 },
  thfNoneText:      { fontSize: 7.5, color: C.good, flex: 1, lineHeight: 1.3 },
  thfNotesBox: {
    padding: 7, backgroundColor: C.gray_50, borderWidth: 1, borderColor: C.border,
    borderRadius: 3, marginBottom: 8,
  },
  thfNotesLabel: {
    fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.gray_400,
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3,
  },
  thfNotesText: { fontSize: 8, color: C.gray_700, lineHeight: 1.4 },
  thfVinPhotoRow: { flexDirection: "row", gap: 8, marginBottom: 8 },

  // ── ROAD TEST ───────────────────────────────────────────────────────────────
  rtGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  rtSubSection: {
    width: "48%",
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    backgroundColor: C.gray_50,
    marginBottom: 4,
  },
  rtSubTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.gray_600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 3,
  },
  rtItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 3,
  },
  rtCheckOn:  { fontSize: 7.5, color: C.good,    marginRight: 4, fontFamily: "Helvetica-Bold" },
  rtCheckOff: { fontSize: 7.5, color: C.gray_300, marginRight: 4 },
  rtItemOn:   { fontSize: 7.5, color: C.gray_900, flex: 1, lineHeight: 1.3 },
  rtItemOff:  { fontSize: 7.5, color: C.gray_400, flex: 1, lineHeight: 1.3 },
  rtOtherRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  rtOtherBox: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    backgroundColor: C.gray_50,
  },
  rtOtherTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.gray_600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 3,
  },
  rtConcernsBox: {
    padding: 8,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 3,
    marginBottom: 8,
  },
  rtConcernsLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#92400e",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  rtConcernsText: {
    fontSize: 8,
    color: C.gray_700,
    lineHeight: 1.4,
  },
  rtPhotosRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },

  // ── PHOTO DOCUMENTATION ─────────────────────────────────────────────────────
  photoGroupHeader: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.gray_600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
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

  // ── REPAIR ESTIMATES ────────────────────────────────────────────────────────
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

  // ── BUYER CONSIDERATIONS ────────────────────────────────────────────────────
  buyerConsiderationsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  buyerCol: {
    flex: 1,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
  },
  buyerColHeader: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  buyerItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  buyerIcon: {
    fontSize: 8,
    marginRight: 5,
    lineHeight: 1.4,
  },
  buyerText: {
    fontSize: 7.5,
    color: C.gray_700,
    flex: 1,
    lineHeight: 1.4,
  },

  // ── NEGOTIATION ─────────────────────────────────────────────────────────────
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

  // ── RISK INTELLIGENCE ───────────────────────────────────────────────────────
  riskBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 4,
    marginBottom: 8,
    borderWidth: 1,
  },
  riskScoreBlock: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  riskScoreNum: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1,
  },
  riskScoreLabel: {
    fontSize: 7,
    marginTop: 2,
  },
  riskLevelBig: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
  },
  riskModulesTable: {
    borderWidth: 1,
    borderRadius: 3,
    marginBottom: 8,
    overflow: "hidden",
  },
  riskModuleRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  riskModuleRowLast: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  riskModuleName: {
    width: 130,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.gray_700,
  },
  riskModuleValue: {
    flex: 1,
    fontSize: 8,
    color: C.gray_700,
  },
  riskModuleBadge: {
    width: 80,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  riskModuleBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
  },
  riskReasonsList: {
    marginTop: 6,
    marginBottom: 4,
  },
  riskReasonItem: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 2,
  },
  riskReasonBullet: {
    width: 10,
    fontSize: 7,
    color: C.gray_600,
  },
  riskReasonText: {
    flex: 1,
    fontSize: 7.5,
    color: C.gray_700,
    lineHeight: 1.35,
  },
  riskHardStopBanner: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 4,
    marginBottom: 6,
    marginTop: 4,
  },
  riskHardStopText: {
    fontSize: 7.5,
    color: "#991B1B",
    fontFamily: "Helvetica-Bold",
    flex: 1,
  },

  // ── DISCLAIMER ──────────────────────────────────────────────────────────────
  disclaimer: {
    marginTop: 12,
    padding: 10,
    backgroundColor: C.gray_50,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  disclaimerText: {
    fontSize: 6.5,
    color: C.muted,
    lineHeight: 1.45,
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 8,
    marginHorizontal: 36,
  },
});

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────

function PageHeader({ meta }: { meta: ReportMeta }) {
  return (
    <View style={s.header} fixed>
      <View style={s.headerLeft}>
        <Text style={s.headerBrand}>RIDECHECK</Text>
        <View style={s.headerDivider} />
        <Text style={s.headerSub}>Vehicle Transparency Report  ·  Field Inspection Document</Text>
      </View>
      <View style={s.headerRight}>
        <Text style={s.headerReportLine}>Report #{meta.report_number}</Text>
        <Text style={s.headerDateLine}>{meta.inspection_date}</Text>
      </View>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <View style={s.footerLeft}>
        <Text style={s.footerBrand}>RideCheck Vehicle Transparency Platform</Text>
        <Text style={s.footerContact}>
          ridecheckauto.com  ·  support@ridecheckauto.com  ·  Lake &amp; McHenry County, IL
        </Text>
      </View>
      <Text
        style={s.footerPage}
        render={({ pageNumber }) => `Page ${pageNumber}`}
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
      <Text style={[s.statusText, { color: statusColor(status) }]}>■ {status}</Text>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: RepairPriority }) {
  return (
    <View style={[s.priorityBadge, { backgroundColor: `${priorityColor(priority)}18` }]}>
      <Text style={[s.priorityText, { color: priorityColor(priority) }]}>■ {priority}</Text>
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
          <Text style={s.photoPlaceholderText}>Photo unavailable</Text>
        </View>
      )}
      <Text style={s.photoCaption}>■ {caption}</Text>
    </View>
  );
}

function RiskModuleBadge({ value, good }: { value: string; good: boolean }) {
  const bg   = good ? C.good_bg    : C.monitor_bg;
  const tc   = good ? C.good       : C.monitor;
  const bord = good ? "#BBF7D0"    : "#FDE68A";
  return (
    <View style={[s.riskModuleBadge, { backgroundColor: bg, borderWidth: 1, borderColor: bord }]}>
      <Text style={[s.riskModuleBadgeText, { color: tc }]}>{value}</Text>
    </View>
  );
}

// ─── COVER PAGE ───────────────────────────────────────────────────────────────

function CoverPage({ report, meta }: { report: GeneratedReport; meta: ReportMeta }) {
  const heroUrl = meta.under_hood_photo_url || meta.vin_photo_url || "";
  const vc = verdictColor(report.verdict);
  const vbg = verdictBg(report.verdict);
  const vbord = verdictBorder(report.verdict);
  const cc = confidenceColor(meta.confidence_level);
  const cbg = confidenceBg(meta.confidence_level);

  return (
    <>
      {/* Top branding band */}
      <View style={s.coverTopBand}>
        <View>
          <Text style={s.coverBrand}>RIDECHECK</Text>
          <Text style={s.coverBrandSub}>Vehicle Transparency Report  ·  Field Inspection Document</Text>
        </View>
        <View style={s.coverTopRight}>
          <Text style={s.coverTopRightLabel}>Report Number</Text>
          <Text style={s.coverTopRightValue}>{meta.report_number}</Text>
        </View>
      </View>

      {/* Hero photo */}
      {heroUrl ? (
        <View style={s.coverHeroContainer}>
          <Image style={s.coverHeroImage} src={heroUrl} />
        </View>
      ) : (
        <View style={s.coverHeroPlaceholder}>
          <Text style={s.coverHeroPlaceholderText}>VEHICLE INSPECTION DOCUMENTATION</Text>
        </View>
      )}

      {/* Cover body */}
      <View style={s.coverBody}>

        {/* Vehicle identity */}
        <Text style={s.coverVehicleTitle}>
          {meta.vehicle_year} {meta.vehicle_make} {meta.vehicle_model}
          {meta.vehicle_trim ? ` ${meta.vehicle_trim}` : ""}
        </Text>
        <Text style={s.coverVehicleSub}>{meta.package_tier}</Text>

        {/* Meta grid */}
        <View style={s.coverMetaGrid}>
          <View style={s.coverMetaCell}>
            <Text style={s.coverMetaLabel}>Mileage</Text>
            <Text style={s.coverMetaValue}>{meta.vehicle_mileage}</Text>
          </View>
          <View style={s.coverMetaCell}>
            <Text style={s.coverMetaLabel}>Asking Price</Text>
            <Text style={s.coverMetaValue}>{meta.vehicle_price}</Text>
          </View>
          <View style={s.coverMetaCellLast}>
            <Text style={s.coverMetaLabel}>Inspection Date</Text>
            <Text style={s.coverMetaValue}>{meta.inspection_date}</Text>
          </View>
          <View style={[s.coverMetaCell, { borderBottomWidth: 0 }]}>
            <Text style={s.coverMetaLabel}>Location</Text>
            <Text style={s.coverMetaValue}>{meta.inspection_location}</Text>
          </View>
          <View style={[s.coverMetaCell, { borderBottomWidth: 0 }]}>
            <Text style={s.coverMetaLabel}>Inspector</Text>
            <Text style={s.coverMetaValue}>RideCheck Field Inspector</Text>
          </View>
          <View style={[s.coverMetaCellLast, { borderBottomWidth: 0 }]}>
            <Text style={s.coverMetaLabel}>Inspection Tier</Text>
            <Text style={s.coverMetaValue}>{meta.package_tier.split(" (")[0]}</Text>
          </View>
        </View>

        {/* Risk + Confidence badges */}
        <View style={s.coverBadgeRow}>
          <View style={[s.coverRiskBadge, { backgroundColor: vbg, borderColor: vbord }]}>
            <Text style={[s.coverRiskLabel, { color: vc }]}>Field Risk Assessment</Text>
            <Text style={[s.coverRiskValue, { color: vc }]}>{verdictLabel(report.verdict)}</Text>
          </View>
          <View style={[s.coverConfidenceBadge, { backgroundColor: cbg, borderColor: cc }]}>
            <Text style={[s.coverConfLabel, { color: cc }]}>Inspection Confidence</Text>
            <Text style={[s.coverConfValue, { color: cc }]}>{meta.confidence_level}</Text>
          </View>
        </View>

        {/* Top 3 Field Findings */}
        <Text style={s.coverFindingsTitle}>Top 3 Field Findings</Text>
        {report.top_insights.slice(0, 3).map((insight, i) => (
          <View key={i} style={s.coverFindingRow}>
            <View style={s.coverFindingNum}>
              <Text style={s.coverFindingNumText}>{i + 1}</Text>
            </View>
            <View style={s.coverFindingBody}>
              <Text style={s.coverFindingTitle}>{insight.title}</Text>
              <Text style={s.coverFindingText}>{insight.body}</Text>
            </View>
          </View>
        ))}

        {/* Platform tagline */}
        <View style={s.coverTagline}>
          <Text style={s.coverTaglineText}>
            RideCheck is a Vehicle Transparency Platform — not a purchase advisor or legal authority.{"\n"}
            This report reflects field observations at the time of inspection.{"\n"}
            ridecheckauto.com  ·  support@ridecheckauto.com  ·  Lake &amp; McHenry County, IL
          </Text>
        </View>
      </View>
    </>
  );
}

// ─── INSPECTION CONFIDENCE & SCOPE ────────────────────────────────────────────

function InspectionConfidenceScope({ meta }: { meta: ReportMeta }) {
  return (
    <View style={s.content}>
      <SectionTitle title="Inspection Scope" />
      <View style={s.scopeTable}>
        <View style={s.scopeHead}>
          <View style={s.scopeColDot} />
          <Text style={[s.thText, s.scopeColSystem]}>System / Area</Text>
          <Text style={[s.thText, s.scopeColLevel]}>Inspection Level</Text>
        </View>
        {meta.scope_table.map((row, i) => {
          const isLast = i === meta.scope_table.length - 1;
          return (
            <View key={i} style={isLast ? s.scopeRowLast : s.scopeRow}>
              <View style={s.scopeColDot}>
                <View style={scopeDotStyle(row.status)} />
              </View>
              <Text style={[s.tdText, s.scopeColSystem]}>{row.system}</Text>
              <Text style={[s.tdMuted, s.scopeColLevel]}>{row.level}</Text>
            </View>
          );
        })}
      </View>

      <SectionTitle title="Inspection Confidence" />
      <View style={s.confidenceRow}>
        <View style={[s.confidenceBox, {
          backgroundColor: confidenceBg(meta.confidence_level),
          borderColor: confidenceColor(meta.confidence_level),
        }]}>
          <Text style={s.confidenceLabel}>Confidence Level</Text>
          <Text style={[s.confidenceValue, { color: confidenceColor(meta.confidence_level) }]}>
            {meta.confidence_level}
          </Text>
          <Text style={s.confidenceNote}>
            Reflects inspection completeness only — not vehicle quality.
          </Text>
        </View>
        <View style={s.missingBox}>
          <Text style={s.missingTitle}>Missing or Limited Information</Text>
          {meta.missing_items.length === 0 ? (
            <Text style={s.missingNone}>All standard inspection items completed.</Text>
          ) : (
            meta.missing_items.map((item, i) => (
              <View key={i} style={s.missingItem}>
                <Text style={s.missingDash}>–</Text>
                <Text style={s.missingText}>{item}</Text>
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

// ─── VEHICLE SYSTEM OBSERVATIONS ─────────────────────────────────────────────

function VehicleSystemObservations({ report }: { report: GeneratedReport }) {
  return (
    <View style={s.content} break>
      <SectionTitle title="Vehicle System Observations" />
      {report.systems.map((sys, i) => (
        <View key={i} style={s.systemRow} wrap={false}>
          <View style={s.systemNameCol}>
            <Text style={s.systemName}>{sys.name}</Text>
            <StatusBadge status={sys.status} />
          </View>
          <View style={s.systemDescCol}>
            <Text style={[s.systemFieldLabel, { marginTop: 0 }]}>Observed</Text>
            <Text style={s.systemFieldText}>{sys.observed}</Text>
            <Text style={s.systemFieldLabel}>Consideration</Text>
            <Text style={s.systemFieldText}>{sys.consideration}</Text>
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
              <Text style={[s.systemCostNote, { color: C.good }]}>No action needed</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── ROAD TEST RESULTS ────────────────────────────────────────────────────────

const RT_PDF_SECTIONS: Array<{
  title: string;
  key: keyof RoadTestModule;
  items: Array<{ id: string; label: string }>;
}> = [
  { title: "Engine Behavior", key: "engine_behavior", items: [
    { id: "engine_started_promptly",    label: "Engine started promptly" },
    { id: "no_unusual_noises_startup",  label: "No unusual noises at startup" },
    { id: "no_smoke_from_exhaust",      label: "No smoke from exhaust" },
    { id: "engine_ran_smoothly",        label: "Engine ran smoothly during drive" },
    { id: "no_hesitation_rough_idling", label: "No hesitation or rough idling" },
  ]},
  { title: "Transmission / Shifting", key: "transmission", items: [
    { id: "transmission_shifted_smoothly",  label: "Transmission shifted smoothly" },
    { id: "no_slipping_delayed_engagement", label: "No slipping or delayed engagement" },
    { id: "no_unusual_sounds_gear_changes", label: "No unusual sounds during gear changes" },
    { id: "vehicle_accelerated_normally",   label: "Vehicle accelerated normally" },
  ]},
  { title: "Brakes", key: "brakes", items: [
    { id: "brakes_engaged_responsively", label: "Brakes engaged responsively" },
    { id: "no_pulling_when_braking",     label: "No pulling to one side" },
    { id: "no_grinding_squealing",       label: "No grinding or squealing" },
    { id: "brake_pedal_felt_firm",       label: "Brake pedal felt firm" },
    { id: "vehicle_stopped_straight",    label: "Vehicle stopped straight" },
  ]},
  { title: "Steering & Handling", key: "steering", items: [
    { id: "steering_felt_responsive_centered", label: "Steering responsive and centered" },
    { id: "no_pulling_left_right",             label: "No pulling left or right" },
    { id: "no_steering_wheel_vibration",       label: "No steering wheel vibration" },
    { id: "no_unusual_noises_turning",         label: "No unusual noises during turning" },
  ]},
  { title: "Suspension", key: "suspension", items: [
    { id: "no_excessive_bouncing_rattling", label: "No excessive bouncing or rattling" },
    { id: "no_clunking_over_bumps",         label: "No clunking over bumps" },
    { id: "ride_felt_consistent",           label: "Ride consistent with vehicle age/type" },
  ]},
  { title: "Warning Lights During Drive", key: "warning_lights", items: [
    { id: "no_new_warning_lights",  label: "No new warning lights appeared" },
    { id: "check_engine_unchanged", label: "Check engine light status unchanged" },
    { id: "abs_light_unchanged",    label: "ABS light status unchanged" },
  ]},
];

function RoadTestResultsSection({ rt }: { rt: RoadTestModule }) {
  if (rt.status !== "completed") return null;
  const overallItems = [
    { id: "vehicle_drove_as_expected",    label: "Vehicle drove as expected for age and mileage" },
    { id: "noticeable_concerns_observed", label: "Noticeable concerns observed during drive" },
  ];
  return (
    <View style={s.content}>
      <SectionTitle title="Road Test Results" />
      <View style={s.rtGrid}>
        {RT_PDF_SECTIONS.map(({ title, key, items }) => {
          const checked = (rt[key] as string[] | undefined) ?? [];
          return (
            <View key={title} style={s.rtSubSection} wrap={false}>
              <Text style={s.rtSubTitle}>{title}</Text>
              {items.map(({ id, label }) => {
                const isOn = checked.includes(id);
                return (
                  <View key={id} style={s.rtItem}>
                    <Text style={isOn ? s.rtCheckOn : s.rtCheckOff}>{isOn ? "✓" : "○"}</Text>
                    <Text style={isOn ? s.rtItemOn : s.rtItemOff}>{label}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
      <View style={s.rtOtherRow} wrap={false}>
        <View style={s.rtOtherBox}>
          <Text style={s.rtOtherTitle}>Other Warning Lights</Text>
          <Text style={rt.other_lights_noted
            ? [s.rtItemOn, { fontSize: 8 }] as any
            : [s.rtItemOff, { fontSize: 8 }] as any}>
            {rt.other_lights_noted ? `Yes — ${rt.other_lights_description || "noted"}` : "None noted"}
          </Text>
        </View>
        <View style={s.rtOtherBox}>
          <Text style={s.rtOtherTitle}>Overall Drive Impression</Text>
          {overallItems.map(({ id, label }) => {
            const isOn = rt.overall?.includes(id);
            return (
              <View key={id} style={s.rtItem}>
                <Text style={isOn ? s.rtCheckOn : s.rtCheckOff}>{isOn ? "✓" : "○"}</Text>
                <Text style={isOn ? s.rtItemOn : s.rtItemOff}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>
      {rt.concerns_notes && (
        <View style={s.rtConcernsBox} wrap={false}>
          <Text style={s.rtConcernsLabel}>Drive Concerns Noted</Text>
          <Text style={s.rtConcernsText}>{rt.concerns_notes}</Text>
        </View>
      )}
      {(rt.photo_1_url || rt.photo_2_url) && (
        <View style={s.rtPhotosRow} wrap={false}>
          {rt.photo_1_url && <PhotoBlock url={rt.photo_1_url} caption="Road test — Photo 1" />}
          {rt.photo_2_url && <PhotoBlock url={rt.photo_2_url} caption="Road test — Photo 2" />}
        </View>
      )}
    </View>
  );
}

// ─── OBD-II FIELD SCAN RESULTS ────────────────────────────────────────────────

const OBD_WARNING_LIGHT_LABELS: Record<string, string> = {
  check_engine: "Check Engine",
  abs:          "ABS",
  airbag_srs:   "Airbag / SRS",
  battery:      "Battery",
  oil_pressure: "Oil Pressure",
  brake:        "Brake",
  tpms:         "TPMS",
  none:         "No warning lights observed",
  other:        "Other",
};
const OBD_HIGH_SEVERITY_LIGHTS = new Set(["check_engine", "oil_pressure", "airbag_srs", "brake"]);

function OBDFieldScanSection({ obd }: { obd: OBDModule }) {
  const scanPerformedLabels: Record<string, string> = {
    yes:           "OBD-II Field Scan Performed",
    no:            "OBD-II Field Scan Not Performed",
    not_available: "OBD-II Field Scan Not Available — Scanner / Connection Issue",
    not_permitted: "OBD-II Field Scan Not Permitted by Seller",
  };
  const scanPerformed = obd.scan_performed === "yes";
  const hasCodes = (obd.dtc_codes?.length ?? 0) > 0;
  const scanColor = scanPerformed ? C.good : C.monitor;
  const scanBg    = scanPerformed ? C.good_bg : C.monitor_bg;

  const warningLights  = obd.warning_lights || [];
  const activeWarnings = warningLights.filter((l) => l !== "none" && OBD_HIGH_SEVERITY_LIGHTS.has(l));
  const visibleLights  = warningLights.filter((l) => l !== "none" && l !== "other");
  const noneSelected   = warningLights.includes("none");
  const dtcCodes    = obd.dtc_codes || [];
  const imageFiles  = (obd.uploaded_files || []).filter((f) => f.fileType === "image");
  const pdfFiles    = (obd.uploaded_files || []).filter((f) => f.fileType === "pdf");

  const emissionLabels: Record<string, string> = {
    ready:     "Ready",
    not_ready: "Not Ready — Potential Registration Issue",
    unknown:   "Unknown / Not Checked",
  };

  return (
    <View style={s.content}>
      <SectionTitle title="OBD-II Field Scan Results" />

      <View style={[s.obdScanBanner, { backgroundColor: scanBg, borderColor: scanColor }]} wrap={false}>
        <Text style={[s.obdScanLabel, { color: scanColor }]}>Scan Status</Text>
        <Text style={[s.obdScanValue, { color: scanColor }]}>
          {scanPerformedLabels[obd.scan_performed] || obd.scan_performed}
        </Text>
        {scanPerformed && (
          <Text style={{ fontSize: 7.5, color: scanColor, marginTop: 2 }}>
            {hasCodes
              ? `${dtcCodes.length} diagnostic trouble code${dtcCodes.length !== 1 ? "s" : ""} retrieved`
              : "Scan completed — no diagnostic trouble codes retrieved"}
          </Text>
        )}
      </View>

      <View style={s.obdTwoCol} wrap={false}>
        <View style={s.obdBox}>
          <Text style={s.obdBoxTitle}>Warning Lights Observed</Text>
          {noneSelected && (
            <View style={s.obdLightItem}>
              <View style={[s.obdLightDot, { backgroundColor: C.good }]} />
              <Text style={s.obdLightText}>No warning lights observed</Text>
            </View>
          )}
          {!noneSelected && visibleLights.length === 0 && (
            <Text style={[s.obdLightText, { color: C.muted }]}>Not documented</Text>
          )}
          {visibleLights.map((light) => (
            <View key={light} style={s.obdLightItem}>
              <View style={[s.obdLightDot, {
                backgroundColor: OBD_HIGH_SEVERITY_LIGHTS.has(light) ? C.fail : C.monitor,
              }]} />
              <Text style={s.obdLightText}>{OBD_WARNING_LIGHT_LABELS[light] || light}</Text>
            </View>
          ))}
          {warningLights.includes("other") && obd.warning_other_desc && (
            <Text style={[s.obdLightText, { color: C.gray_600, marginTop: 2 }]}>
              Other: {obd.warning_other_desc}
            </Text>
          )}
        </View>
        <View style={s.obdBox}>
          <Text style={s.obdBoxTitle}>Emissions Readiness</Text>
          {obd.emissions_readiness ? (
            <View style={s.obdLightItem}>
              <View style={[s.obdLightDot, {
                backgroundColor: obd.emissions_readiness === "ready" ? C.good
                  : obd.emissions_readiness === "not_ready" ? C.fail
                  : C.gray_400,
              }]} />
              <Text style={s.obdLightText}>
                {emissionLabels[obd.emissions_readiness] || obd.emissions_readiness}
              </Text>
            </View>
          ) : (
            <Text style={[s.obdLightText, { color: C.muted }]}>
              {obd.scan_performed === "yes" ? "Not recorded" : "Scan not performed"}
            </Text>
          )}
          {activeWarnings.length > 0 && (
            <View style={{ marginTop: 6, padding: 5, backgroundColor: "#fef2f2", borderRadius: 2, borderWidth: 1, borderColor: "#fecaca" }}>
              <Text style={{ fontSize: 7, color: C.fail, fontFamily: "Helvetica-Bold" }}>
                {activeWarnings.length} high-severity warning light{activeWarnings.length !== 1 ? "s" : ""} observed
              </Text>
            </View>
          )}
        </View>
      </View>

      {dtcCodes.length > 0 && (
        <View style={s.obdDTCTable} wrap={false}>
          <View style={s.obdDTCHead}>
            <Text style={[s.thText, s.obdCol_sys]}>System</Text>
            <Text style={[s.thText, s.obdCol_code]}>Code</Text>
            <Text style={[s.thText, s.obdCol_stat]}>Status</Text>
            <Text style={[s.thText, s.obdCol_desc]}>Description</Text>
          </View>
          {dtcCodes.map((code, i) => {
            const isLast = i === dtcCodes.length - 1;
            const color  = dtcStatusColor(code.status);
            return (
              <View key={i} style={isLast ? s.obdDTCRowLast : s.obdDTCRow}>
                <Text style={[s.tdMuted, s.obdCol_sys]}>{code.system}</Text>
                <Text style={[s.tdText, s.obdCol_code, { fontFamily: "Helvetica-Bold" }]}>{code.code}</Text>
                <View style={[s.obdCol_stat]}>
                  <View style={[s.obdStatusPill, { backgroundColor: `${color}18` }]}>
                    <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color, textTransform: "uppercase" }}>
                      {code.status}
                    </Text>
                  </View>
                </View>
                <Text style={[s.tdText, s.obdCol_desc]}>{code.description || "—"}</Text>
              </View>
            );
          })}
        </View>
      )}

      {obd.notes && (
        <View style={s.obdNotesBox} wrap={false}>
          <Text style={s.obdNotesLabel}>Inspector OBD Notes</Text>
          <Text style={s.obdNotesText}>{obd.notes}</Text>
        </View>
      )}

      {imageFiles.length > 0 && (
        <View style={s.obdPhotoRow} wrap={false}>
          {imageFiles.slice(0, 4).map((f, i) => (
            <PhotoBlock key={i} url={f.url} caption={`OBD diagnostic — ${f.fileName}`} />
          ))}
        </View>
      )}

      {pdfFiles.length > 0 && (
        <View style={[s.obdNotesBox, { marginBottom: 0 }]} wrap={false}>
          <Text style={s.obdNotesLabel}>Uploaded Diagnostic Files (PDF)</Text>
          {pdfFiles.map((f, i) => (
            <View key={i} style={s.obdFileRef}>
              <Text style={s.obdFileIcon}>[PDF]</Text>
              <Text style={s.obdFileName}>{f.fileName}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── ODOMETER & MILEAGE VERIFICATION ─────────────────────────────────────────

function OdometerSection({ thf, vehicleMileage }: {
  thf: NonNullable<ReportMeta["title_history_module"]>;
  vehicleMileage: string;
}) {
  const hasOdometer = thf.odometer_reading != null;
  const hasConsistency = !!thf.odometer_consistency;
  const hasTampering  = !!thf.odometer_tampering;
  if (!hasOdometer && !hasConsistency && !hasTampering && !thf.odometer_notes) return null;

  const consistencyLabels: Record<string, string> = {
    yes:          "Consistent with disclosure",
    no_discrepancy: "Discrepancy observed",
    unable:       "Unable to verify",
    unavailable:  "Title unavailable for comparison",
  };
  const tamperingLabels: Record<string, string> = {
    yes:    "Indicators observed",
    no:     "None observed",
    unable: "Unable to determine",
  };

  const hasDiscrepancy = thf.odometer_consistency === "no_discrepancy";
  const hasTamperingIndicators = thf.odometer_tampering === "yes";

  return (
    <View style={s.content} wrap={false}>
      <SectionTitle title="Odometer & Mileage Verification" />

      <View style={s.odometerGrid}>
        {hasOdometer && (
          <View style={s.odometerBox}>
            <Text style={s.odometerBoxTitle}>Observed at Inspection</Text>
            <Text style={s.odometerValue}>{thf.odometer_reading!.toLocaleString()} mi</Text>
            {vehicleMileage && vehicleMileage !== "Not recorded" && (
              <Text style={s.odometerSub}>Listed mileage: {vehicleMileage}</Text>
            )}
          </View>
        )}

        {hasConsistency && (
          <View style={[s.odometerBox, hasDiscrepancy ? {
            borderColor: C.monitor, backgroundColor: C.monitor_bg,
          } : {}]}>
            <Text style={s.odometerBoxTitle}>Disclosure Consistency</Text>
            <Text style={[s.odometerValue, { fontSize: 10, color: hasDiscrepancy ? C.monitor : C.gray_900 }]}>
              {consistencyLabels[thf.odometer_consistency!] || thf.odometer_consistency}
            </Text>
            {hasDiscrepancy && (
              <Text style={[s.odometerSub, { color: "#92400e", marginTop: 3 }]}>
                Discrepancy observed — independent verification recommended
              </Text>
            )}
          </View>
        )}

        {hasTampering && (
          <View style={[s.odometerBox, hasTamperingIndicators ? {
            borderColor: C.monitor, backgroundColor: C.monitor_bg,
          } : {}]}>
            <Text style={s.odometerBoxTitle}>Cluster Tampering Indicators</Text>
            <Text style={[s.odometerValue, { fontSize: 10, color: hasTamperingIndicators ? C.monitor : C.gray_900 }]}>
              {tamperingLabels[thf.odometer_tampering!] || thf.odometer_tampering}
            </Text>
          </View>
        )}
      </View>

      {(hasDiscrepancy || hasTamperingIndicators) && (
        <View style={s.odometerFlagRow}>
          <Text style={s.odometerFlagText}>
            {hasDiscrepancy && "Mileage discrepancy observed during inspection. "}
            {hasTamperingIndicators && "Odometer cluster tampering indicators noted. "}
            Discrepancies may affect vehicle value, maintenance expectations, resale value, and title documentation.
            Independent verification is recommended before completing any transaction.
          </Text>
        </View>
      )}

      {thf.odometer_notes && (
        <View style={s.thfNotesBox} wrap={false}>
          <Text style={s.thfNotesLabel}>Odometer Inspector Notes</Text>
          <Text style={s.thfNotesText}>{thf.odometer_notes}</Text>
        </View>
      )}

      <Text style={s.odometerNote}>
        Mileage observations are based on physical odometer reading and title documentation review at time of inspection only.
        RideCheck does not access third-party vehicle history databases. Independent verification recommended.
      </Text>
    </View>
  );
}

// ─── TITLE & HISTORY FLAGS ────────────────────────────────────────────────────

function TitleHistoryFlagsSection({ thf }: { thf: NonNullable<ReportMeta["title_history_module"]> }) {
  const titleReviewLabels: Record<string, string> = {
    yes_reviewed:       "Physical Title Reviewed",
    partial:            "Partial Review Only",
    no_seller:          "Not Provided by Seller",
    dealer_unavailable: "Dealer — Not Available On-Site",
    not_applicable:     "Not Applicable",
  };
  const titleTypeLabels: Record<string, string> = {
    clean: "Clean", salvage: "Salvage", rebuilt: "Rebuilt / Reconstructed",
    bonded: "Bonded", lien: "Lien Noted", out_of_state: "Out-of-State",
    unknown: "Unknown", unable: "Unable to Verify",
  };
  const vinMatchLabels: Record<string, string> = {
    yes: "Confirmed Match", no_mismatch: "Discrepancy Observed",
    unable: "Unable to Verify", unavailable: "Title Unavailable",
  };
  const vinVerifyLabels: Record<string, string> = {
    yes: "Verified", no: "Not Verified", unable: "Unable to Verify",
  };
  const vinsMatchedLabels: Record<string, string> = {
    yes: "Matched", no_discrepancy: "Discrepancy Observed", unable: "Unable to Verify",
  };
  const lienLabels: Record<string, string> = {
    release_present: "Release Document Present",
    lien_no_release: "Lien Noted — No Release",
    no_lien:         "No Lien Observed",
    unable:          "Unable to Verify",
  };

  const FLOOD_LABELS: Record<string, string> = {
    water_staining: "Water staining on carpet or upholstery",
    mold_odor: "Mold or musty odor observed",
    interior_rust: "Rust/corrosion inside cabin areas",
    mud_silt: "Mud/silt deposits observed",
    corroded_wiring: "Corroded wiring/connectors observed",
    fogged_lights: "Fogged moisture inside lights",
    unusual_interior_rust: "Unusual rust on interior metal",
  };
  const TAMPERING_LABELS: Record<string, string> = {
    ignition_steering: "Ignition/steering column tampering observed",
    vin_plate_altered: "VIN plate appeared altered/damaged",
    vin_mismatch: "VIN mismatch observed",
    door_jamb_sticker: "Door jamb sticker missing/replaced",
    non_oem_keys: "Non-OEM or mismatched keys observed",
    aftermarket_wiring: "Unusual aftermarket ignition wiring observed",
    lock_damage: "Lock cylinder damage observed",
  };
  const ACCIDENT_LABELS: Record<string, string> = {
    mismatched_paint: "Mismatched paint between panels",
    overspray: "Overspray on trim/glass/seals",
    panel_gaps: "Inconsistent panel gaps observed",
    replacement_panels: "Replacement body panels observed",
    body_filler: "Body filler/bondo indicators observed",
    structural_weld: "Structural straightening/weld indicators observed",
    airbag_cover: "Airbag cover replacement indicators observed",
  };

  const titleReviewStatus = thf.title_review_status || "";
  const isFlagged = thf.vin_match_title === "no_mismatch" || thf.vins_matched === "no_discrepancy"
    || thf.title_type === "salvage" || thf.title_type === "rebuilt";
  const bannerBg    = isFlagged ? C.monitor_bg  : C.gray_50;
  const bannerBorder = isFlagged ? C.monitor     : C.border;
  const bannerColor  = isFlagged ? C.monitor     : C.gray_900;

  const floodActive     = (thf.flood_indicators || []).filter((i) => i !== "none");
  const tamperingActive = (thf.tampering_indicators || []).filter((i) => i !== "none");
  const accidentActive  = (thf.accident_indicators || []).filter((i) => i !== "none");

  function IndicatorGroup({ title, items, activeItems, notes, labelMap }: {
    title: string; items: string[]; activeItems: string[]; notes?: string; labelMap: Record<string, string>;
  }) {
    const hasNone = items.includes("none") && activeItems.length === 0;
    const showItems = activeItems.length > 0 ? activeItems : [];
    return (
      <View style={s.thfIndicatorGroup} wrap={false}>
        <Text style={s.thfIndicatorGroupTitle}>{title}</Text>
        {hasNone ? (
          <View style={s.thfIndicatorRow}>
            <View style={[s.thfIndicatorDot, { backgroundColor: C.good }]} />
            <Text style={s.thfNoneText}>No indicators observed</Text>
          </View>
        ) : showItems.length > 0 ? (
          showItems.map((item, i) => (
            <View key={i} style={s.thfIndicatorRow}>
              <View style={[s.thfIndicatorDot, { backgroundColor: C.monitor }]} />
              <Text style={s.thfIndicatorText}>{labelMap[item] || item}</Text>
            </View>
          ))
        ) : (
          <View style={s.thfIndicatorRow}>
            <View style={[s.thfIndicatorDot, { backgroundColor: C.gray_300 }]} />
            <Text style={[s.thfIndicatorText, { color: C.gray_400 }]}>Not assessed</Text>
          </View>
        )}
        {notes ? (
          <View style={[s.thfNotesBox, { marginTop: 5, marginBottom: 0 }]}>
            <Text style={s.thfNotesLabel}>Notes</Text>
            <Text style={s.thfNotesText}>{notes}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={s.content}>
      <SectionTitle title="Title & History Flags" />

      <View style={[s.thfBanner, { backgroundColor: bannerBg, borderColor: bannerBorder }]} wrap={false}>
        <View style={s.thfBannerCol}>
          <Text style={s.thfBannerLabel}>Title Review</Text>
          <Text style={[s.thfBannerValue, { color: bannerColor }]}>
            {titleReviewLabels[titleReviewStatus] || (titleReviewStatus || "Not assessed")}
          </Text>
          {thf.title_type ? (
            <Text style={s.thfBannerSub}>
              Title Type Observed: {titleTypeLabels[thf.title_type] || thf.title_type}
            </Text>
          ) : null}
        </View>
        {thf.vin_match_title ? (
          <View style={s.thfBannerCol}>
            <Text style={s.thfBannerLabel}>VIN vs. Title</Text>
            <Text style={[s.thfBannerValue, {
              color: thf.vin_match_title === "no_mismatch" ? C.fail : bannerColor,
            }]}>
              {vinMatchLabels[thf.vin_match_title] || thf.vin_match_title}
            </Text>
          </View>
        ) : null}
        {thf.lien_status ? (
          <View style={s.thfBannerCol}>
            <Text style={s.thfBannerLabel}>Lien Status</Text>
            <Text style={[s.thfBannerValue, {
              color: thf.lien_status === "lien_no_release" ? C.monitor : bannerColor,
            }]}>
              {lienLabels[thf.lien_status] || thf.lien_status}
            </Text>
          </View>
        ) : null}
      </View>

      {(thf.dashboard_vin_verified || thf.door_jamb_vin_verified || thf.vins_matched ||
        thf.seller_name_match || thf.title_signed) ? (
        <View style={s.thfGrid3} wrap={false}>
          {(thf.dashboard_vin_verified || thf.door_jamb_vin_verified || thf.vins_matched) ? (
            <View style={s.thfBox}>
              <Text style={s.thfBoxTitle}>VIN Verification</Text>
              {thf.dashboard_vin_verified ? (
                <>
                  <Text style={[s.thfBoxSub, { marginBottom: 1 }]}>Dashboard VIN</Text>
                  <Text style={[s.thfBoxValue, { fontSize: 7.5 }]}>{vinVerifyLabels[thf.dashboard_vin_verified] || thf.dashboard_vin_verified}</Text>
                </>
              ) : null}
              {thf.door_jamb_vin_verified ? (
                <>
                  <Text style={[s.thfBoxSub, { marginBottom: 1 }]}>Door Jamb VIN</Text>
                  <Text style={[s.thfBoxValue, { fontSize: 7.5 }]}>{vinVerifyLabels[thf.door_jamb_vin_verified] || thf.door_jamb_vin_verified}</Text>
                </>
              ) : null}
              {thf.vins_matched ? (
                <>
                  <Text style={[s.thfBoxSub, { marginBottom: 1 }]}>Physical VINs</Text>
                  <Text style={[s.thfBoxValue, { fontSize: 7.5, color: thf.vins_matched === "no_discrepancy" ? C.fail : C.gray_900 }]}>
                    {vinsMatchedLabels[thf.vins_matched] || thf.vins_matched}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}
          {thf.seller_name_match ? (
            <View style={s.thfBox}>
              <Text style={s.thfBoxTitle}>Seller / Title</Text>
              <Text style={s.thfBoxSub}>Seller Name Match</Text>
              <Text style={[s.thfBoxValue, { fontSize: 7.5, marginBottom: 5 }]}>
                {thf.seller_name_match === "yes" ? "Matched" :
                 thf.seller_name_match === "no_third_party" ? "Third-party seller observed" :
                 thf.seller_name_match === "dealer" ? "Dealer transaction" :
                 "Unable to verify"}
              </Text>
              {thf.title_signed ? (
                <>
                  <Text style={s.thfBoxSub}>Title Signed</Text>
                  <Text style={[s.thfBoxValue, { fontSize: 7.5 }]}>
                    {thf.title_signed === "yes" ? "Appropriately signed" :
                     thf.title_signed === "no"  ? "Unsigned / Incomplete" :
                     "Unable to verify"}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {thf.lien_notes ? (
        <View style={s.thfNotesBox} wrap={false}>
          <Text style={s.thfNotesLabel}>Lien Notes</Text>
          <Text style={s.thfNotesText}>{thf.lien_notes}</Text>
        </View>
      ) : null}

      <IndicatorGroup
        title="Flood / Water Intrusion Indicators"
        items={thf.flood_indicators || []}
        activeItems={floodActive}
        notes={thf.flood_notes}
        labelMap={FLOOD_LABELS}
      />
      <IndicatorGroup
        title="Theft / Tampering Indicators"
        items={thf.tampering_indicators || []}
        activeItems={tamperingActive}
        notes={thf.tampering_notes}
        labelMap={TAMPERING_LABELS}
      />
      <IndicatorGroup
        title="Prior Accident / Repair Indicators"
        items={thf.accident_indicators || []}
        activeItems={accidentActive}
        notes={thf.accident_notes}
        labelMap={ACCIDENT_LABELS}
      />

      {(thf.dashboard_vin_photo_url || thf.door_jamb_vin_photo_url) ? (
        <View style={s.thfVinPhotoRow} wrap={false}>
          {thf.dashboard_vin_photo_url ? (
            <PhotoBlock url={thf.dashboard_vin_photo_url} caption="VIN — Dashboard" />
          ) : null}
          {thf.door_jamb_vin_photo_url ? (
            <PhotoBlock url={thf.door_jamb_vin_photo_url} caption="VIN — Door Jamb" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─── TITLE & TRANSFER READINESS ───────────────────────────────────────────────

function TitleTransferReadinessSection({ ttr }: { ttr: TitleTransferReadinessSummary }) {
  const statusColors: Record<string, { bg: string; border: string; text: string; label: string }> = {
    ready:   { bg: C.green_light, border: C.green_medium, text: C.green_dark, label: "READY" },
    caution: { bg: "#fef9c3",     border: "#ca8a04",      text: "#713f12",   label: "CAUTION" },
    concern: { bg: "#fee2e2",     border: "#dc2626",      text: "#7f1d1d",   label: "CONCERN" },
    unknown: { bg: C.gray_100,    border: C.gray_400,     text: C.gray_700,  label: "UNKNOWN" },
  };
  const sc = statusColors[ttr.transfer_readiness_status] ?? statusColors.unknown;

  const flagLabels: Record<string, string> = {
    TITLE_NOT_PRESENT:              "Title not present at inspection",
    VIN_TITLE_MISMATCH:             "VIN on vehicle does not match title",
    OPEN_TITLE:                     "Open/blank title observed — chain-of-title concern",
    SELLER_NAME_UNVERIFIED:         "Seller name on title could not be verified",
    ODOMETER_DISCLOSURE_INCOMPLETE: "Odometer disclosure not completed",
    LIEN_RELEASE_MISSING:           "Lien release document not present",
    TITLE_UNSIGNED:                 "Title not signed by seller",
    OUT_OF_STATE_TITLE:             "Out-of-state title may require additional transfer steps",
    BUYER_NAME_NOT_COMPLETED:       "Buyer name section not filled in",
    UNABLE_TO_VERIFY_DOCUMENTS:     "One or more documents could not be fully verified",
  };

  const checkItems: { label: string; value: string | boolean | null }[] = [
    { label: "Title Present",       value: ttr.title_present === true ? "Yes" : ttr.title_present === false ? "No" : "N/A" },
    { label: "VIN Matches Title",   value: ttr.vin_matches_title ?? "—" },
    { label: "Open Title",          value: ttr.open_title ?? "—" },
    { label: "Title Signed",        value: ttr.title_signed ?? "—" },
    { label: "Odometer Disclosure", value: ttr.odometer_disclosure_completed ?? "—" },
    { label: "Lien Release",        value: ttr.lien_release_present ?? "—" },
    { label: "Buyer Name Completed",value: ttr.buyer_name_completed ?? "—" },
    { label: "State of Title",      value: ttr.state_of_title ?? "—" },
  ];

  return (
    <View style={s.content} wrap={false}>
      <SectionTitle title="Title & Transfer Readiness" />
      <View style={[s.thfIndicatorGroup, { backgroundColor: sc.bg, borderColor: sc.border, marginBottom: 8 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: sc.text, marginBottom: 2 }}>
              Transfer Readiness: {sc.label}
            </Text>
            <Text style={{ fontSize: 7.5, color: sc.text, lineHeight: 1.4 }}>{ttr.summary}</Text>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {checkItems.map((item) => {
          const val = String(item.value ?? "—");
          const isBad  = val === "no" || val === "No";
          const isGood = val === "yes" || val === "Yes";
          const dotColor = isGood ? C.good : isBad ? C.fail : C.gray_400;
          return (
            <View key={item.label} style={{ width: "48%", flexDirection: "row", alignItems: "flex-start", gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: dotColor, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, color: C.gray_600, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3 }}>{item.label}</Text>
                <Text style={{ fontSize: 8, color: C.gray_900 }}>{val}</Text>
              </View>
            </View>
          );
        })}
      </View>
      {ttr.risk_flags.length > 0 && (
        <View style={[s.thfIndicatorGroup, { borderColor: sc.border }]}>
          <Text style={s.thfIndicatorGroupTitle}>Flags Identified</Text>
          {ttr.risk_flags.map((flag, i) => (
            <View key={i} style={s.thfIndicatorRow}>
              <View style={[s.thfIndicatorDot, { backgroundColor: C.fail }]} />
              <Text style={s.thfIndicatorText}>{flagLabels[flag] ?? flag}</Text>
            </View>
          ))}
        </View>
      )}
      {ttr.seller_name_on_title && (
        <View style={{ marginBottom: 6 }}>
          <Text style={s.thfNotesLabel}>Seller Name on Title</Text>
          <Text style={s.thfNotesText}>{ttr.seller_name_on_title}</Text>
        </View>
      )}
      <Text style={{ fontSize: 6.5, color: C.gray_400, marginTop: 2 }}>
        Reviewed at inspection on {ttr.checked_at ? new Date(ttr.checked_at).toLocaleDateString("en-US") : "—"}.
        This review is observational only and does not constitute legal title verification.
      </Text>
    </View>
  );
}

// ─── FIELD PHOTO DOCUMENTATION (grouped) ─────────────────────────────────────

function FieldPhotoDocumentation({
  meta,
  obd,
  rt,
}: {
  meta: ReportMeta;
  obd?: OBDModule;
  rt?: RoadTestModule;
}) {
  // Group photos into categories — deduplicate by URL
  const seen = new Set<string>();
  function dedup(url?: string): string | undefined {
    if (!url) return undefined;
    if (seen.has(url)) return undefined;
    seen.add(url);
    return url;
  }

  const vinPhotos: Array<{ url?: string; caption: string }> = [
    { url: dedup(meta.vin_photo_url), caption: "VIN Plate" },
    ...(meta.title_history_module?.dashboard_vin_photo_url
      ? [{ url: dedup(meta.title_history_module.dashboard_vin_photo_url), caption: "VIN — Dashboard" }]
      : []),
    ...(meta.title_history_module?.door_jamb_vin_photo_url
      ? [{ url: dedup(meta.title_history_module.door_jamb_vin_photo_url), caption: "VIN — Door Jamb" }]
      : []),
  ].filter((p) => p.url);

  const odometerPhotos: Array<{ url?: string; caption: string }> = [
    { url: dedup(meta.odometer_photo_url), caption: "Odometer — Mileage Reading" },
  ].filter((p) => p.url);

  const enginePhotos: Array<{ url?: string; caption: string }> = [
    { url: dedup(meta.under_hood_photo_url), caption: "Engine Bay — Under Hood" },
  ].filter((p) => p.url);

  const underbodyPhotos: Array<{ url?: string; caption: string }> = [
    { url: dedup(meta.undercarriage_photo_url), caption: "Undercarriage — Frame & Underbody" },
  ].filter((p) => p.url);

  const obdPhotos: Array<{ url?: string; caption: string }> = obd
    ? (obd.uploaded_files || [])
        .filter((f) => f.fileType === "image")
        .map((f, i) => ({ url: dedup(f.url), caption: `OBD Evidence — ${f.fileName}` }))
        .filter((p) => p.url)
    : [];

  const rtPhotos: Array<{ url?: string; caption: string }> = rt
    ? [
        rt.photo_1_url ? { url: dedup(rt.photo_1_url), caption: "Road Test — Photo 1" } : null,
        rt.photo_2_url ? { url: dedup(rt.photo_2_url), caption: "Road Test — Photo 2" } : null,
      ].filter(Boolean) as Array<{ url?: string; caption: string }>
    : [];

  const extraPhotos: Array<{ url?: string; caption: string }> = (meta.extra_photos || []).map(
    (url, i) => ({ url: dedup(url), caption: `Additional Photo ${i + 1}` })
  ).filter((p) => p.url);

  const allGroups: Array<{ title: string; photos: Array<{ url?: string; caption: string }> }> = [
    { title: "VIN Verification Photos", photos: vinPhotos },
    { title: "Odometer", photos: odometerPhotos },
    { title: "Engine Bay", photos: enginePhotos },
    { title: "Rust & Underbody", photos: underbodyPhotos },
    { title: "OBD Field Scan Evidence", photos: obdPhotos },
    { title: "Road Test Evidence", photos: rtPhotos },
    { title: "Additional Field Photos", photos: extraPhotos },
  ].filter((g) => g.photos.length > 0);

  if (allGroups.length === 0) return null;

  return (
    <View style={s.content} break>
      <SectionTitle title="Field Photo Documentation" />
      {allGroups.map((group) => (
        <View key={group.title}>
          <Text style={s.photoGroupHeader}>{group.title}</Text>
          <View style={s.photoGrid}>
            {group.photos.map((photo, i) => (
              <PhotoBlock key={i} url={photo.url} caption={photo.caption} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── REPAIR EXPOSURE SUMMARY ──────────────────────────────────────────────────

function RepairExposureSummary({ report }: { report: GeneratedReport }) {
  if (report.repair_estimates.length === 0) return null;
  return (
    <View style={s.content} break>
      <SectionTitle title="Repair Exposure Summary" />
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
            Total Estimated Repair Exposure
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
    </View>
  );
}

// ─── BUYER CONSIDERATIONS ─────────────────────────────────────────────────────

function BuyerConsiderations({ report }: { report: GeneratedReport }) {
  const repairHigh = report.total_repair_high ?? 0;
  const hasRepairs = repairHigh > 0;
  const isHigh     = report.verdict === "HIGH_RISK";
  const isMod      = report.verdict === "MODERATE_RISK";

  const moreFor: string[] = [];
  if (hasRepairs) {
    moreFor.push("Buyers comfortable with near-term mechanical repairs");
    moreFor.push("Buyers with access to a trusted mechanic or service center");
  }
  if (isHigh || isMod) moreFor.push("Secondary or occasional-use vehicle buyers");
  if (hasRepairs) moreFor.push(`Buyers prepared for ${fmt(report.total_repair_low)}–${fmt(report.total_repair_high)} in near-term repair costs`);
  if (!hasRepairs) {
    moreFor.push("Buyers seeking a lower-maintenance pre-owned vehicle");
    moreFor.push("Daily-use buyers comfortable with standard upkeep");
  }

  const lessFor: string[] = [];
  if (isHigh || isMod) lessFor.push("Buyers requiring immediate, uninterrupted daily reliability");
  if (repairHigh > 1000) lessFor.push("Buyers without a repair budget contingency");
  if (isHigh) {
    lessFor.push("Long-distance commuters without a repair plan");
    lessFor.push("Buyers without access to independent mechanical assessment");
  }

  if (moreFor.length === 0 && lessFor.length === 0) return null;

  return (
    <View wrap={false}>
      <SectionTitle title="Buyer Considerations" />
      <View style={s.buyerConsiderationsRow}>
        {moreFor.length > 0 && (
          <View style={[s.buyerCol, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
            <Text style={[s.buyerColHeader, { color: C.green_dark }]}>
              May be more appropriate for
            </Text>
            {moreFor.map((item, i) => (
              <View key={i} style={s.buyerItem}>
                <Text style={s.buyerIcon}>✓</Text>
                <Text style={s.buyerText}>{item}</Text>
              </View>
            ))}
          </View>
        )}
        {lessFor.length > 0 && (
          <View style={[s.buyerCol, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
            <Text style={[s.buyerColHeader, { color: "#92400e" }]}>
              May be less appropriate for
            </Text>
            {lessFor.map((item, i) => (
              <View key={i} style={s.buyerItem}>
                <Text style={s.buyerIcon}>!</Text>
                <Text style={s.buyerText}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── RISK INTELLIGENCE SUMMARY ────────────────────────────────────────────────

function RiskIntelligenceSection({ ri }: { ri: NonNullable<ReportMeta["risk_intelligence"]> }) {
  const colors    = riskLevelColors(ri.overall_level);
  const levelText = riskLevelLabel(ri.overall_level);

  const vinOk    = ri.vin_valid === true;
  const recallOk = ri.recall_count === 0;
  const floodOk  = ri.flood_level === "LOW";
  const theftOk  = ri.theft_status === "CLEAR";
  const marketOk = ri.pricing_risk == null || ri.pricing_risk === "NONE" || ri.pricing_risk === "UNAVAILABLE";

  const vinLabel    = ri.vin_valid === true ? "Verified"
    : ri.vin_valid === false ? "Invalid / Unverified" : "Not checked";
  const recallLabel = ri.recall_count === 0
    ? "No recalls found" : `${ri.recall_count} recall(s) — ${ri.recall_severity}`;
  const floodLabel  = ri.flood_level === "LOW"
    ? "LOW — No significant indicators"
    : ri.flood_level === "MODERATE" ? `MODERATE — score ${ri.flood_score}`
    : `HIGH — score ${ri.flood_score} (${ri.flood_active_count} indicators)`;
  const theftLabel  = ri.theft_status === "CLEAR" ? "CLEAR"
    : ri.theft_status === "FLAGGED" ? "FLAGGED — manual review required"
    : "Unable to verify — manual NICB check recommended";
  const marketLabel = ri.market_variance_pct != null
    ? `${ri.pricing_risk?.replace(/_/g, " ") ?? "N/A"} (${ri.market_variance_pct}% below market)`
    : "Market data unavailable";

  const modules = [
    { name: "VIN Verification", value: vinLabel,    good: vinOk,    isLast: false },
    { name: "Recall Status",    value: recallLabel, good: recallOk, isLast: false },
    { name: "Flood Risk",       value: floodLabel,  good: floodOk,  isLast: false },
    { name: "Theft / Salvage",  value: theftLabel,  good: theftOk,  isLast: false },
    { name: "Price Analysis",   value: marketLabel, good: marketOk, isLast: true  },
  ];

  return (
    <View style={s.content} break>
      <SectionTitle title="Risk Intelligence Summary" />

      <View style={[s.riskBanner, { backgroundColor: colors.bg, borderColor: colors.border }]} wrap={false}>
        <View style={s.riskScoreBlock}>
          <Text style={[s.riskScoreNum, { color: colors.text }]}>{ri.overall_score}</Text>
          <Text style={[s.riskScoreLabel, { color: colors.text }]}>COMPOSITE RISK SCORE</Text>
        </View>
        <Text style={[s.riskLevelBig, { color: colors.text }]}>{levelText}</Text>
        <View>
          <Text style={{ fontSize: 7, color: colors.text, textAlign: "right" }}>0–14 LOW · 15–29 MODERATE</Text>
          <Text style={{ fontSize: 7, color: colors.text, textAlign: "right" }}>30–49 ELEVATED · 50+ HIGH</Text>
          <Text style={{ fontSize: 7, color: colors.text, marginTop: 3, textAlign: "right" }}>
            Checked {new Date(ri.checked_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>
      </View>

      {ri.hard_stops.length > 0 && (
        <View style={s.riskHardStopBanner} wrap={false}>
          <Text style={s.riskHardStopText}>
            ⚠ Critical Flags: {ri.hard_stops.join(" · ")}
          </Text>
        </View>
      )}

      <View style={[s.riskModulesTable, { borderColor: C.border }]}>
        {modules.map((mod, i) => (
          <View
            key={i}
            style={[
              mod.isLast ? s.riskModuleRowLast : s.riskModuleRow,
              { borderColor: C.border, backgroundColor: i % 2 === 0 ? "#f9fafb" : "#fff" },
            ]}
            wrap={false}
          >
            <Text style={s.riskModuleName}>{mod.name}</Text>
            <Text style={s.riskModuleValue}>{mod.value}</Text>
            <RiskModuleBadge value={mod.good ? "PASS" : "REVIEW"} good={mod.good} />
          </View>
        ))}
      </View>

      {ri.reasons.length > 0 && (
        <View style={s.riskReasonsList}>
          <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.gray_700, marginBottom: 4 }}>
            Risk Contributing Factors
          </Text>
          {ri.reasons.map((reason, i) => (
            <View key={i} style={s.riskReasonItem}>
              <Text style={s.riskReasonBullet}>▸</Text>
              <Text style={s.riskReasonText}>{reason}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={{ fontSize: 6.5, color: C.muted, marginTop: 6, lineHeight: 1.4 }}>
        Risk scores are computed from NHTSA recall data, physical flood indicators, VIN verification,
        and listing price analysis. Theft/salvage status requires manual NICB or NMVTIS verification
        when no provider is configured. This section supplements — and does not replace — physical inspection findings.
      </Text>
    </View>
  );
}

// ─── INTERPRETED OBD ENTRIES (Claude-generated, if present) ──────────────────

function InterpretedOBDSection({ entries }: { entries: GeneratedReport["obd_entries"] }) {
  if (entries.length === 0) return null;
  return (
    <View style={s.content} wrap={false}>
      <SectionTitle title="OBD-II Field Scan — Interpreted Findings" />
      <View style={s.table}>
        <View style={s.tableHead}>
          <Text style={[s.thText, s.col_sys]}>System</Text>
          <Text style={[s.thText, s.col_stat]}>Status</Text>
          <Text style={[s.thText, s.col_codes]}>Code(s)</Text>
          <Text style={[s.thText, s.col_desc]}>Description</Text>
        </View>
        {entries.map((entry, i) => {
          const isLast = i === entries.length - 1;
          return (
            <View key={i} style={isLast ? s.tableRowLast : s.tableRow}>
              <Text style={[s.tdText, s.col_sys]}>{entry.system}</Text>
              <View style={[s.col_stat, s.statusPill]}>
                <View style={entry.is_active ? s.dot_on : s.dot_off} />
                <Text style={entry.is_active
                  ? [s.tdText, { color: C.fail }]
                  : [s.tdText, { color: C.good }]}>
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
  );
}

// ─── MAIN DOCUMENT ────────────────────────────────────────────────────────────

interface Props {
  report: GeneratedReport;
  meta: ReportMeta;
}

export function RideCheckReport({ report, meta }: Props) {
  const vc = verdictColor(report.verdict);
  const vbg = verdictBg(report.verdict);
  const vbord = verdictBorder(report.verdict);

  return (
    <Document
      title={`RideCheck Vehicle Transparency Report — ${meta.vehicle_year} ${meta.vehicle_make} ${meta.vehicle_model}`}
      author="RideCheck"
      subject="Vehicle Transparency Report"
      creator="RideCheck Vehicle Transparency Platform"
    >
      {/* ═══════════════════════ COVER PAGE ══════════════════════════ */}
      <Page size="LETTER" style={s.coverPage}>
        <CoverPage report={report} meta={meta} />
        <PageFooter />
      </Page>

      {/* ═══════════════════════ CONTENT PAGES ═══════════════════════ */}
      <Page size="LETTER" style={s.page}>
        <PageHeader meta={meta} />

        {/* ── Risk Verdict Banner ── */}
        <View style={[s.verdictBanner, { backgroundColor: vbg, borderColor: vbord }]}>
          <View style={s.verdictLeft}>
            <Text style={[s.verdictDot, { color: vc }]}>{verdictDot(report.verdict)}</Text>
            <Text style={[s.verdictLabel, { color: vc }]}>{verdictLabel(report.verdict)}</Text>
          </View>
          <Text style={s.verdictTagline}>{report.verdict_tagline}</Text>
        </View>

        {/* ── On-Site Key Findings ── */}
        <View style={s.content}>
          <SectionTitle title="On-Site Key Findings" />
          {report.top_insights.slice(0, 3).map((insight, i) => (
            <View key={i} style={s.insightBlock}>
              <View style={s.insightBulletBox}>
                <Text style={s.insightBulletText}>{i + 1}</Text>
              </View>
              <View style={s.insightContent}>
                <Text style={s.insightTitle}>{insight.title}</Text>
                <Text style={s.insightBody}>{insight.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Inspection Scope + Confidence ── */}
        <InspectionConfidenceScope meta={meta} />

        {/* ── Vehicle System Observations ── */}
        <VehicleSystemObservations report={report} />

        {/* ── Road Test Results ── */}
        {meta.road_test_module?.status === "completed" && (
          <RoadTestResultsSection rt={meta.road_test_module} />
        )}

        {/* ── OBD-II Field Scan ── */}
        {meta.obd_module && (
          <OBDFieldScanSection obd={meta.obd_module} />
        )}

        {/* ── Interpreted OBD entries (if Claude parsed additional entries) ── */}
        {report.obd_entries.length > 0 && (
          <InterpretedOBDSection entries={report.obd_entries} />
        )}

        {/* ── Odometer & Mileage Verification ── */}
        {meta.title_history_module && (
          <OdometerSection
            thf={meta.title_history_module}
            vehicleMileage={meta.vehicle_mileage}
          />
        )}

        {/* ── Title & History Flags ── */}
        {meta.title_history_module && (
          <TitleHistoryFlagsSection thf={meta.title_history_module} />
        )}

        {/* ── Title & Transfer Readiness ── */}
        {meta.title_transfer_readiness && (
          <TitleTransferReadinessSection ttr={meta.title_transfer_readiness} />
        )}

        {/* ── Risk Intelligence Summary ── */}
        {meta.risk_intelligence && (
          <RiskIntelligenceSection ri={meta.risk_intelligence} />
        )}

        {/* ── Field Photo Documentation (grouped) ── */}
        <FieldPhotoDocumentation
          meta={meta}
          obd={meta.obd_module}
          rt={meta.road_test_module}
        />

        {/* ── Repair Exposure Summary ── */}
        <RepairExposureSummary report={report} />

        {/* ── Buyer Considerations ── */}
        <View style={s.content}>
          <BuyerConsiderations report={report} />
        </View>

        {/* ── Price & Condition Context ── */}
        {report.negotiation_options.length > 0 && (
          <View style={s.content}>
            <SectionTitle title="Price & Condition Context" />
            {report.negotiation_options.map((opt, i) => (
              <View key={i} style={s.negotiationOption} wrap={false}>
                <Text style={s.negotiationLabel}>{opt.label}</Text>
                <Text style={s.negotiationDesc}>{opt.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Disclaimer ── */}
        <View style={s.content}>
          <View style={s.disclaimer} wrap={false}>
            <Text style={s.disclaimerText}>
              RideCheck is a Vehicle Transparency Platform — not a purchase advisor, legal authority, or title agency.
              This report reflects visual observations and field data collected at the time of inspection only.
              Risk levels represent estimated financial and maintenance exposure and do not constitute a recommendation to buy or not buy.
              RideCheck is not responsible for undisclosed issues or post-inspection changes.
              Repair cost estimates are approximations based on Chicago-area rates and may vary significantly by shop and market conditions.
              A professional mechanical inspection is recommended before completing any vehicle transaction.
              Governed by Illinois law, Lake County venue.  ·  ridecheckauto.com  ·  support@ridecheckauto.com
            </Text>
          </View>
        </View>

        <PageFooter />
      </Page>
    </Document>
  );
}
