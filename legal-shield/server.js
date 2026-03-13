const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

/*
  SIMPLE IN-MEMORY STORE FOR PROTOTYPE
  Replace with Supabase/Postgres in production.
*/
const db = {
  orders: [],
  termsAcceptances: [],
  auditLogs: [],
  inspectionReports: [],
};

const CURRENT_TERMS_VERSION = "v1.0";
const CURRENT_INSPECTION_SCOPE_VERSION = "scope-v1.0";

/*
  APPROVED RECOMMENDATION VALUES
  Prevents free-form inspector wording that creates legal risk.
*/
const APPROVED_RECOMMENDATIONS = [
  "BUY",
  "BUY_WITH_NEGOTIATION",
  "DO_NOT_BUY_AT_ASKING_PRICE",
  "FURTHER_INSPECTION_REQUIRED",
];

/*
  LEGAL DISCLAIMER BLOCK
  Auto-inserted into every report and shown in the buyer flow.
*/
const LEGAL_DISCLAIMER = `RideCheck provides a visual, non-invasive vehicle inspection and OBD-based informational report only. This inspection is limited to observable conditions at the time of inspection and is not a warranty, guarantee, certification, or prediction of future vehicle performance.

RideCheck does not perform engine teardown, compression testing, internal transmission inspection, frame measurement, or any other destructive or invasive testing unless explicitly stated otherwise.

Repair estimates are informed estimates only and are not binding quotes. Actual repair costs may vary. The final purchase decision remains solely the responsibility of the buyer.

This report is intended solely for the requesting client. Third parties should not rely on this report. RideCheck is not a party to any vehicle sale transaction.

To the maximum extent permitted by law, RideCheck's liability for any claim arising from this inspection is limited to the amount paid for the inspection service.`;

function uuid() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(ip || "unknown").digest("hex");
}

function addAuditLog(orderId, eventType, meta = {}) {
  db.auditLogs.push({
    id: uuid(),
    orderId,
    eventType,
    meta,
    createdAt: nowISO(),
  });
}

function findOrder(orderId) {
  return db.orders.find((o) => o.id === orderId);
}

function validateRecommendation(value) {
  return APPROVED_RECOMMENDATIONS.includes(value);
}

function buildBuyerSummary(report) {
  const parts = [];

  if (report.findings.warningLights?.checkEngine) {
    parts.push("Active check engine warning observed");
  }
  if (report.findings.warningLights?.abs) {
    parts.push("ABS warning observed");
  }
  if (
    report.findings.rustSeverity === "ADVANCED" ||
    report.findings.rustSeverity === "THROUGH_RUST"
  ) {
    parts.push("Visible advanced rust or metal breach observed");
  }
  if (report.findings.emissionsReady === false) {
    parts.push("Vehicle not emissions-ready at inspection time");
  }

  if (!parts.length) {
    parts.push("No major issues were observed during the limited inspection");
  }

  switch (report.recommendation) {
    case "BUY":
      return `RideCheck recommendation: BUY. ${parts.join(". ")}.`;
    case "BUY_WITH_NEGOTIATION":
      return `RideCheck recommendation: BUY WITH NEGOTIATION. ${parts.join(". ")}.`;
    case "DO_NOT_BUY_AT_ASKING_PRICE":
      return `RideCheck recommendation: DO NOT BUY AT ASKING PRICE. ${parts.join(". ")}.`;
    case "FURTHER_INSPECTION_REQUIRED":
      return `RideCheck recommendation: FURTHER INSPECTION REQUIRED. ${parts.join(". ")}.`;
    default:
      return parts.join(". ");
  }
}

/* HEALTH CHECK */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    app: "RideCheck Legal Shield Prototype",
    termsVersion: CURRENT_TERMS_VERSION,
    inspectionScopeVersion: CURRENT_INSPECTION_SCOPE_VERSION,
  });
});

/* 1) CREATE ORDER */
app.post("/orders", (req, res) => {
  const {
    buyerId,
    packageName,
    packagePrice,
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vin,
    mileage,
    location,
    sellerName,
    sellerPhone,
  } = req.body;

  if (!buyerId || !packageName || !packagePrice || !vehicleMake || !vehicleModel) {
    return res.status(400).json({
      error: "Missing required fields: buyerId, packageName, packagePrice, vehicleMake, vehicleModel",
    });
  }

  const order = {
    id: uuid(),
    buyerId,
    packageName,
    packagePrice,
    vehicleYear: vehicleYear || null,
    vehicleMake,
    vehicleModel,
    vin: vin || null,
    mileage: mileage || null,
    location: location || null,
    sellerName: sellerName || null,
    sellerPhone: sellerPhone || null,
    status: "CREATED",
    termsAccepted: false,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };

  db.orders.push(order);
  addAuditLog(order.id, "ORDER_CREATED", { buyerId, packageName, packagePrice });
  res.status(201).json(order);
});

