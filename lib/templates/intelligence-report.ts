import type { Language } from "@/lib/i18n/translations";
import { LEGAL_DISCLAIMER, TERMS_VERSION, APPROVED_RECOMMENDATIONS, type ApprovedRecommendation } from "@/lib/legal/constants";

export interface IntelligenceReportData {
  orderId: string;
  vehicleYear: number;
  vehicleMake: string;
  vehicleModel: string;
  vin?: string;
  inspectionDate: string;
  inspectorName?: string;
  recommendation?: ApprovedRecommendation;
  vinConsistency?: {
    status: "pass" | "flag" | "not_checked";
    notes?: string;
  };
  fraudScreening?: {
    status: "no_flags" | "flags_found" | "not_checked";
    flags?: string[];
  };
  titleOwnershipReview?: {
    status: "reviewed" | "not_reviewed";
    notes?: string;
  };
  inspectionScope?: {
    roadTestPerformed?: boolean;
    liftInspectionPerformed?: boolean;
    underbodyInspected?: boolean;
  };
  riskFlags?: string[];
  observations?: string;
  inspectorNotes?: string;
}

const RECOMMENDATION_LABELS_EN: Record<ApprovedRecommendation, string> = {
  BUY: "Buy",
  BUY_WITH_NEGOTIATION: "Buy with Negotiation",
  DO_NOT_BUY_AT_ASKING_PRICE: "Do Not Buy at Asking Price",
  FURTHER_INSPECTION_REQUIRED: "Further Inspection Required",
};

const RECOMMENDATION_LABELS_ES: Record<ApprovedRecommendation, string> = {
  BUY: "Comprar",
  BUY_WITH_NEGOTIATION: "Comprar con Negociacion",
  DO_NOT_BUY_AT_ASKING_PRICE: "No Comprar al Precio Pedido",
  FURTHER_INSPECTION_REQUIRED: "Se Requiere Inspeccion Adicional",
};

const LEGAL_DISCLAIMER_ES = `RideCheck proporciona una inspeccion visual, no invasiva del vehiculo y un informe informativo basado en OBD unicamente. Esta inspeccion se limita a las condiciones observables al momento de la inspeccion y no es una garantia, certificacion o prediccion del rendimiento futuro del vehiculo.

RideCheck no realiza desmontaje de motor, pruebas de compresion, inspeccion interna de transmision, medicion de chasis, ni ninguna otra prueba destructiva o invasiva a menos que se indique explicitamente lo contrario.

Los estimados de reparacion son solo estimados informativos y no son cotizaciones vinculantes. Los costos reales de reparacion pueden variar. La decision final de compra es responsabilidad exclusiva del comprador.

Este informe esta destinado unicamente al cliente solicitante. Terceros no deben confiar en este informe. RideCheck no es parte de ninguna transaccion de venta de vehiculos.

En la medida maxima permitida por la ley, la responsabilidad de RideCheck por cualquier reclamacion derivada de esta inspeccion se limita al monto pagado por el servicio de inspeccion.`;

