import type { Language } from "@/lib/i18n/translations";

export interface BillOfSaleData {
  buyerName?: string;
  buyerAddress?: string;
  sellerName?: string;
  sellerAddress?: string;
  vehicleYear?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleTrim?: string;
  vin?: string;
  mileage?: string;
  salePrice?: string;
  saleDate?: string;
}

const labels = {
  en: {
    title: "Bill of Sale",
    subtitle: "Vehicle Purchase Agreement",
    sellerInfo: "Seller Information",
    buyerInfo: "Buyer Information",
    vehicleInfo: "Vehicle Information",
    saleDetails: "Sale Details",
    name: "Full Legal Name",
    address: "Address",
    year: "Year",
    make: "Make",
    model: "Model",
    trim: "Trim",
    vin: "VIN",
    mileage: "Odometer Reading",
    salePrice: "Sale Price (USD)",
    saleDate: "Date of Sale",
    sellerSig: "Seller Signature",
    buyerSig: "Buyer Signature",
    date: "Date",
    disclaimer:
      "This bill of sale template is provided as a convenience and does not constitute legal advice. Both parties should verify all information and consult with legal counsel as needed. RideCheck is not a party to this transaction.",
    fillable: "Fill in the fields below. All fields are editable.",
  },
  es: {
    title: "Contrato de Compra-Venta",
    subtitle: "Acuerdo de Compra de Vehiculo",
    sellerInfo: "Informacion del Vendedor",
    buyerInfo: "Informacion del Comprador",
    vehicleInfo: "Informacion del Vehiculo",
    saleDetails: "Detalles de la Venta",
    name: "Nombre Legal Completo",
    address: "Direccion",
    year: "Ano",
    make: "Marca",
    model: "Modelo",
    trim: "Version",
    vin: "VIN",
    mileage: "Lectura del Odometro",
    salePrice: "Precio de Venta (USD)",
    saleDate: "Fecha de Venta",
    sellerSig: "Firma del Vendedor",
    buyerSig: "Firma del Comprador",
    date: "Fecha",
    disclaimer:
      "Este modelo de contrato de compra-venta se proporciona como cortesia y no constituye asesoramiento legal. Ambas partes deben verificar toda la informacion y consultar con un abogado segun sea necesario. RideCheck no es parte de esta transaccion.",
    fillable: "Complete los campos a continuacion. Todos los campos son editables.",
  },
};

export function generateBillOfSaleHtml(
  data: BillOfSaleData = {},
  lang: Language = "en",
): string {
  const l = labels[lang] || labels.en;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${l.title}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1a1a1a;line-height:1.6}
h1{font-size:24px;text-align:center;margin-bottom:4px}
h2{font-size:16px;border-bottom:2px solid #e5e5e5;padding-bottom:8px;margin-top:28px;text-transform:uppercase;letter-spacing:0.5px;color:#444}
.subtitle{text-align:center;color:#666;font-size:14px;margin-bottom:8px}
.fillable-note{text-align:center;font-size:12px;color:#888;margin-bottom:24px}
.field-group{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;margin-bottom:16px}
.field{margin-bottom:12px}
.field-label{font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px}
.field-value{border-bottom:1px solid #ccc;padding:4px 0;min-height:24px;font-size:14px}
.field-value[contenteditable]{outline:none;cursor:text}
.field-value[contenteditable]:focus{border-bottom-color:#2563eb}
.sig-section{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}
.sig-block{text-align:center}
.sig-line{border-bottom:1px solid #333;height:40px;margin-bottom:8px}
.sig-label{font-size:12px;color:#666}
.disclaimer{margin-top:40px;padding:16px;background:#f9fafb;border-radius:8px;font-size:11px;color:#888;border-left:3px solid #d1d5db}
@media print{.fillable-note{display:none}}
</style>
</head>
<body>
<h1>${l.title}</h1>
<p class="subtitle">${l.subtitle}</p>
<p class="fillable-note">${l.fillable}</p>

<h2>${l.sellerInfo}</h2>
<div class="field-group">
<div class="field">
<div class="field-label">${l.name}</div>
<div class="field-value" contenteditable="true">${data.sellerName || ""}</div>
</div>
<div class="field">
<div class="field-label">${l.address}</div>
<div class="field-value" contenteditable="true">${data.sellerAddress || ""}</div>
</div>
</div>

<h2>${l.buyerInfo}</h2>
<div class="field-group">
<div class="field">
<div class="field-label">${l.name}</div>
<div class="field-value" contenteditable="true">${data.buyerName || ""}</div>
</div>
<div class="field">
<div class="field-label">${l.address}</div>
<div class="field-value" contenteditable="true">${data.buyerAddress || ""}</div>
</div>
</div>

<h2>${l.vehicleInfo}</h2>
<div class="field-group">
<div class="field">
<div class="field-label">${l.year}</div>
<div class="field-value" contenteditable="true">${data.vehicleYear || ""}</div>
</div>
<div class="field">
<div class="field-label">${l.make}</div>
<div class="field-value" contenteditable="true">${data.vehicleMake || ""}</div>
</div>
<div class="field">
<div class="field-label">${l.model}</div>
<div class="field-value" contenteditable="true">${data.vehicleModel || ""}</div>
</div>
<div class="field">
<div class="field-label">${l.trim}</div>
<div class="field-value" contenteditable="true">${data.vehicleTrim || ""}</div>
</div>
<div class="field">
<div class="field-label">${l.vin}</div>
<div class="field-value" contenteditable="true">${data.vin || ""}</div>
</div>
<div class="field">
<div class="field-label">${l.mileage}</div>
<div class="field-value" contenteditable="true">${data.mileage || ""}</div>
</div>
</div>

<h2>${l.saleDetails}</h2>
<div class="field-group">
<div class="field">
<div class="field-label">${l.salePrice}</div>
<div class="field-value" contenteditable="true">${data.salePrice || ""}</div>
</div>
<div class="field">
<div class="field-label">${l.saleDate}</div>
<div class="field-value" contenteditable="true">${data.saleDate || ""}</div>
</div>
</div>

<div class="sig-section">
<div class="sig-block">
<div class="sig-line"></div>
<div class="sig-label">${l.sellerSig}</div>
<div style="margin-top:12px">
<div class="sig-line"></div>
<div class="sig-label">${l.date}</div>
</div>
</div>
<div class="sig-block">
<div class="sig-line"></div>
<div class="sig-label">${l.buyerSig}</div>
<div style="margin-top:12px">
<div class="sig-line"></div>
<div class="sig-label">${l.date}</div>
</div>
</div>
</div>

<div class="disclaimer">${l.disclaimer}</div>
</body>
</html>`;
}