/* 2) LEGAL SUMMARY */
app.get("/legal/summary", (req, res) => {
  res.json({
    termsVersion: CURRENT_TERMS_VERSION,
    inspectionScopeVersion: CURRENT_INSPECTION_SCOPE_VERSION,
    summary: [
      "RideCheck is a visual, non-invasive inspection service.",
      "RideCheck does not guarantee future vehicle condition or performance.",
      "RideCheck does not perform invasive mechanical testing unless explicitly stated.",
      "Repair estimates are non-binding estimates only.",
      "The buyer remains responsible for the final purchase decision.",
      "RideCheck liability is limited to the inspection fee paid.",
    ],
    fullDisclaimer: LEGAL_DISCLAIMER,
  });
});

/* 3) ACCEPT TERMS */
app.post("/orders/:orderId/accept-terms", (req, res) => {
  const order = findOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const { accepted, userAgent } = req.body;
  if (accepted !== true) {
    return res.status(400).json({ error: "Terms must be explicitly accepted" });
  }

  const acceptance = {
    id: uuid(),
    orderId: order.id,
    buyerId: order.buyerId,
    accepted: true,
    termsVersion: CURRENT_TERMS_VERSION,
    inspectionScopeVersion: CURRENT_INSPECTION_SCOPE_VERSION,
    acceptedAt: nowISO(),
    hashedIp: hashIp(req.ip),
    userAgent: userAgent || req.headers["user-agent"] || "unknown",
  };

  db.termsAcceptances.push(acceptance);
  order.termsAccepted = true;
  order.status = "TERMS_ACCEPTED";
  order.updatedAt = nowISO();

  addAuditLog(order.id, "TERMS_ACCEPTED", {
    termsVersion: CURRENT_TERMS_VERSION,
    inspectionScopeVersion: CURRENT_INSPECTION_SCOPE_VERSION,
  });

  res.json({ message: "Terms accepted successfully", order, acceptance });
});

/* 4) COMPLETE CHECKOUT — blocked if terms not accepted */
app.post("/orders/:orderId/checkout", (req, res) => {
  const order = findOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  if (!order.termsAccepted) {
    return res.status(403).json({ error: "Terms must be accepted before checkout" });
  }

  order.status = "PAID";
  order.updatedAt = nowISO();
  addAuditLog(order.id, "CHECKOUT_COMPLETED", { amount: order.packagePrice });
  res.json({ message: "Checkout completed", order });
});

/* 5) ASSIGN INSPECTOR */
app.post("/orders/:orderId/assign-inspector", (req, res) => {
  const order = findOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const { inspectorId, inspectorName } = req.body;
  if (!inspectorId || !inspectorName) {
    return res.status(400).json({ error: "inspectorId and inspectorName are required" });
  }

  order.inspectorId = inspectorId;
  order.inspectorName = inspectorName;
  order.status = "INSPECTOR_ASSIGNED";
  order.updatedAt = nowISO();

  addAuditLog(order.id, "INSPECTOR_ASSIGNED", { inspectorId, inspectorName });
  res.json(order);
});

