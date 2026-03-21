import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Calendar, MapPin, Tag } from "lucide-react";
import { CategoryTag } from "@/components/blog/CategoryTag";
import { VerdictBadge } from "@/components/blog/VerdictBadge";
import { BlogCard } from "@/components/blog/BlogCard";
import { EvidenceGallery } from "@/components/blog/EvidenceGallery";
import { YouTubeEmbed } from "@/components/blog/YouTubeEmbed";
import { BlogLeadCapture } from "@/components/blog/BlogLeadCapture";
import { getPostBySlug, getAllPosts, formatBlogDate } from "@/lib/blog/loader";
import type { ContentBlockType } from "@/lib/blog/types";

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = getPostBySlug(params.slug);
  if (!post) return { title: "Post Not Found | RideCheck" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ridecheckauto.com";
  const canonicalUrl = `${appUrl}/blog/${post.slug}`;

  return {
    title: post.seoTitle || `${post.title} | RideCheck`,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      url: canonicalUrl,
      type: "article",
      publishedTime: post.publishedDate,
      authors: [post.author],
      ...(post.featuredImage && { images: [{ url: `${appUrl}${post.featuredImage}` }] }),
    },
  };
}

function ContentBlock({ block }: { block: ContentBlockType }) {
  switch (block.type) {
    case "paragraph":
      return <p className="text-gray-700 leading-relaxed text-[15px]">{block.text}</p>;

    case "heading":
      if (block.level === 2) {
        return (
          <h2 className="text-xl font-extrabold text-gray-900 mt-8 mb-2 first:mt-0">
            {block.text}
          </h2>
        );
      }
      return (
        <h3 className="text-lg font-bold text-gray-900 mt-6 mb-2 first:mt-0">
          {block.text}
        </h3>
      );

    case "list":
      if (block.ordered) {
        return (
          <ol className="list-decimal list-inside space-y-2 text-gray-700 text-[15px] pl-1">
            {block.items.map((item, i) => (
              <li key={i} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="space-y-2 text-gray-700 text-[15px]">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-600 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      );

    case "alert": {
      const alertStyles: Record<string, string> = {
        warning: "bg-amber-50 border-amber-200 text-amber-800",
        info: "bg-blue-50 border-blue-200 text-blue-800",
        success: "bg-emerald-50 border-emerald-200 text-emerald-800",
        danger: "bg-red-50 border-red-200 text-red-800",
      };
      return (
        <div
          className={`rounded-xl border p-4 text-sm leading-relaxed ${
            alertStyles[block.variant] || alertStyles.info
          }`}
        >
          {block.text}
        </div>
      );
    }

    case "callout":
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          {block.label && (
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 mb-1">
              {block.label}
            </p>
          )}
          <p className="text-sm text-emerald-900 leading-relaxed">{block.text}</p>
        </div>
      );

    case "youtube":
      return <YouTubeEmbed videoId={block.videoId} caption={block.caption} />;

    case "divider":
      return <hr className="border-gray-200" />;

    default:
      return null;
  }
}

const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "RideCheck",
  description:
    "Pre-purchase vehicle inspection service covering Lake County, Illinois. Trusted by buyers in Waukegan, Gurnee, Libertyville, Mundelein, Grayslake, Zion, Round Lake, and surrounding areas.",
  url: "https://ridecheckauto.com",
  email: "support@ridecheckauto.com",
  areaServed: {
    "@type": "AdministrativeArea",
    name: "Lake County, Illinois",
  },
  serviceType: "Pre-purchase vehicle inspection",
};

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);
  if (!post) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ridecheckauto.com";
  const canonicalUrl = `${appUrl}/blog/${post.slug}`;

  const allPosts = getAllPosts();
  const sameCategory = allPosts.filter(
    (p) => p.slug !== post.slug && p.category === post.category
  );
  const relatedPosts = sameCategory.length >= 2
    ? sameCategory.slice(0, 2)
    : [
        ...sameCategory,
        ...allPosts
          .filter((p) => p.slug !== post.slug && !sameCategory.includes(p))
          .slice(0, 2 - sameCategory.length),
      ];

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedDate,
    dateModified: post.publishedDate,
    author: { "@type": "Organization", name: post.author },
    publisher: {
      "@type": "Organization",
      name: "RideCheck",
      url: "https://ridecheckauto.com",
    },
    url: canonicalUrl,
    ...(post.featuredImage && {
      image: `${appUrl}${post.featuredImage}`,
    }),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: appUrl },
      { "@type": "ListItem", position: 2, name: "Buyer Intelligence Hub", item: `${appUrl}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_SCHEMA) }}
      />

      <div className="min-h-screen">
        <section className="border-b bg-gradient-to-b from-emerald-50 to-white">
          <div className="mx-auto max-w-3xl px-4 py-8 md:py-12">
            <nav aria-label="Breadcrumb" className="mb-6">
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                data-testid="link-back-to-blog"
              >
                <ArrowLeft className="h-4 w-4" />
                Buyer Intelligence Hub
              </Link>
            </nav>

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <CategoryTag category={post.category} size="md" />
              {post.verdict && <VerdictBadge verdict={post.verdict} />}
            </div>

            <h1 className="text-2xl font-extrabold leading-tight text-gray-900 md:text-3xl">
              {post.title}
            </h1>

            <p className="mt-3 text-base text-gray-600 leading-relaxed">{post.excerpt}</p>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <time dateTime={post.publishedDate}>{formatBlogDate(post.publishedDate)}</time>
              </span>
              {post.locationTag && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {post.locationTag}
                </span>
              )}
              {post.vehicleTag && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5" />
                  {post.vehicleTag}
                </span>
              )}
              <span className="text-gray-400">{post.author}</span>
            </div>
          </div>
        </section>

        {post.featuredImage && (
          <div className="mx-auto max-w-3xl px-4 pt-6">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-100">
              <Image
                src={post.featuredImage}
                alt={post.featuredImageAlt || post.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>
          </div>
        )}

        <article className="mx-auto max-w-3xl px-4 py-8 md:py-10">
          <div className="space-y-5">
            {post.body.map((block, i) => (
              <ContentBlock key={i} block={block} />
            ))}
          </div>

          {post.galleryImages && post.galleryImages.length > 0 && (
            <div className="mt-8 pt-8 border-t">
              <EvidenceGallery images={post.galleryImages} />
            </div>
          )}
        </article>

        <section className="border-t bg-gray-50">
          <div className="mx-auto max-w-3xl px-4 py-8">
            <BlogLeadCapture />
          </div>
        </section>

        {post.ctaText && (
          <section className="border-t bg-white">
            <div className="mx-auto max-w-3xl px-4 py-8">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <p className="text-sm font-semibold text-emerald-800 mb-1">
                  Ready to protect yourself?
                </p>
                <p className="text-xl font-extrabold text-gray-900 mb-4">{post.ctaText}</p>
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                  data-testid="link-post-book-cta"
                >
                  Book Your RideCheck →
                </Link>
              </div>
            </div>
          </section>
        )}

        {relatedPosts.length > 0 && (
          <section className="border-t">
            <div className="mx-auto max-w-3xl px-4 py-10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                More from RideCheck Intelligence
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {relatedPosts.map((related) => (
                  <BlogCard key={related.slug} post={related} />
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link
                  href="/blog"
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  View all posts in the Buyer Intelligence Hub →
                </Link>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
