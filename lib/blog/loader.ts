import type { BlogPost, BlogCategory } from "./types";

import facebookMarketplaceRedFlags from "@/content/blog/facebook-marketplace-red-flags";
import camryCleanBuy from "@/content/blog/2019-camry-clean-buy";
import negotiateAfterInspection from "@/content/blog/how-to-negotiate-after-inspection";
import lakeCountyMarketQ1 from "@/content/blog/lake-county-market-q1-2025";

export const ALL_POSTS: BlogPost[] = [
  facebookMarketplaceRedFlags,
  camryCleanBuy,
  negotiateAfterInspection,
  lakeCountyMarketQ1,
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
