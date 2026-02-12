import Link from "next/link";
import { Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-lg mb-3"
            >
              <Shield className="h-5 w-5 text-primary" />
              <span>RideCheck</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Pre-car-purchase intelligence you can trust.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Services</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-foreground transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-foreground transition-colors">
                  Book Assessment
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Account</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/auth/login" className="hover:text-foreground transition-colors">
                  Log In
                </Link>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-foreground transition-colors">
                  Register
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-foreground transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="mailto:support@ridecheck.com" className="hover:text-foreground transition-colors">
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} RideCheck. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
