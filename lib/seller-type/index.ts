export type SellerType = "private_party" | "dealership" | "auction" | "other";

export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  private_party: "Private Seller",
  dealership:    "Dealership",
  auction:       "Auction",
  other:         "Other",
};

export const SELLER_TYPE_ICONS: Record<SellerType, string> = {
  private_party: "👤",
  dealership:    "🏢",
  auction:       "🔨",
  other:         "❓",
};

export function getSellerWorkflowType(order: { seller_type?: string | null }): SellerType {
  const v = order.seller_type;
  if (v === "dealership" || v === "auction" || v === "other") return v;
  return "private_party";
}

export function sellerTypeLabel(order: { seller_type?: string | null }): string {
  return SELLER_TYPE_LABELS[getSellerWorkflowType(order)];
}
