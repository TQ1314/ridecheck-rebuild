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
import type { GeneratedReport, ReportMeta, RoadTestModule, OBDModule, SystemStatus, RepairPriority, VerdictType, ScopeRow, ConfidenceLevel } from "./types";

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
    case "LOW_RISK":      return "#15803d";
    case "MODERATE_RISK": return "#d97706";
    case "HIGH_RISK":     return "#dc2626";
  }
}

function verdictLabel(v: VerdictType): string {
  switch (v) {
    case "LOW_RISK":      return "LOW RISK OBSERVED";
    case "MODERATE_RISK": return "MODERATE RISK OBSERVED";
    case "HIGH_RISK":     return "HIGH FINANCIAL RISK OBSERVED";
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

  // ─── INSPECTION SCOPE TABLE ──────────────────────────────────────────────
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
  scopeDotNotAssessed: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.gray_400 },

  // ─── CONFIDENCE + MISSING ────────────────────────────────────────────────
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
    borderColor: C.border,
  },
  confidenceLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: C.gray_400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  confidenceValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  confidenceNote: {
    fontSize: 6.5,
    color: C.muted,
    marginTop: 3,
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

  // ─── BUYER CONSIDERATIONS ────────────────────────────────────────────────
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
    borderColor: C.border,
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

  // ─── OBD DIAGNOSTICS SECTION ─────────────────────────────────────────────────
  obdScanBanner: {
    padding: 8, borderRadius: 3, marginBottom: 8, borderWidth: 1,
  },
  obdScanLabel: {
    fontSize: 6.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase",
    letterSpacing: 0.4, marginBottom: 2, color: C.gray_400,
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

  // ─── TITLE & HISTORY FLAGS SECTION ───────────────────────────────────────
  thfBanner: {
    padding: 8, borderRadius: 3, marginBottom: 8,
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
    fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.gray_500,
    textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 3,
  },
  thfBoxValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.gray_900, marginBottom: 2 },
  thfBoxSub:   { fontSize: 7.5, color: C.gray_600 },
  thfOdomRow:  { flexDirection: "row", gap: 8, marginBottom: 8 },
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
  thfIndicatorDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6, marginTop: 1 },
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

  // ─── ROAD TEST RESULTS ───────────────────────────────────────────────────
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
  rtCheckOff: { fontSize: 7.5, color: C.gray_400, marginRight: 4 },
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
});

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function Header() {
  return (
    <View style={s.header} fixed>
      <View style={s.headerLeft}>
        <Text style={s.headerBrand}>RIDECHECK</Text>
        <Text style={s.headerSub}>Vehicle Transparency Report</Text>
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

function confidenceColor(c: ConfidenceLevel): string {
  switch (c) {
    case "HIGH CONFIDENCE":     return C.good;
    case "MODERATE CONFIDENCE": return C.monitor;
    case "LIMITED CONFIDENCE":  return C.fail;
  }
}

function scopeDotStyle(status: ScopeRow["status"]) {
  switch (status) {
    case "assessed":     return s.scopeDotAssessed;
    case "partial":      return s.scopeDotPartial;
    case "not_assessed": return s.scopeDotNotAssessed;
  }
}

function InspectionScopeSections({ meta }: { meta: ReportMeta }) {
  return (
    <View style={s.content}>
      {/* ── Scope Table ── */}
      <SectionTitle title="Inspection Scope Status" />
      <View style={s.scopeTable}>
        <View style={s.scopeHead}>
          <View style={s.scopeColDot} />
          <Text style={[s.thText, s.scopeColSystem]}>System</Text>
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

      {/* ── Confidence + Missing ── */}
      <View style={s.confidenceRow}>
        <View style={s.confidenceBox}>
          <Text style={s.confidenceLabel}>Inspection Confidence</Text>
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

function BuyerConsiderations({ report }: { report: GeneratedReport }) {
  const repairLow  = report.total_repair_low  ?? 0;
  const repairHigh = report.total_repair_high ?? 0;
  const hasRepairs = repairHigh > 0;
  const isHigh     = report.verdict === "HIGH_RISK";
  const isMod      = report.verdict === "MODERATE_RISK";

  const moreFor: string[] = [];
  if (hasRepairs) {
    moreFor.push("Buyers comfortable with near-term mechanical repairs");
    moreFor.push("Buyers with access to a trusted mechanic or service center");
  }
  if (isHigh || isMod) {
    moreFor.push("Secondary or occasional-use vehicle buyers");
  }
  if (hasRepairs) {
    moreFor.push(
      `Buyers prepared for ${fmt(repairLow)}\u2013${fmt(repairHigh)} in near-term repair costs`
    );
  }
  if (!hasRepairs) {
    moreFor.push("Buyers seeking a lower-maintenance pre-owned vehicle");
    moreFor.push("Daily-use buyers comfortable with standard upkeep");
  }

  const lessFor: string[] = [];
  if (isHigh || isMod) {
    lessFor.push("Buyers requiring immediate, uninterrupted daily reliability");
  }
  if (repairHigh > 1000) {
    lessFor.push("Buyers without a repair budget contingency");
  }
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
              This vehicle may be more appropriate for
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
              This vehicle may be less appropriate for
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

function dtcStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "active":  return C.fail;
    case "pending": return C.monitor;
    case "stored":  return C.gray_600;
    default:        return C.gray_400;
  }
}

function OBDDiagnosticsSection({ obd }: { obd: OBDModule }) {
  const scanPerformedLabels: Record<string, string> = {
    yes:           "OBD-II Scan Performed",
    no:            "OBD-II Scan Not Performed",
    not_available: "OBD-II Scan Not Available — Scanner / Connection Issue",
    not_permitted: "OBD-II Scan Not Permitted by Seller",
  };

  const scanColor = obd.scan_performed === "yes" ? C.good : C.monitor;
  const scanBg    = obd.scan_performed === "yes" ? C.good_bg : C.monitor_bg;

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
      <SectionTitle title="OBD-II Diagnostic Data" />

      {/* Scan status banner */}
      <View style={[s.obdScanBanner, { backgroundColor: scanBg, borderColor: scanColor }]} wrap={false}>
        <Text style={[s.obdScanLabel, { color: scanColor }]}>Scan Status</Text>
        <Text style={[s.obdScanValue, { color: scanColor }]}>
          {scanPerformedLabels[obd.scan_performed] || obd.scan_performed}
        </Text>
      </View>

      {/* Warning lights + Emissions side-by-side */}
      <View style={s.obdTwoCol} wrap={false}>
        {/* Warning lights */}
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

        {/* Emissions readiness */}
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

          {/* Active high-severity count callout */}
          {activeWarnings.length > 0 && (
            <View style={{ marginTop: 6, padding: 5, backgroundColor: "#fef2f2", borderRadius: 2, borderWidth: 1, borderColor: "#fecaca" }}>
              <Text style={{ fontSize: 7, color: C.fail, fontFamily: "Helvetica-Bold" }}>
                {activeWarnings.length} high-severity warning light{activeWarnings.length !== 1 ? "s" : ""} observed
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* DTC codes table */}
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

      {/* OBD notes */}
      {obd.notes && (
        <View style={s.obdNotesBox} wrap={false}>
          <Text style={s.obdNotesLabel}>Inspector OBD Notes</Text>
          <Text style={s.obdNotesText}>{obd.notes}</Text>
        </View>
      )}

      {/* Uploaded image thumbnails */}
      {imageFiles.length > 0 && (
        <View style={s.obdPhotoRow} wrap={false}>
          {imageFiles.slice(0, 4).map((f, i) => (
            <PhotoBlock key={i} url={f.url} caption={`OBD diagnostic — ${f.fileName}`} />
          ))}
        </View>
      )}

      {/* PDF file references */}
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
  const odometerConsistencyLabels: Record<string, string> = {
    yes: "Consistent with Disclosure", no_discrepancy: "Discrepancy Observed",
    unable: "Unable to Verify", unavailable: "Title Unavailable",
  };
  const odometerTamperingLabels: Record<string, string> = {
    yes: "Indicators Observed", no: "None Observed", unable: "Unable to Determine",
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
            <View style={[s.thfIndicatorDot, { backgroundColor: C.gray_400 }]} />
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

      {/* Title status banner */}
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

      {/* VIN Verification + Seller */}
      {(thf.dashboard_vin_verified || thf.door_jamb_vin_verified || thf.vins_matched ||
        thf.seller_name_match || thf.title_signed) ? (
        <View style={s.thfGrid3} wrap={false}>
          {thf.dashboard_vin_verified || thf.door_jamb_vin_verified || thf.vins_matched ? (
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
                     thf.title_signed === "no" ? "Unsigned / Incomplete" :
                     "Unable to verify"}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}
          {thf.odometer_consistency || thf.odometer_reading != null ? (
            <View style={s.thfBox}>
              <Text style={s.thfBoxTitle}>Odometer</Text>
              {thf.odometer_reading != null ? (
                <>
                  <Text style={s.thfBoxSub}>Reading at Inspection</Text>
                  <Text style={[s.thfBoxValue, { marginBottom: 5 }]}>{thf.odometer_reading.toLocaleString()} mi</Text>
                </>
              ) : null}
              {thf.odometer_consistency ? (
                <>
                  <Text style={s.thfBoxSub}>Disclosure Consistency</Text>
                  <Text style={[s.thfBoxValue, { fontSize: 7.5, color: thf.odometer_consistency === "no_discrepancy" ? C.monitor : C.gray_900 }]}>
                    {odometerConsistencyLabels[thf.odometer_consistency] || thf.odometer_consistency}
                  </Text>
                </>
              ) : null}
              {thf.odometer_tampering ? (
                <>
                  <Text style={[s.thfBoxSub, { marginTop: 3 }]}>Tampering Indicators</Text>
                  <Text style={[s.thfBoxValue, { fontSize: 7.5, color: thf.odometer_tampering === "yes" ? C.monitor : C.gray_900 }]}>
                    {odometerTamperingLabels[thf.odometer_tampering] || thf.odometer_tampering}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Lien notes */}
      {thf.lien_notes ? (
        <View style={s.thfNotesBox} wrap={false}>
          <Text style={s.thfNotesLabel}>Lien Notes</Text>
          <Text style={s.thfNotesText}>{thf.lien_notes}</Text>
        </View>
      ) : null}

      {/* Odometer notes */}
      {thf.odometer_notes ? (
        <View style={s.thfNotesBox} wrap={false}>
          <Text style={s.thfNotesLabel}>Odometer Notes</Text>
          <Text style={s.thfNotesText}>{thf.odometer_notes}</Text>
        </View>
      ) : null}

      {/* Observable indicator groups */}
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

      {/* VIN verification photos */}
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

function RoadTestResultsSection({ rt }: { rt: RoadTestModule }) {
  if (rt.status !== "completed") return null;

  const overallItems = [
    { id: "vehicle_drove_as_expected",   label: "Vehicle drove as expected for age and mileage" },
    { id: "noticeable_concerns_observed",label: "Noticeable concerns observed during drive" },
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

      {/* Other lights + Overall in a row */}
      <View style={s.rtOtherRow} wrap={false}>
        <View style={s.rtOtherBox}>
          <Text style={s.rtOtherTitle}>Other Warning Lights</Text>
          <Text style={rt.other_lights_noted ? [s.rtItemOn, { fontSize: 8 }] as any : [s.rtItemOff, { fontSize: 8 }] as any}>
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

      {/* Drive concerns */}
      {rt.concerns_notes && (
        <View style={s.rtConcernsBox} wrap={false}>
          <Text style={s.rtConcernsLabel}>Drive Concerns Noted</Text>
          <Text style={s.rtConcernsText}>{rt.concerns_notes}</Text>
        </View>
      )}

      {/* Road test photos */}
      {(rt.photo_1_url || rt.photo_2_url) && (
        <View style={s.rtPhotosRow} wrap={false}>
          {rt.photo_1_url && <PhotoBlock url={rt.photo_1_url} caption="Road test — Photo 1" />}
          {rt.photo_2_url && <PhotoBlock url={rt.photo_2_url} caption="Road test — Photo 2" />}
        </View>
      )}
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
            Vehicle Transparency Inspection — {meta.vehicle_model}
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
          <SectionTitle title="Top 3 Key Findings" />
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

        {/* ── Inspection Scope + Confidence + Missing ── */}
        <InspectionScopeSections meta={meta} />

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
                  <Text style={s.systemCost}>No action needed</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {/* ── Road Test Results (if completed) ── */}
        {meta.road_test_module?.status === "completed" && (
          <RoadTestResultsSection rt={meta.road_test_module} />
        )}

        {/* ── OBD-II Diagnostics (structured module) ── */}
        {meta.obd_module && (
          <OBDDiagnosticsSection obd={meta.obd_module} />
        )}

        {/* ── Title & History Flags ── */}
        {meta.title_history_module && (
          <TitleHistoryFlagsSection thf={meta.title_history_module} />
        )}

        {/* ── OBD Table (AI-interpreted entries) ── */}
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

          {/* ── Buyer Considerations ── */}
          <BuyerConsiderations report={report} />

          {/* ── Price & Condition Considerations ── */}
          <SectionTitle title="Price & Condition Considerations" />
          {report.negotiation_options.map((opt, i) => (
            <View key={i} style={s.negotiationOption} wrap={false}>
              <Text style={s.negotiationLabel}>{opt.label}</Text>
              <Text style={s.negotiationDesc}>{opt.description}</Text>
            </View>
          ))}

          {/* ── Disclaimer ── */}
          <View style={s.disclaimer} wrap={false}>
            <Text style={s.disclaimerText}>
              This report reflects visual observations and OBD-II diagnostic data collected at the time of inspection. Risk levels represent estimated financial and maintenance exposure only and do not constitute purchase advice or a recommendation to buy or not buy. RideCheck
              is not responsible for undisclosed issues or post-inspection changes. Repair cost estimates are approximations based on Chicago-area rates and may vary significantly by shop and
              market conditions. A professional mechanical inspection is recommended before any transaction. Governed by Illinois law, Lake County venue.
              ridecheckauto.com
            </Text>
          </View>
        </View>

        <Footer meta={meta} />
      </Page>
    </Document>
  );
}
