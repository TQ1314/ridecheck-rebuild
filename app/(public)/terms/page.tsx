import { Logo } from "@/components/layout/Logo";

export default function TermsPage() {
  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={36} />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-terms">Terms &amp; Conditions</h1>
            <p className="text-sm text-muted-foreground">Last Updated: February 2026</p>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. What RideCheck Provides</h2>
            <p className="text-muted-foreground mb-3">RideCheck is a pre-purchase vehicle intelligence platform.</p>
            <p className="text-muted-foreground mb-2">When you submit vehicle details and complete payment, RideCheck will:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Review the vehicle details provided</li>
              <li>Contact the seller (Concierge mode) or coordinate based on buyer-arranged access (Self-Arranged mode)</li>
              <li>Assign a trained independent inspector (&quot;RideChecker&quot;)</li>
              <li>Conduct a visual, non-invasive multi-point inspection</li>
              <li>Deliver a structured intelligence report including photos and/or video, observational findings, risk indicators, market value assessment, and negotiation guidance where applicable</li>
            </ul>
            <p className="text-muted-foreground mt-3">RideCheck inspections are visual assessments only. We do not perform mechanical disassembly, invasive diagnostics, component removal, or certified mechanical tear-downs.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Vehicle-Based Package Classification</h2>
            <p className="text-muted-foreground mb-2">RideCheck packages are determined by vehicle type, age, mileage, and market value. Customers do not select inspection tiers manually.</p>
            <p className="text-muted-foreground mb-2">RideCheck&apos;s system classifies each vehicle into one of the following public service tiers:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Standard</li>
              <li>Plus</li>
              <li>Premium</li>
              <li>Exotic</li>
            </ul>
            <p className="text-muted-foreground mt-2">RideCheck reserves the right to reclassify a vehicle if submitted information is inaccurate or incomplete.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Not a Warranty or Guarantee</h2>
            <p className="text-muted-foreground mb-2">RideCheck does not guarantee or certify:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>That the vehicle will pass future emissions or state inspections</li>
              <li>That the vehicle is free from hidden defects</li>
              <li>That the vehicle will perform reliably after purchase</li>
              <li>That all mechanical, structural, or electronic issues have been identified</li>
            </ul>
            <p className="text-muted-foreground mt-2">Inspection reports reflect the vehicle&apos;s observable condition at the time of inspection only. All used vehicles carry inherent risk. The buyer retains full responsibility for the purchase decision.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Market Value &amp; Negotiation Guidance</h2>
            <p className="text-muted-foreground mb-2">RideCheck reports may include market value comparisons, observed pricing discrepancies, and negotiation recommendations.</p>
            <p className="text-muted-foreground">These estimates are based on available data and professional judgment. They are not appraisals, guarantees of value, or financial advice.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Seller Cooperation Required</h2>
            <p className="text-muted-foreground mb-2">RideCheck cannot complete inspections without seller access. If a seller refuses access or becomes unresponsive:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Before inspector assignment: Full refund</li>
              <li>After inspector assignment and travel has begun: No refund</li>
            </ul>
            <p className="text-muted-foreground mt-2">Labor, scheduling, and coordination costs are incurred once assignment occurs.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Payment &amp; Refund Policy</h2>
            <p className="text-muted-foreground mb-2">All payments are processed securely via Stripe. Payment is required before seller contact and inspection scheduling.</p>
            <p className="text-muted-foreground mb-2 font-medium">Refund Policy:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Full refund if no inspector has been assigned</li>
              <li>No refund once inspector assignment or travel begins</li>
              <li>No refund for completed inspections, regardless of findings</li>
            </ul>
            <p className="text-muted-foreground mt-2">Chargebacks filed without prior contact may result in account restriction.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Timing &amp; Turnaround</h2>
            <p className="text-muted-foreground mb-2">Most inspections are completed within 24–48 hours of payment, subject to seller availability, weather conditions, inspector scheduling, and service area limitations.</p>
            <p className="text-muted-foreground">RideCheck does not guarantee specific turnaround times.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Road Tests &amp; OBD-II Scans</h2>
            <p className="text-muted-foreground mb-2">Road tests and OBD scans are performed when seller permission is granted and conditions are safe and legally permissible.</p>
            <p className="text-muted-foreground">RideCheck is not responsible if a seller refuses a road test, an OBD port is inaccessible, or weather conditions prevent certain checks.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Report Accuracy &amp; Limitations</h2>
            <p className="text-muted-foreground mb-2">RideCheck inspectors provide structured observational findings. However:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Some issues are not visible without disassembly</li>
              <li>Intermittent problems may not appear during inspection</li>
              <li>Repair estimates are approximate</li>
              <li>Findings represent professional opinion, not certified mechanical verdicts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-2">RideCheck&apos;s total liability for any claim is limited to the amount paid for that specific inspection.</p>
            <p className="text-muted-foreground">RideCheck is not liable for vehicle repair costs after purchase, consequential or incidental damages, lost opportunity costs, travel expenses, or undetected issues not observable during inspection.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Independent Inspectors</h2>
            <p className="text-muted-foreground">RideCheckers operate as independent contractors. RideCheck provides standards, structure, and report formatting but does not control the minute-by-minute execution methods of independent contractors.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Service Area Limitations</h2>
            <p className="text-muted-foreground">RideCheck currently operates in limited pilot service areas. Availability is restricted by ZIP code and county. RideCheck reserves the right to decline service outside active areas.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. User Responsibilities</h2>
            <p className="text-muted-foreground mb-2">By using RideCheck, you agree to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Provide accurate vehicle information</li>
              <li>Make your own independent buying decision</li>
              <li>Conduct additional due diligence if desired</li>
              <li>Not hold RideCheck responsible for post-purchase outcomes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Prohibited Uses</h2>
            <p className="text-muted-foreground mb-2">You may not use RideCheck to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Harass or intimidate sellers</li>
              <li>Misrepresent your identity</li>
              <li>Reverse engineer inspection processes</li>
              <li>Resell inspection data commercially without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Governing Law</h2>
            <p className="text-muted-foreground">These Terms are governed by the laws of the State of Illinois. Any disputes shall be resolved in Lake County, Illinois.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">16. Contact Information</h2>
            <p className="text-muted-foreground">
              RideCheck<br />
              33 N County St<br />
              Waukegan, IL 60085<br />
              Email: support@ridecheckauto.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
