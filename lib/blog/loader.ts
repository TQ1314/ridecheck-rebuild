import type { BlogPost, BlogCategory } from "./types";

import facebookMarketplaceRedFlags from "@/content/blog/facebook-marketplace-red-flags";
import camryCleanBuy from "@/content/blog/2019-camry-clean-buy";
import negotiateAfterInspection from "@/content/blog/how-to-negotiate-after-inspection";
import lakeCountyMarketQ1 from "@/content/blog/lake-county-market-q1-2025";
import jeepSrtWaukegan from "@/content/blog/jeep-srt-title-problem-waukegan";
import lexusMundelein from "@/content/blog/2019-lexus-mundelein-green-light";
import fordF150LakeCounty from "@/content/blog/ford-f150-lake-county";
import negotiateWithReport from "@/content/blog/negotiate-with-ridecheck-report";
import theRedFlagManifesto from "@/content/blog/the-red-flag-manifesto";

export const ALL_POSTS: BlogPost[] = [
  theRedFlagManifesto,
  facebookMarketplaceRedFlags,
  camryCleanBuy,
  negotiateAfterInspection,
  lakeCountyMarketQ1,
  jeepSrtWaukegan,
  lexusMundelein,
  fordF150LakeCounty,
  negotiateWithReport,
].sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());

export const BLOG_CATEGORIES: BlogCategory[] = [
  "Fraud Alerts",
  "Green Light Gems",
  "Field Intelligence",
  "Buyer's Playbook",
];

export function getAllPosts(): BlogPost[] {
  return ALL_POSTS;
}

export function getFeaturedPosts(): BlogPost[] {
  return ALL_POSTS.filter((p) => p.featured);
}

export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return ALL_POSTS.filter((p) => p.category === category);
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return ALL_POSTS.find((p) => p.slug === slug);
}

export function formatBlogDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