/* 6) SUBMIT STRUCTURED INSPECTION */
app.post("/orders/:orderId/inspection-report", (req, res) => {
  const order = findOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const {
    warningLights,
    obdCodes,
    emissionsReady,
    batteryVoltage,
    rustSeverity,
    absStatus,
    brakeStatus,
    tireStatus,
    transmissionStatus,
    roadTestPerformed,
    liftInspectionPerformed,
    underbodyInspected,
    photoUrls,
    inspectorNotes,
    recommendation,
    sellerAllowedInspection,
    sellerProvidedMaintenanceRecords,
    sellerDisclosedKnownIssues,
    estimatedRepairLow,
    estimatedRepairHigh,
  } = req.body;

  if (!validateRecommendation(recommendation)) {
    return res.status(400).json({
      error: `Invalid recommendation. Allowed values: ${APPROVED_RECOMMENDATIONS.join(", ")}`,
    });
  }

  const requiredFields = {
    warningLights,
    obdCodes,
    emissionsReady,
    batteryVoltage,
    rustSeverity,
    absStatus,
    brakeStatus,
    tireStatus,
    transmissionStatus,
    roadTestPerformed,
    liftInspectionPerformed,
    underbodyInspected,
    recommendation,
  };

  for (const [key, value] of Object.entries(requiredFields)) {
    if (value === undefined || value === null) {
      return res.status(400).json({ error: `Missing required inspection field: ${key}` });
    }
  }

  const report = {
    id: uuid(),
    orderId: order.id,
    buyerId: order.buyerId,
    inspectorId: order.inspectorId || null,
    inspectorName: order.inspectorName || null,
    createdAt: nowISO(),
    vehicle: {
      year: order.vehicleYear,
      make: order.vehicleMake,
      model: order.vehicleModel,
      vin: order.vin,
      mileage: order.mileage,
      location: order.location,
    },
    inspectionScope: {
      visualInspectionOnly: true,
      obdScanIncluded: true,
      roadTestPerformed: !!roadTestPerformed,
      liftInspectionPerformed: !!liftInspectionPerformed,
      underbodyInspected: !!underbodyInspected,
      engineTeardownPerformed: false,
      compressionTestPerformed: false,
      internalTransmissionInspectionPerformed: false,
      frameMeasurementPerformed: false,
    },
    findings: {
      warningLights,
      obdCodes,
      emissionsReady,
      batteryVoltage,
      rustSeverity,
      absStatus,
      brakeStatus,
      tireStatus,
      transmissionStatus,
      inspectorNotes: inspectorNotes || "",
      photoUrls: Array.isArray(photoUrls) ? photoUrls : [],
    },
    sellerTransparency: {
      sellerAllowedInspection: !!sellerAllowedInspection,
      sellerProvidedMaintenanceRecords: !!sellerProvidedMaintenanceRecords,
      sellerDisclosedKnownIssues: !!sellerDisclosedKnownIssues,
    },
    estimatedRepairs: {
      low: Number(estimatedRepairLow || 0),
      high: Number(estimatedRepairHigh || 0),
      note: "Repair estimates are informed estimates only and not binding quotes.",
    },
    recommendation,
    legal: {
      termsVersion: CURRENT_TERMS_VERSION,
      inspectionScopeVersion: CURRENT_INSPECTION_SCOPE_VERSION,
      disclaimer: LEGAL_DISCLAIMER,
      liabilityCap: order.packagePrice,
      reportUse: "For requesting client only. Third parties should not rely on this report.",
      snapshotInTime: "This report reflects vehicle condition only at the time of inspection.",
    },
  };

  db.inspectionReports.push(report);
  order.status = "REPORT_SUBMITTED";
  order.updatedAt = nowISO();

  addAuditLog(order.id, "REPORT_SUBMITTED", {
    recommendation,
    estimatedRepairLow,
    estimatedRepairHigh,
  });

  res.status(201).json({ message: "Inspection report submitted", report });
});

/* 7) PDF-READY REPORT PAYLOAD */
app.get("/orders/:orderId/report-payload", (req, res) => {
  const order = findOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const report = db.inspectionReports.find((r) => r.orderId === order.id);
  if (!report) return res.status(404).json({ error: "Report not found for this order" });

  const payload = {
    cover: {
      title: "RideCheck Vehicle Risk Report",
      reportNumber: `RC-${order.id.slice(0, 8).toUpperCase()}`,
      date: report.createdAt,
      vehicle: `${order.vehicleYear || ""} ${order.vehicleMake} ${order.vehicleModel}`.trim(),
      vin: order.vin || "N/A",
      mileage: order.mileage || "N/A",
      location: order.location || "N/A",
      packageName: order.packageName,
    },
    verdict: {
      recommendation: report.recommendation,
      estimatedRepairRange: `$${report.estimatedRepairs.low} - $${report.estimatedRepairs.high}`,
      summary: buildBuyerSummary(report),
    },
    sections: {
      inspectionScope: report.inspectionScope,
      findings: report.findings,
      sellerTransparency: report.sellerTransparency,
      legal: report.legal,
    },
    footerDisclaimer: LEGAL_DISCLAIMER,
  };

  addAuditLog(order.id, "REPORT_PAYLOAD_GENERATED");
  res.json(payload);
});

/* 8) AUDIT TRAIL */
app.get("/orders/:orderId/audit", (req, res) => {
  const order = findOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const logs = db.auditLogs.filter((log) => log.orderId === order.id);
  res.json(logs);
});

/* 9) TERMS ACCEPTANCE RECORD */
app.get("/orders/:orderId/terms-record", (req, res) => {
  const order = findOrder(req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  const record = db.termsAcceptances.find((t) => t.orderId === order.id);
  if (!record) {
    return res.status(404).json({ error: "Terms acceptance record not found" });
  }

  res.json(record);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`RideCheck legal shield prototype running on port ${PORT}`);
});
