import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const BRAND_GREEN = "#22774F";
const BRAND_LIGHT = "#e8f5ee";
const GRAY_TEXT = "#4b5563";
const GRAY_LIGHT = "#f3f4f6";
const GRAY_BORDER = "#e5e7eb";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: "#1f2937",
    paddingTop: 44,
    paddingBottom: 50,
    paddingHorizontal: 44,
  },
  // ── Cover ──────────────────────────────────────────────────────────────
  coverPage: {
    fontFamily: "Helvetica",
    backgroundColor: BRAND_GREEN,
    paddingTop: 80,
    paddingBottom: 60,
    paddingHorizontal: 50,
  },
  coverLogo: { fontSize: 22, color: "#ffffff", fontFamily: "Helvetica-Bold", marginBottom: 6 },
  coverLogoSub: { fontSize: 10, color: "#a7d8bc", fontFamily: "Helvetica", marginBottom: 52 },
  coverTitle: { fontSize: 26, color: "#ffffff", fontFamily: "Helvetica-Bold", lineHeight: 1.3, marginBottom: 12 },
  coverSubtitle: { fontSize: 13, color: "#d1fae5", fontFamily: "Helvetica", marginBottom: 40 },
  coverDivider: { height: 1, backgroundColor: "#4ea87a", marginBottom: 20 },
  coverMeta: { fontSize: 9, color: "#a7d8bc", fontFamily: "Helvetica" },
  coverWarning: {
    marginTop: 48,
    backgroundColor: "#1a5e3e",
    borderRadius: 6,
    padding: 12,
  },
  coverWarningText: { fontSize: 9, color: "#d1fae5" },

  // ── Page structure ─────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomColor: GRAY_BORDER,
    borderBottomWidth: 1,
  },
  headerLogo: { fontSize: 10, color: BRAND_GREEN, fontFamily: "Helvetica-Bold" },
  headerPage: { fontSize: 8.5, color: "#9ca3af", fontFamily: "Helvetica" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopColor: GRAY_BORDER,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  footerText: { fontSize: 7.5, color: "#9ca3af", fontFamily: "Helvetica" },

  // ── Section ────────────────────────────────────────────────────────────
  sectionBlock: { marginBottom: 18 },
  sectionHeader: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 11, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  sectionSubtitle: { fontSize: 8, color: "#a7d8bc", fontFamily: "Helvetica", marginTop: 1 },

  // ── Content ────────────────────────────────────────────────────────────
  bullet: { flexDirection: "row", marginBottom: 4, paddingLeft: 2 },
  bulletDot: { width: 12, fontSize: 9.5, color: BRAND_GREEN, fontFamily: "Helvetica-Bold", marginTop: 0.5 },
  bulletText: { flex: 1, fontSize: 9.5, color: GRAY_TEXT, lineHeight: 1.45 },
  bulletBold: { fontFamily: "Helvetica-Bold", color: "#1f2937" },

  // ── Warning / highlight boxes ──────────────────────────────────────────
  warningBox: {
    backgroundColor: "#fef3c7",
    borderLeftColor: "#d97706",
    borderLeftWidth: 3,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  warningText: { fontSize: 8.5, color: "#92400e" },

  tipBox: {
    backgroundColor: BRAND_LIGHT,
    borderLeftColor: BRAND_GREEN,
    borderLeftWidth: 3,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  tipText: { fontSize: 8.5, color: "#065f46" },

  // ── Score table ────────────────────────────────────────────────────────
  scoreRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginBottom: 3,
  },
  scoreRowAlt: { backgroundColor: GRAY_LIGHT },
  scoreLabel: { flex: 1, fontSize: 9.5, color: GRAY_TEXT },
  scorePoints: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: BRAND_GREEN, width: 40, textAlign: "right" },

  // ── Two-col ────────────────────────────────────────────────────────────
  twoCol: { flexDirection: "row", marginBottom: 8 },
  col: { flex: 1, marginRight: 8 },
  colLast: { flex: 1 },
  colHeader: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#6b7280", marginBottom: 4 },
  colBadge: {
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  colBadgeText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
});

function PageHeader({ label }: { label: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerLogo}>RideCheck</Text>
      <Text style={styles.headerPage}>{label}</Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>RideChecker Operations & Training Guide — v1.0</Text>
      <Text style={styles.footerText}>For internal RideChecker use only</Text>
    </View>
  );
}

