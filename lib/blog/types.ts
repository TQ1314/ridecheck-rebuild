export type BlogCategory =
  | "Fraud Alerts"
  | "Green Light Gems"
  | "Field Intelligence"
  | "Buyer's Playbook";

export type VerdictType =
  | "BUY"
  | "BUY_WITH_CAUTION"
  | "DO_NOT_BUY"
  | "RED_FLAG"
  | "CLEAN";

export type ContentBlockType =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "alert"; variant: "warning" | "info" | "success" | "danger"; text: string }
  | { type: "callout"; label?: string; text: string }
  | { type: "divider" };

export type MediaEmbed = {
  type: "youtube" | "image" | "instagram";
  url: string;
  caption?: string;
};

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: BlogCategory;
  publishedDate: string;
  author: string;
  featuredImage?: string;
  featuredImageAlt?: string;
  verdict?: VerdictType;
  locationTag?: string;
  vehicleTag?: string;
  seoTitle?: string;
  seoDescription?: string;
  featured?: boolean;
  mediaEmbeds?: MediaEmbed[];
  galleryImages?: string[];
  ctaText?: string;
  body: ContentBlockType[];
}
