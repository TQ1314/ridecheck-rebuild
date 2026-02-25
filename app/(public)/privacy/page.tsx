import { Shield } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-privacy">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last Updated: February 2026</p>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground mb-2">When you use RideCheck, we may collect:</p>

            <h3 className="text-base font-medium mt-4 mb-2">Contact Information</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Name</li>
              <li>Phone number</li>
              <li>Email address</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">Vehicle Information</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Year, make, model</li>
              <li>Mileage</li>
              <li>Asking price</li>
              <li>Listing URL (if provided)</li>
              <li>Seller contact details</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">Payment Information</h3>
            <p className="text-muted-foreground">All payment processing is handled by Stripe. RideCheck does not store full credit card numbers.</p>

            <h3 className="text-base font-medium mt-4 mb-2">Communication Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>SMS messages</li>
              <li>Email communications</li>
              <li>Website chat</li>
              <li>Phone call logs</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-2">Technical &amp; Usage Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>IP address</li>
              <li>Browser type</li>
              <li>Device information</li>
              <li>Pages visited</li>
              <li>Session duration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-2">We use collected data to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Classify vehicles into appropriate inspection tiers</li>
              <li>Contact sellers and coordinate inspections</li>
              <li>Assign inspectors</li>
              <li>Deliver reports</li>
              <li>Process payments</li>
              <li>Provide support</li>
              <li>Improve service quality</li>
              <li>Monitor fraud and abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Information Sharing</h2>
            <p className="text-muted-foreground mb-2">We share data only when necessary:</p>

            <h3 className="text-base font-medium mt-4 mb-1">With Inspectors</h3>
            <p className="text-muted-foreground">Name and necessary coordination details.</p>

            <h3 className="text-base font-medium mt-4 mb-1">With Sellers</h3>
            <p className="text-muted-foreground">Buyer name may be disclosed when scheduling inspections.</p>

            <h3 className="text-base font-medium mt-4 mb-1">With Service Providers</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Stripe (payment processing)</li>
              <li>Twilio (SMS delivery)</li>
              <li>Email service providers</li>
              <li>Hosting providers</li>
            </ul>

            <h3 className="text-base font-medium mt-4 mb-1">Legal Compliance</h3>
            <p className="text-muted-foreground">If required by law or court order.</p>

            <p className="text-muted-foreground mt-3 font-medium">RideCheck does not sell or rent personal information.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Communication Channels</h2>
            <p className="text-muted-foreground mb-2">RideCheck communicates via SMS, email, website chat, and phone.</p>
            <p className="text-muted-foreground">Transactional communications cannot be opted out of while an active order exists.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
            <p className="text-muted-foreground mb-2">We retain data as needed to provide services, comply with legal obligations, and resolve disputes.</p>
            <p className="text-muted-foreground mb-2">Inspection reports and media are retained for at least 2 years.</p>
            <p className="text-muted-foreground">You may request deletion of personal data, subject to legal retention requirements.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Data Security</h2>
            <p className="text-muted-foreground mb-2">RideCheck uses commercially reasonable safeguards including:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Encrypted payment processing (Stripe)</li>
              <li>Secure hosting infrastructure</li>
              <li>Role-based internal access controls</li>
            </ul>
            <p className="text-muted-foreground mt-2">No online system is 100% secure.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
            <p className="text-muted-foreground mb-2">You may:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Request access to your data</li>
              <li>Request correction</li>
              <li>Request deletion (where legally permissible)</li>
              <li>Opt out of non-essential communications</li>
            </ul>
            <p className="text-muted-foreground mt-2">Contact: support@ridecheckauto.com</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies &amp; Tracking</h2>
            <p className="text-muted-foreground mb-2">RideCheck uses cookies to maintain session state, improve performance, and analyze traffic patterns.</p>
            <p className="text-muted-foreground">Disabling cookies may limit functionality.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Updates to This Policy</h2>
            <p className="text-muted-foreground">RideCheck may update this policy at any time. Continued use of the platform after updates constitutes acceptance of the revised policy.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