function SectionBlock({ num, title, subtitle, children }: { num: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{num}. {title}</Text>
        {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

function Bullet({ bold, children }: { bold?: string; children?: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>
        {bold ? <Text style={styles.bulletBold}>{bold} </Text> : null}{children || ""}
      </Text>
    </View>
  );
}

export function TrainingGuidePDF() {
  return (
    <Document
      title="RideChecker Operations & Training Guide"
      author="RideCheck"
      subject="Field Training Reference"
    >
      {/* ── Cover ──────────────────────────────────────────────────── */}
      <Page size="LETTER" style={styles.coverPage}>
        <Text style={styles.coverLogo}>RideCheck</Text>
        <Text style={styles.coverLogoSub}>Pre-Purchase Vehicle Intelligence Platform</Text>
        <Text style={styles.coverTitle}>RideChecker Operations{"\n"}& Training Guide</Text>
        <Text style={styles.coverSubtitle}>Module 1 — Field Training Reference · v1.0</Text>
        <View style={styles.coverDivider} />
        <Text style={styles.coverMeta}>Covers: Equipment · Dashboard · Jobs · Inspection Wizard · Photo Standards ·{"\n"}OBD-II Scan · Seller Conduct · Safety · Scoring · Certification Path</Text>
        <View style={styles.coverWarning}>
          <Text style={styles.coverWarningText}>
            This document is for active RideCheckers only. Do not share with sellers, buyers, or the general public. All inspection findings are observational and do not constitute a warranty, certification, or professional mechanical opinion.
          </Text>
        </View>
      </Page>

      {/* ── Page 2: Getting Started + Dashboard Basics ─────────────── */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader label="Getting Started" />

        <SectionBlock num="1" title="Getting Started" subtitle="Equipment & pre-job preparation">
          <Bullet bold="Essential equipment:">smartphone (charged 50%+), OBD-II Bluetooth scanner, portable power bank, flashlight, knee pad, nitrile gloves, tire tread depth gauge, microfiber cloth.</Bullet>
          <Bullet bold="Pre-job checklist:">phone charged, OBD scanner packed, inspection address confirmed, mobile data working, leave with at least 60 minutes of buffer time.</Bullet>
          <Bullet bold="Login:">go to ridecheck.com → Log In. Bookmark the dashboard on your phone's home screen for instant access.</Bullet>
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>Field Tip: Set the inspection address in your maps app before leaving home — not from the parking lot when you're already running late.</Text>
          </View>
        </SectionBlock>

        <SectionBlock num="2" title="Dashboard Basics" subtitle="5 tabs — know each one">
          <Bullet bold="Overview:">stats at a glance + Action Required banner at top. If a job offer is waiting, it shows here with a live countdown. Check this first every time.</Bullet>
          <Bullet bold="My Jobs:">all assignments grouped — Action Required (pending offers), Active (accepted/in-progress), Past (completed history).</Bullet>
          <Bullet bold="Pay & Payouts:">full earnings history, per-job breakdown, bonus breakdowns, payout status (Pending → Approved → Paid).</Bullet>
          <Bullet bold="Availability:">14-day calendar. Set your available windows here — Ops only offers you jobs during times you've marked available. Update weekly.</Bullet>
          <Bullet bold="Training:">certification status, guide progress, access to training material and quiz.</Bullet>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>The Action Required banner disappears when the countdown expires. Check your dashboard before every potential inspection window so you don't miss offers.</Text>
          </View>
        </SectionBlock>

        <PageFooter />
      </Page>

      {/* ── Page 3: Accepting Jobs + Inspection Wizard ─────────────── */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader label="Jobs & Inspection Wizard" />

        <SectionBlock num="3" title="Accepting Jobs" subtitle="Offer timer, accept/decline rules">
          <Bullet bold="New offers:">appear in "Action Required" with a 15–30 min countdown. First to accept gets the job — act quickly on broadcast offers.</Bullet>
          <Bullet bold="Before accepting, confirm:">you can reach the location on time, your OBD scanner is with you, and you can commit the full time block.</Bullet>
          <Bullet bold="After accepting:">tap On My Way when you leave, I've Arrived when you get there, then Start Inspection to open the wizard.</Bullet>
          <Bullet bold="Decline rules:">5 declines in 30 days = formal warning. A no-show after accepting is the most serious violation. Only accept what you will complete.</Bullet>
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>If plans change after accepting: message Ops immediately. Early notice is always better than a silent no-show.</Text>
          </View>
        </SectionBlock>

        <SectionBlock num="4" title="Guided Inspection Wizard" subtitle="16 steps — follow the system">
          <Bullet bold="16 steps in order:">Confirm Vehicle → VIN Photo → Odometer → Engine Bay → Undercarriage → Tire Tread → Brakes → OBD Scan → Title & History → Exterior → Interior → Mechanical → Test Drive → Final Notes → Road Test Module → Review & Submit.</Bullet>
          <Bullet bold="Required steps (9):">VIN photo, Odometer photo, Engine Bay photo, Undercarriage photo, Exterior notes, Interior notes, Mechanical notes, Test Drive notes, Final Notes. These must be complete before you can submit.</Bullet>
          <Bullet bold="Optional but scored:">Tire Tread measurements, Brake observations, OBD Scan data, Title & History flags, Road Test Module. Complete these for a better score.</Bullet>
          <Bullet bold="Auto-save:">the wizard saves after every entry. If your phone dies or you close the app, your work is preserved. Tap Resume on the assignment to pick up where you left off.</Bullet>
          <Bullet bold="Progress counter:">the "X/9" counter shows required sections done vs. total required. Submit button unlocks at 9/9.</Bullet>
        </SectionBlock>

        <PageFooter />
      </Page>

      {/* ── Page 4: Photo Standards + OBD ──────────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader label="Photo Standards & OBD Scan" />

        <SectionBlock num="5" title="Photo Standards" subtitle="Required photos — what good looks like">
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.colHeader}>VIN PHOTO</Text>
              <Bullet>Driver door jamb (not dashboard). Open door fully — sticker is near the top of the frame.</Bullet>
              <Bullet>All 17 characters must be legible without zoom. Angle camera to avoid glare.</Bullet>
            </View>
            <View style={styles.colLast}>
              <Text style={styles.colHeader}>ODOMETER</Text>
              <Bullet>Ignition ON (key to second click, engine doesn't need to run).</Bullet>
              <Bullet>Full gauge cluster in frame — both mileage and any active warning lights visible.</Bullet>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.colHeader}>ENGINE BAY</Text>
              <Bullet>Hood fully open. Stand above, shoot straight down. Show entire compartment: oil cap, coolant, brake fluid, battery.</Bullet>
            </View>
            <View style={styles.colLast}>
              <Text style={styles.colHeader}>UNDERCARRIAGE</Text>
              <Bullet>Flashlight on first, then position. Multiple angles: front, mid (frame rails), rear (exhaust). Get low — use your mat.</Bullet>
            </View>
          </View>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>Photo standards: Two shots per significant finding — close-up (fills frame with the detail) + wide context (shows location/scale). Blurry or too-dark photos are rejected by QA and require re-inspection.</Text>
          </View>
        </SectionBlock>

        <SectionBlock num="6" title="OBD-II Scan" subtitle="Plug in, scan, record everything">
          <Bullet bold="Port location:">under the driver's side dashboard, near the steering column. Almost always within arm's reach from the driver's seat.</Bullet>
          <Bullet bold="Steps:">plug in Bluetooth scanner → pair with your phone app (BlueDriver, Torque, OBD Auto Doctor) → run full scan → record all DTC codes by code number and description.</Bullet>
          <Bullet bold="What to record:">all DTCs (active and pending), emissions readiness monitors status (Complete/Incomplete), any active warning lights during scan.</Bullet>
          <Bullet bold="Incomplete monitors:">means some emission checks haven't run. Can indicate codes were recently cleared — flag this.</Bullet>
          <Bullet bold="Seller refuses OBD access:">document "seller declined OBD access" in notes. This is NOT your fault and does NOT hurt your score.</Bullet>
        </SectionBlock>

        <PageFooter />
      </Page>

      {/* ── Page 5: Seller Conduct + Safety ────────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader label="Seller Conduct & Safety" />

        <SectionBlock num="7" title="Seller Conduct" subtitle="Professional, neutral, and consistent">
          <Bullet bold="Introduction script:">"Hi, I'm [Your Name] from RideCheck — I'm here for the pre-purchase inspection."</Bullet>
          <Bullet bold="Always neutral:">you are not on the buyer's side or the seller's side. Your role is to document, not advise.</Bullet>
          <Bullet bold="Never say:">whether the buyer should purchase, whether the price is fair, "I'd walk away from this one," "this is a great deal," or anything that sounds like a recommendation.</Bullet>
          <Bullet bold="Seller refuses access:">document it. Write exactly what happened and what was not accessible. Continue with the rest of the inspection. This is never penalized.</Bullet>
          <Bullet bold="Seller asks about findings:">politely say "All findings go directly into the report — I'm not able to discuss them here." Then continue working.</Bullet>
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>Neutrality protects you and the buyer. If you're ever unsure what to say to a seller — say nothing and message Ops.</Text>
          </View>
        </SectionBlock>

        <SectionBlock num="8" title="Safety & Escalation" subtitle="When to message Ops, when to leave">
          <Bullet bold="Message Ops immediately when:">seller is hostile or aggressive, vehicle is not at the listed address, vehicle doesn't match the booking, you observe safety concerns on or around the vehicle.</Bullet>
          <Bullet bold="Leave immediately if:">you feel unsafe at any point. Note why in Final Notes. Your safety always comes first — no job is worth it.</Bullet>
          <Bullet bold="Do not:">accept cash or tips from sellers or buyers, share the buyer's contact details with the seller, enter a running vehicle without explicit permission, negotiate on anyone's behalf.</Bullet>
          <Bullet bold="Report all unusual situations via:">Message Ops button on the assignment card. Available during all inspection hours.</Bullet>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>You are an observer and documenter — not a mechanic, not a negotiator, not an advisor. When in doubt about anything: message Ops before proceeding.</Text>
          </View>
        </SectionBlock>

        <PageFooter />
      </Page>

      {/* ── Page 6: Score + Certification ──────────────────────────── */}
      <Page size="LETTER" style={styles.page}>
        <PageHeader label="RideCheck Score & Certification" />

        <SectionBlock num="9" title="RideCheck Score System" subtitle="100 points total — per inspection">
          <View style={{ ...styles.scoreRow, ...styles.scoreRowAlt }}>
            <Text style={styles.scoreLabel}>Checklist Score — completed required fields</Text>
            <Text style={styles.scorePoints}>40 pts</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Photo Score — 4 required photos (15) + bonus extras (5)</Text>
            <Text style={styles.scorePoints}>20 pts</Text>
          </View>
          <View style={{ ...styles.scoreRow, ...styles.scoreRowAlt }}>
            <Text style={styles.scoreLabel}>Notes Score — detail & specificity across 5 sections</Text>
            <Text style={styles.scorePoints}>20 pts</Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Timeliness Score — on-time full points, scales with lateness</Text>
            <Text style={styles.scorePoints}>20 pts</Text>
          </View>
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>Safety flags, "Not Accessible" statuses, and seller refusals — properly documented — are NEVER penalized. A vehicle with many critical findings is not your fault; document everything honestly.</Text>
          </View>
          <Bullet bold="What hurts your score:">incomplete required sections, missing required photos, one-word notes ("looks fine"), late submissions, no-shows after accepting a job.</Bullet>
        </SectionBlock>

        <SectionBlock num="10" title="Certification Path" subtitle="Rookie → Trusted → Elite → Master">
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <View style={{ ...styles.colBadge, backgroundColor: "#6b7280" }}>
                <Text style={styles.colBadgeText}>ROOKIE</Text>
              </View>
              <Bullet>New to platform. Completing Module 1 (SIP-4) certification. Standard vehicle inspections only.</Bullet>
            </View>
            <View style={styles.colLast}>
              <View style={{ ...styles.colBadge, backgroundColor: BRAND_GREEN }}>
                <Text style={styles.colBadgeText}>TRUSTED</Text>
              </View>
              <Bullet>10+ jobs · avg score ≥ 80 · zero no-shows. Preferred job routing, more opportunity.</Bullet>
            </View>
          </View>
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <View style={{ ...styles.colBadge, backgroundColor: "#b45309" }}>
                <Text style={styles.colBadgeText}>ELITE</Text>
              </View>
              <Bullet>25+ jobs · avg score ≥ 88 · no serious incidents. Plus/Luxury vehicle eligible. Higher pay rate.</Bullet>
            </View>
            <View style={styles.colLast}>
              <View style={{ ...styles.colBadge, backgroundColor: "#7c3aed" }}>
                <Text style={styles.colBadgeText}>MASTER</Text>
              </View>
              <Bullet>50+ jobs · avg score ≥ 93. Exotic tier, QA track eligible, trainer eligible, top pay rate.</Bullet>
            </View>
          </View>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>Certification required: You must pass Module 1 (SIP-4) with 80% or higher to unlock vehicle assessment forms. This certification is one-time and does not expire.</Text>
          </View>
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>How to advance: Consistency beats perfection. Show up, complete every required section, take clear photos, write specific notes — on every single job.</Text>
          </View>
        </SectionBlock>

        <PageFooter />
      </Page>
    </Document>
  );
}
