import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800" data-testid="banner-pilot-global">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2 flex items-center justify-between">
          <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-200">
            <span className="font-semibold">Now serving: Lake County, IL only</span>
            <span className="hidden sm:inline"> — We&apos;re in pilot mode. Enter your ZIP to confirm availability before booking.</span>
          </p>
          <Link
            href="/book"
            className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline whitespace-nowrap ml-4"
            data-testid="link-book-now"
          >
            Book Now
          </Link>
        </div>
      </div>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
