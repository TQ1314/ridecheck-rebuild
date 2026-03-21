import type { Metadata } from "next";
import Link from "next/link";
import { Shield, BookOpen, MapPin, TrendingUp } from "lucide-react";
import { BlogCard } from "@/components/blog/BlogCard";
import { CategoryTag } from "@/components/blog/CategoryTag";
import {
  getAllPosts,
  getFeaturedPosts,
  getPostsByCategory,
  BLOG_CATEGORIES,
} from "@/lib/blog/loader";

export const metadata: Metadata = {
  title: "Buyer Intelligence Hub | RideCheck",
  description:
    "Real inspection findings, fraud alerts, and field intelligence from Lake County's pre-purchase vehicle assessment team.",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Fraud Alerts": <Shield className="h-4 w-4" />,
  "Green Light Gems": <BookOpen className="h-4 w-4" />,
  "Field Intelligence": <TrendingUp className="h-4 w-4" />,
  "Buyer's Playbook": <MapPin className="h-4 w-4" />,
};

export default function BlogPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const allPosts = getAllPosts();
  const featuredPosts = getFeaturedPosts();
  const activeCategory = searchParams.category;

  const displayPosts = activeCategory
    ? allPosts.filter((p) => p.category === activeCategory)
    : allPosts;

  const nonfeaturedPosts = activeCategory
    ? displayPosts
    : allPosts.filter((p) => !p.featured);

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 to-white" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 md:py-16">
          <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700 mb-4">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            RideCheck Intelligence
          </div>
          <div className="max-w-2xl">
            <h1 className="text-3xl font-extrabold leading-tight text-gray-900 md:text-4xl">
              Buyer Intelligence Hub
            </h1>
            <p className="mt-3 text-base text-gray-600 leading-relaxed">
              Real findings from real inspections. Fraud alerts from the field. Playbooks for
              smarter buying decisions. Everything here comes from what our RideCheckers
              see on the ground in Lake County.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                data-testid="link-blog-book-cta"
              >
                Book a RideCheck Before You Buy →
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {!activeCategory && featuredPosts.length > 0 && (
        <section className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-700 mb-5">
              Featured Reports
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {featuredPosts.map((post) => (
                <BlogCard key={post.slug} post={post} featured />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
          <aside className="sm:w-52 flex-shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
              Categories
            </h2>
            <div className="flex flex-wrap gap-2 sm:flex-col sm:gap-1">
              <Link
                href="/blog"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  !activeCategory
                    ? "bg-emerald-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                data-testid="filter-all"
              >
                All Posts
              </Link>
              {BLOG_CATEGORIES.map((cat) => (
                <Link
                  key={cat}
                  href={`/blog?category=${encodeURIComponent(cat)}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeCategory === cat
                      ? "bg-emerald-600 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                  data-testid={`filter-${cat.toLowerCase().replace(/[^a-z]/g, "-")}`}
                >
                  {CATEGORY_ICONS[cat]}
                  {cat}
                </Link>
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            {activeCategory && (
              <div className="mb-5 flex items-center gap-2">
                <CategoryTag category={activeCategory as any} size="md" />
                <span className="text-sm text-gray-500">
                  {displayPosts.length} post{displayPosts.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {displayPosts.length === 0 ? (
              <div className="rounded-2xl border bg-white p-8 text-center">
                <p className="text-gray-500 text-sm">No posts in this category yet.</p>
                <Link
                  href="/blog"
                  className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
                >
                  View all posts →
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {(activeCategory ? displayPosts : nonfeaturedPosts).map((post) => (
                  <BlogCard key={post.slug} post={post} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-700 p-8 text-white md:p-12">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-2">
              Do Not Buy Blind
            </p>
            <h2 className="text-2xl font-extrabold md:text-3xl leading-tight">
              Get your RideCheck before you sign anything.
            </h2>
            <p className="mt-3 text-sm opacity-90 max-w-lg">
              Every post here comes from real inspections. The fastest way to protect
              yourself is to book one on the vehicle you're considering right now.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex items-center justify-center rounded-xl bg-white text-emerald-800 px-6 py-3 text-sm font-semibold hover:bg-emerald-50 transition-colors"
                data-testid="link-blog-bottom-cta"
              >
                Book My Inspection →
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 text-white px-6 py-3 text-sm font-semibold hover:bg-white/10 transition-colors"
              >
                View Pricing →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
