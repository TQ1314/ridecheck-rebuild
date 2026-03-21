import type { BlogCategory } from "@/lib/blog/types";

const CATEGORY_STYLES: Record<BlogCategory, string> = {
  "Fraud Alerts": "bg-red-50 text-red-700 border-red-200",
  "Green Light Gems": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Field Intelligence": "bg-blue-50 text-blue-700 border-blue-200",
  "Buyer's Playbook": "bg-amber-50 text-amber-700 border-amber-200",
};

interface CategoryTagProps {
  category: BlogCategory;
  size?: "sm" | "md";
}

export function CategoryTag({ category, size = "sm" }: CategoryTagProps) {
  const baseStyles = CATEGORY_STYLES[category] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const sizeStyles =
    size === "md"
      ? "px-3 py-1 text-xs font-semibold rounded-full border"
      : "px-2 py-0.5 text-xs font-semibold rounded-full border";

  return (
    <span className={`inline-flex items-center ${sizeStyles} ${baseStyles}`}>
      {category}
    </span>
  );
}
