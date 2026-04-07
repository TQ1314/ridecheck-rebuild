import { Logo } from "@/components/layout/Logo";
import { EFFECTIVE_DATE } from "@/lib/legal/constants";

export const metadata = {
  title: "Privacy Policy | RideCheck",
  description:
    "RideCheck Privacy Policy — how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={36} />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-privacy">
              Privacy Policy
            </h1>
            <p className="text-sm text-muted-foreground">
              Effective Date: {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mb-8 leading-relaxed">
          This Privacy Policy explains how RideCheck (&ldquo;RideCheck,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
          &ldquo;our&rdquo;) collects, uses, shares, and protects information in connection with your use of our
          website and pre-purchase vehicle inspection services. By using RideCheck, you consent to the
          practices described in this policy.
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>

            <h3 className="text-base font-medium mt-4 mb-2">Identity and Contact Information</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Mailing address (where provided)</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">Vehicle and Booking Information</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Year, make, model, and trim</li>
              <li>Odometer reading</li>
              <li>Asking price and listing platform</li>
              <li>Listing URL (if provided)</li>
              <li>Seller name, phone, and contact details</li>
              <li>Vehicle location or seller address</li>
              <li>Booking type and inspection package selected</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">Payment Information</h3>
            <p className="text-muted-foreground">
              All payment processing is handled by Stripe, Inc. RideCheck does not store, access, or
              retain full credit card numbers, CVV codes, or bank account details. Stripe&apos;s privacy
              practices govern payment data — see{" "}
              <a href="https://stripe.com/privacy" className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">stripe.com/privacy</a>.
              We retain Stripe customer IDs and payment status for order reconciliation purposes.
            </p>

            <h3 className="text-base font-medium mt-4 mb-2">Communication Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>SMS messages sent or received in connection with your order</li>
              <li>Email communications related to booking, reporting, and support</li>
              <li>Contact form submissions</li>
              <li>Seller contact and coordination logs</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">Technical and Usage Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>IP address (stored in hashed form where used for legal acceptance logging)</li>
              <li>Browser type and version</li>
              <li>Device type and operating system</li>
              <li>Pages visited and session duration</li>
              <li>Referral source and navigation paths</li>
              <li>Timestamps and feature interaction logs</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">Legal Acceptance Records</h3>
            <p className="text-muted-foreground">
              When you accept our Terms, Inspection Disclaimer, or Customer Agreement at checkout,
              we record the version accepted, date and time, hashed IP address, browser agent, and
              order ID for compliance and audit purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-2">We use the information we collect to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Classify vehicles into appropriate inspection tiers and generate accurate quotes</li>
              <li>Contact sellers and coordinate inspection logistics</li>
              <li>Assign qualified RideCheckers to orders based on location and availability</li>
              <li>Process and verify payments</li>
              <li>Deliver inspection reports and supporting media</li>
              <li>Communicate booking status, inspector assignment, and report delivery updates</li>
              <li>Provide customer support and resolve disputes</li>
              <li>Improve service quality, inspector training, and internal processes</li>
              <li>Detect and prevent fraud, abuse, and unauthorized use</li>
              <li>Maintain accurate legal and compliance records</li>
              <li>Conduct internal analytics and service performance monitoring</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Information Sharing and Disclosure</h2>
            <p className="text-muted-foreground mb-2">
              RideCheck does <strong>not sell, rent, or trade</strong> your personal information.
              We share data only in the following limited circumstances:
            </p>

            <h3 className="text-base font-medium mt-4 mb-1">With RideCheckers (Field Inspectors)</h3>
            <p className="text-muted-foreground">
              We share necessary coordination details (vehicle location, seller contact information,
              and booking notes) with the assigned RideChecker. Inspectors are bound by confidentiality
              obligations.
            </p>

            <h3 className="text-base font-medium mt-4 mb-1">With Sellers</h3>
            <p className="text-muted-foreground">
              Buyer first name and RideCheck&apos;s identity may be disclosed when scheduling inspection
              access. We do not share buyer payment details, contact information, or full report
              contents with sellers.
            </p>

            <h3 className="text-base font-medium mt-4 mb-1">With Technology Service Providers</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li><strong>Stripe</strong> — payment processing</li>
              <li><strong>Twilio</strong> — SMS delivery</li>
              <li><strong>Resend</strong> — transactional email delivery</li>
              <li><strong>Supabase</strong> — database hosting and authentication infrastructure</li>
              <li><strong>Vercel / hosting providers</strong> — platform infrastructure</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              These providers access only the minimum data necessary to perform their services and
              are subject to applicable data processing agreements.
            </p>

            <h3 className="text-base font-medium mt-4 mb-1">Legal and Compliance</h3>
            <p className="text-muted-foreground">
              We may disclose information as required by applicable law, valid legal process (such
              as a subpoena or court order), or to protect the rights, property, or safety of
              RideCheck, its customers, or the public.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. SMS and Email Communications</h2>
            <p className="text-muted-foreground mb-2">
              RideCheck communicates via SMS and email for transactional purposes related to your
              active booking, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Payment confirmation and receipt</li>
              <li>Inspector assignment notification</li>
              <li>Inspection status updates</li>
              <li>Report delivery</li>
              <li>Support follow-up</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Transactional communications cannot be opted out of while an active order exists.
              Marketing communications are sent only with express consent. Standard message and data
              rates may apply to SMS messages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain personal data for as long as necessary to: (a) fulfill the services requested;
              (b) comply with applicable legal and tax obligations; (c) resolve disputes; and (d)
              enforce our agreements. Inspection reports and associated media are retained for a minimum
              of two years from the date of delivery. Legal acceptance records are retained
              indefinitely for compliance purposes. You may request deletion of non-essential personal
              data by contacting us, subject to applicable legal retention obligations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
            <p className="text-muted-foreground mb-2">
              RideCheck uses commercially reasonable technical and organizational safeguards to protect
              your information, including:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Encrypted payment processing (Stripe)</li>
              <li>Encrypted data storage and transmission (TLS/SSL)</li>
              <li>Role-based internal access controls — only authorized personnel can access customer data</li>
              <li>IP address hashing for legal acceptance audit records</li>
              <li>Supabase row-level security policies for database access control</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              No online system can guarantee absolute security. In the event of a data breach
              affecting your personal information, we will notify you as required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground mb-2">You may:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Request access to the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your data where legally permissible</li>
              <li>Opt out of non-transactional marketing communications</li>
              <li>Ask questions about how your data is used</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              To exercise any of these rights, contact us at support@ridecheckauto.com. We will
              respond within a reasonable timeframe, consistent with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies and Tracking</h2>
            <p className="text-muted-foreground">
              RideCheck uses session cookies to maintain authenticated state and basic functionality.
              We may use analytics tools to monitor aggregate traffic patterns and improve the
              platform. We do not use third-party advertising tracking or cross-site behavioral
              tracking cookies. Disabling cookies may limit certain features of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground">
              RideCheck does not knowingly collect personal information from individuals under the
              age of 18. If you believe we have inadvertently collected such information, please
              contact us immediately so we can remove it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Governing Law</h2>
            <p className="text-muted-foreground">
              This Privacy Policy is governed by the laws of the State of Illinois. RideCheck
              operates as an Illinois-based business serving U.S. customers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Updates to This Policy</h2>
            <p className="text-muted-foreground">
              RideCheck may update this Privacy Policy at any time. We will post the revised
              policy with an updated effective date. Continued use of the platform after updates
              constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact Us</h2>
            <p className="text-muted-foreground">
              For privacy questions, data access requests, or concerns:<br /><br />
              RideCheck<br />
              33 N County St, Waukegan, IL 60085<br />
              Email: support@ridecheckauto.com
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
