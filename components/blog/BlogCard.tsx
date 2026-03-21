import Link from "next/link";
import { MapPin, Calendar } from "lucide-react";
import { CategoryTag } from "./CategoryTag";
import { VerdictBadge } from "./VerdictBadge";
import { formatBlogDate } from "@/lib/blog/loader";
import type { BlogPost } from "@/lib/blog/types";

interface BlogCardProps {
  post: BlogPost;
  featured?: boolean;
}

export function BlogCard({ post, featured = false }: BlogCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      data-testid={`card-blog-${post.slug}`}
    >
      <div className={`p-5 ${featured ? "sm:p-6" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <CategoryTag category={post.category} />
          {post.verdict && <VerdictBadge verdict={post.verdict} />}
        </div>

        <h3
          className={`font-extrabold leading-snug text-gray-900 group-hover:text-primary transition-colors ${
            featured ? "text-lg sm:text-xl" : "text-base"
          }`}
        >
          {post.title}
        </h3>

        <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3">
          {post.excerpt}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            {formatBlogDate(post.publishedDate)}
          </span>
          {post.locationTag && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              {post.locationTag}
            </span>
          )}
          {post.vehicleTag && (
            <span className="text-gray-400">{post.vehicleTag}</span>
          )}
        </div>

        <div className="mt-4 text-xs font-semibold text-primary group-hover:underline">
          Read report →
        </div>
      </div>
    </Link>
  );
}