const labels = {
  en: {
    title: "Pre-Car-Purchase Intelligence Report",
    subtitle: "Observational findings at time of assessment",
    orderId: "Order ID",
    vehicle: "Vehicle",
    vin: "VIN",
    inspectionDate: "Assessment Date",
    inspector: "Inspector",
    vinConsistency: "VIN Consistency Check",
    fraudScreening: "Fraud / Red Flag Screening",
    titleReview: "Title & Ownership Review",
    riskFlags: "Risk Flags Observed",
    observations: "Observations",
    inspectorNotes: "Inspector Notes",
    recommendation: "RideCheck Recommendation",
    inspectionScope: "Inspection Scope",
    legalDisclaimer: "Legal Disclaimer & Liability Limitation",
    termsNote: "Terms Version",
    disclaimer:
      "This report contains observational findings documented at the time of assessment. It does not constitute a warranty, legal opinion, or title verification. All findings are based on conditions observed during the assessment period.",
    status: {
      pass: "Pass",
      flag: "Flag(s) Noted",
      not_checked: "Not Checked",
      no_flags: "No Flags Observed",
      flags_found: "Flag(s) Found",
      reviewed: "Reviewed",
      not_reviewed: "Not Reviewed",
    },
    noFlags: "No risk flags observed at time of assessment.",
    scopeItems: {
      visualInspectionOnly: "Visual inspection only",
      obdScanIncluded: "OBD scan included",
      roadTestPerformed: "Road test",
      liftInspectionPerformed: "Lift inspection",
      underbodyInspected: "Underbody inspection",
      engineTeardownPerformed: "Engine teardown: Not performed",
      compressionTestPerformed: "Compression test: Not performed",
      frameMeasurementPerformed: "Frame measurement: Not performed",
    },
  },
  es: {
    title: "Informe de Inteligencia Pre-Compra de Auto",
    subtitle: "Hallazgos observacionales al momento de la evaluacion",
    orderId: "ID de Orden",
    vehicle: "Vehiculo",
    vin: "VIN",
    inspectionDate: "Fecha de Evaluacion",
    inspector: "Inspector",
    vinConsistency: "Verificacion de Consistencia del VIN",
    fraudScreening: "Evaluacion de Fraude / Banderas Rojas",
    titleReview: "Revision de Titulo y Propiedad",
    riskFlags: "Banderas de Riesgo Observadas",
    observations: "Observaciones",
    inspectorNotes: "Notas del Inspector",
    recommendation: "Recomendacion de RideCheck",
    inspectionScope: "Alcance de la Inspeccion",
    legalDisclaimer: "Aviso Legal y Limitacion de Responsabilidad",
    termsNote: "Version de Terminos",
    disclaimer:
      "Este informe contiene hallazgos observacionales documentados al momento de la evaluacion. No constituye una garantia, opinion legal, o verificacion de titulo. Todos los hallazgos se basan en condiciones observadas durante el periodo de evaluacion.",
    status: {
      pass: "Aprobado",
      flag: "Bandera(s) Notada(s)",
      not_checked: "No Verificado",
      no_flags: "Sin Banderas Observadas",
      flags_found: "Bandera(s) Encontrada(s)",
      reviewed: "Revisado",
      not_reviewed: "No Revisado",
    },
    noFlags: "Sin banderas de riesgo observadas al momento de la evaluacion.",
    scopeItems: {
      visualInspectionOnly: "Solo inspeccion visual",
      obdScanIncluded: "Escaneo OBD incluido",
      roadTestPerformed: "Prueba de manejo",
      liftInspectionPerformed: "Inspeccion en rampa",
      underbodyInspected: "Inspeccion de parte inferior",
      engineTeardownPerformed: "Desmontaje de motor: No realizado",
      compressionTestPerformed: "Prueba de compresion: No realizada",
      frameMeasurementPerformed: "Medicion de chasis: No realizada",
    },
  },
};

function performed(val: boolean | undefined): string {
  return val ? "&#10003;" : "&#10007; Not performed";
}

export function generateIntelligenceReportHtml(
  data: IntelligenceReportData,
  lang: Language = "en",
): string {
  const l = labels[lang] || labels.en;
  const recLabels = lang === "es" ? RECOMMENDATION_LABELS_ES : RECOMMENDATION_LABELS_EN;
  const disclaimer = lang === "es" ? LEGAL_DISCLAIMER_ES : LEGAL_DISCLAIMER;

  const vinStatus = data.vinConsistency?.status || "not_checked";
  const fraudStatus = data.fraudScreening?.status || "not_checked";
  const titleStatus = data.titleOwnershipReview?.status || "not_reviewed";

  const recommendationBadge = data.recommendation
    ? `<div class="recommendation recommendation-${data.recommendation.toLowerCase().replace(/_/g, "-")}">
        ${l.recommendation}: <strong>${recLabels[data.recommendation] || data.recommendation}</strong>
       </div>`
    : "";

  const scopeSection = `
<h2>${l.inspectionScope}</h2>
<table class="scope-table">
  <tr><td>${l.scopeItems.visualInspectionOnly}</td><td class="scope-yes">&#10003; Included</td></tr>
  <tr><td>${l.scopeItems.obdScanIncluded}</td><td class="scope-yes">&#10003; Included</td></tr>
  <tr><td>${l.scopeItems.roadTestPerformed}</td><td class="${data.inspectionScope?.roadTestPerformed ? "scope-yes" : "scope-no"}">${performed(data.inspectionScope?.roadTestPerformed)}</td></tr>
  <tr><td>${l.scopeItems.liftInspectionPerformed}</td><td class="${data.inspectionScope?.liftInspectionPerformed ? "scope-yes" : "scope-no"}">${performed(data.inspectionScope?.liftInspectionPerformed)}</td></tr>
  <tr><td>${l.scopeItems.underbodyInspected}</td><td class="${data.inspectionScope?.underbodyInspected ? "scope-yes" : "scope-no"}">${performed(data.inspectionScope?.underbodyInspected)}</td></tr>
  <tr><td>${l.scopeItems.engineTeardownPerformed}</td><td class="scope-no">&#10007;</td></tr>
  <tr><td>${l.scopeItems.compressionTestPerformed}</td><td class="scope-no">&#10007;</td></tr>
  <tr><td>${l.scopeItems.frameMeasurementPerformed}</td><td class="scope-no">&#10007;</td></tr>
</table>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${l.title} - ${data.orderId}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1a1a1a;line-height:1.6}
h1{font-size:24px;margin-bottom:4px}
h2{font-size:18px;border-bottom:2px solid #e5e5e5;padding-bottom:8px;margin-top:32px}
.subtitle{color:#666;font-size:14px;margin-bottom:24px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:24px}
.meta-item{font-size:14px}
.meta-label{color:#666;font-size:12px;text-transform:uppercase}
.status{display:inline-block;padding:2px 10px;border-radius:12px;font-size:13px;font-weight:600}
.status-pass{background:#dcfce7;color:#166534}
.status-flag{background:#fef3c7;color:#92400e}
.status-na{background:#f3f4f6;color:#6b7280}
.flag-list{list-style:none;padding:0}
.flag-list li{padding:8px 12px;background:#fef3c7;border-left:3px solid #f59e0b;margin-bottom:4px;border-radius:0 4px 4px 0;font-size:14px}
.observations{background:#f9fafb;padding:16px;border-radius:8px;font-size:14px;white-space:pre-wrap}
.disclaimer{margin-top:40px;padding:16px;background:#f9fafb;border-radius:8px;font-size:12px;color:#666;border-left:3px solid #d1d5db}
.recommendation{padding:12px 16px;border-radius:8px;font-size:15px;margin:16px 0;border-left:4px solid #166534;background:#dcfce7;color:#166534}
.recommendation-do-not-buy-at-asking-price{background:#fee2e2;color:#991b1b;border-color:#991b1b}
.recommendation-further-inspection-required{background:#fef3c7;color:#92400e;border-color:#f59e0b}
.recommendation-buy-with-negotiation{background:#dbeafe;color:#1e40af;border-color:#1e40af}
.scope-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
.scope-table td{padding:6px 8px;border-bottom:1px solid #e5e5e5}
.scope-yes{color:#166534;font-weight:600}
.scope-no{color:#9ca3af}
.legal-block{margin-top:40px;padding:20px;background:#fff8f0;border-radius:8px;font-size:12px;color:#555;border:1px solid #fed7aa;white-space:pre-line}
.legal-block h3{font-size:13px;color:#92400e;margin:0 0 10px 0;text-transform:uppercase;letter-spacing:0.05em}
.terms-note{font-size:11px;color:#9ca3af;margin-top:16px;text-align:right}
</style>
</head>
<body>
<h1>${l.title}</h1>
<p class="subtitle">${l.subtitle}</p>

<div class="meta">
<div class="meta-item"><span class="meta-label">${l.orderId}</span><br>${data.orderId}</div>
<div class="meta-item"><span class="meta-label">${l.vehicle}</span><br>${data.vehicleYear} ${data.vehicleMake} ${data.vehicleModel}</div>
${data.vin ? `<div class="meta-item"><span class="meta-label">${l.vin}</span><br>${data.vin}</div>` : ""}
<div class="meta-item"><span class="meta-label">${l.inspectionDate}</span><br>${data.inspectionDate}</div>
${data.inspectorName ? `<div class="meta-item"><span class="meta-label">${l.inspector}</span><br>${data.inspectorName}</div>` : ""}
</div>

${recommendationBadge}

${scopeSection}

<h2>${l.vinConsistency}</h2>
<p><span class="status ${vinStatus === "pass" ? "status-pass" : vinStatus === "flag" ? "status-flag" : "status-na"}">${l.status[vinStatus] || vinStatus}</span></p>
${data.vinConsistency?.notes ? `<p>${data.vinConsistency.notes}</p>` : ""}

<h2>${l.fraudScreening}</h2>
<p><span class="status ${fraudStatus === "no_flags" ? "status-pass" : fraudStatus === "flags_found" ? "status-flag" : "status-na"}">${l.status[fraudStatus] || fraudStatus}</span></p>
${
  data.fraudScreening?.flags && data.fraudScreening.flags.length > 0
    ? `<ul class="flag-list">${data.fraudScreening.flags.map((f) => `<li>${f}</li>`).join("")}</ul>`
    : ""
}

<h2>${l.titleReview}</h2>
<p><span class="status ${titleStatus === "reviewed" ? "status-pass" : "status-na"}">${l.status[titleStatus] || titleStatus}</span></p>
${data.titleOwnershipReview?.notes ? `<p>${data.titleOwnershipReview.notes}</p>` : ""}

<h2>${l.riskFlags}</h2>
${
  data.riskFlags && data.riskFlags.length > 0
    ? `<ul class="flag-list">${data.riskFlags.map((f) => `<li>${f}</li>`).join("")}</ul>`
    : `<p>${l.noFlags}</p>`
}

${data.observations ? `<h2>${l.observations}</h2><div class="observations">${data.observations}</div>` : ""}

${data.inspectorNotes ? `<h2>${l.inspectorNotes}</h2><div class="observations">${data.inspectorNotes}</div>` : ""}

<div class="disclaimer">${l.disclaimer}</div>

<div class="legal-block">
<h3>${l.legalDisclaimer}</h3>
${disclaimer}
<p class="terms-note">${l.termsNote}: ${TERMS_VERSION}</p>
</div>

</body>
</html>`;
}
