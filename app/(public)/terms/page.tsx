import { Logo } from "@/components/layout/Logo";
import Link from "next/link";
import { EFFECTIVE_DATE, TERMS_VERSION } from "@/lib/legal/constants";

export const metadata = {
  title: "Terms of Service | RideCheck",
  description:
    "RideCheck Terms of Service — understand your rights, our limitations, and what our pre-purchase vehicle inspection covers.",
};

export default function TermsPage() {
  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={36} />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-terms">
              Terms of Service
            </h1>
            <p className="text-sm text-muted-foreground">
              Effective Date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Version: {TERMS_VERSION}
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mb-8 leading-relaxed">
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of RideCheck&apos;s pre-purchase vehicle
          inspection and reporting services (&ldquo;Services&rdquo;) provided by RideCheck (&ldquo;RideCheck,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;). By using our website, booking an inspection, or completing
          payment, you agree to be bound by these Terms. If you do not agree, do not use our Services.
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. What RideCheck Provides</h2>
            <p className="text-muted-foreground mb-2">
              RideCheck is an <strong>independent, non-invasive pre-purchase vehicle inspection and
              reporting platform</strong>. When you submit vehicle details and complete payment,
              RideCheck will:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Review vehicle details provided by the customer</li>
              <li>Contact the seller to arrange access (Concierge mode) or coordinate based on customer-arranged access (Self-Arranged mode)</li>
              <li>Assign a trained independent field inspector (&ldquo;RideChecker&rdquo;)</li>
              <li>Conduct a visual, non-invasive multi-point inspection limited to observable conditions</li>
              <li>Deliver a structured written intelligence report including photographs, observational findings, risk indicators, and applicable market or negotiation context</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              RideCheck <strong>does not</strong> perform repairs, engine teardown, mechanical disassembly,
              compression testing, frame measurement, invasive diagnostics, or any certified mechanical
              inspection. RideCheck is not a repair shop, dealership, insurer, or vehicle certifier.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Service Packages and Pricing</h2>
            <p className="text-muted-foreground mb-2">
              RideCheck assigns packages based on vehicle classification (year, make, model, mileage,
              and market value). Current tiers are Basic ($139), Plus ($169), and Exotic ($299).
              Customers do not manually select tiers — the appropriate package is determined by our
              classification system.
            </p>
            <p className="text-muted-foreground">
              RideCheck reserves the right to reclassify a vehicle or adjust pricing if submitted
              information is inaccurate or if the vehicle characteristics differ materially from
              what was represented at booking.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Inspection Scope and Limitations</h2>
            <p className="text-muted-foreground mb-2">
              RideCheck inspections are <strong>visual, non-invasive, and limited to observable
              conditions at the time of inspection</strong>. The following limitations apply:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Hidden, intermittent, concealed, emerging, or inaccessible defects may not be detected</li>
              <li>Inspection findings may be affected by weather, lighting, vehicle cleanliness, battery state, engine temperature, seller access restrictions, and site conditions</li>
              <li>RideCheck does not guarantee that all issues have been identified</li>
              <li>Reports represent professional observational judgment and do not constitute certified mechanical verdicts</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              See our{" "}
              <Link href="/inspection-disclaimer" className="text-primary underline underline-offset-2">
                full Inspection Disclaimer
              </Link>{" "}
              for a complete description of what is and is not included.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. No Warranty, Guarantee, or Certification</h2>
            <p className="text-muted-foreground mb-2">
              <strong>RideCheck expressly disclaims all warranties</strong>, express or implied,
              relating to any vehicle inspected. RideCheck does not guarantee or certify:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>That the vehicle is free from defects, latent or patent</li>
              <li>That the vehicle will pass future emissions, registration, or state inspections</li>
              <li>That the vehicle will perform reliably, safely, or without repair after purchase</li>
              <li>That all observable or hidden issues have been identified and reported</li>
              <li>That any market value estimate is accurate, current, or binding</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Inspection reports reflect conditions observable at the time of inspection only.
              All used vehicles carry inherent risk. The buyer retains full and sole responsibility
              for the purchase decision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-2">
              <strong>To the maximum extent permitted by Illinois law, RideCheck&apos;s total liability for
              any claim arising from or related to any inspection service is strictly limited to the
              inspection fee paid for that specific order.</strong>
            </p>
            <p className="text-muted-foreground mb-2">
              RideCheck is not liable for:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Any vehicle repair costs incurred after purchase</li>
              <li>Diminished market value or resale losses</li>
              <li>Towing, transportation, rental, or travel costs</li>
              <li>Lost opportunity, time, or wages</li>
              <li>Consequential, incidental, indirect, punitive, or special damages of any kind</li>
              <li>Undetected issues not observable during a non-invasive visual inspection</li>
              <li>Seller misrepresentation, fraud, or concealment</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              This limitation applies regardless of the theory of liability (contract, tort, strict
              liability, or otherwise) and even if RideCheck has been advised of the possibility of
              such damages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. No Sole Reliance</h2>
            <p className="text-muted-foreground">
              You agree not to rely solely on a RideCheck report when making a vehicle purchase
              decision. RideCheck reports are one tool among several. Buyers are encouraged to seek
              additional professional evaluation, vehicle history reports, and independent mechanical
              opinions when purchasing high-value, modified, or salvage-titled vehicles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Seller Cooperation</h2>
            <p className="text-muted-foreground mb-2">
              RideCheck&apos;s ability to complete an inspection depends on seller cooperation and access.
              If a seller refuses access or becomes unresponsive after booking:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li><strong>Before inspector assignment:</strong> Full refund issued</li>
              <li><strong>After inspector assignment or travel begins:</strong> No refund — labor and dispatch costs have been incurred</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              RideCheck enforces a maximum three-contact attempt policy for seller outreach in
              Concierge mode. If seller is unresponsive after three documented attempts, the order
              is closed and refund eligibility is determined by assignment status.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Payment and Refund Policy</h2>
            <p className="text-muted-foreground mb-2">
              Payment is required before inspection scheduling begins. All processing is via Stripe.
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Full refund if no assignment or contact has occurred</li>
              <li>No refund once inspector assignment, dispatch, or travel begins</li>
              <li>No refund for completed inspections, regardless of findings or report content</li>
            </ul>
            <p className="text-muted-foreground mt-2">
              Chargebacks filed without prior contact may result in account restrictions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Road Tests and OBD-II Scans</h2>
            <p className="text-muted-foreground">
              Road tests and OBD-II scans are performed only when seller permission is granted and
              conditions are safe and legally permissible. RideCheck is not responsible if a seller
              refuses road test access, an OBD port is inaccessible, or weather or location
              conditions prevent execution.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Timing and Turnaround</h2>
            <p className="text-muted-foreground">
              Most inspections are completed within 24–48 hours of payment, subject to seller
              availability, weather conditions, inspector scheduling, and service area capacity.
              RideCheck does not guarantee specific turnaround times and is not liable for delays
              caused by third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Independent Contractor Inspectors</h2>
            <p className="text-muted-foreground">
              RideCheck inspectors (&ldquo;RideCheckers&rdquo;) operate as independent contractors.
              RideCheck provides inspection standards, reporting formats, and quality oversight, but
              does not control the minute-by-minute execution of inspection work. No RideChecker has
              authority to make warranties, guarantees, or representations beyond the scope of the
              inspection and approved reporting language. RideCheck is not liable for the independent
              actions, representations, or omissions of individual RideCheckers outside of the scope
              of assigned inspections.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Service Area Limitations</h2>
            <p className="text-muted-foreground">
              RideCheck currently operates in limited pilot service areas in Lake County, Illinois
              and surrounding ZIP codes. Availability is subject to inspector capacity and active
              area designation. RideCheck reserves the right to decline, cancel, or defer service
              outside active areas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. User Responsibilities</h2>
            <p className="text-muted-foreground mb-2">By using RideCheck, you agree to:</p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Provide accurate and complete vehicle and seller information at booking</li>
              <li>Make your own independent purchase decision</li>
              <li>Conduct additional due diligence appropriate to the vehicle and transaction</li>
              <li>Not hold RideCheck responsible for post-purchase vehicle outcomes</li>
              <li>Not use the Services for fraudulent, deceptive, or unlawful purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Right to Refuse Service</h2>
            <p className="text-muted-foreground">
              RideCheck reserves the right to refuse, cancel, or suspend service at any time for
              any reason, including suspected fraud, abuse, inaccurate information, safety concerns,
              or operation outside active service areas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Modifications to Terms</h2>
            <p className="text-muted-foreground">
              RideCheck may update these Terms at any time by posting a revised version with an
              updated effective date. Continued use of Services after the effective date constitutes
              acceptance of the revised Terms. Each customer&apos;s acceptance is recorded with version
              information for audit purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">16. Governing Law and Venue</h2>
            <p className="text-muted-foreground">
              These Terms are governed exclusively by the laws of the State of Illinois, without
              regard to conflict-of-law principles. Any dispute arising under or related to these
              Terms shall be resolved exclusively in the state or federal courts of Lake County,
              Illinois. You waive any objection to personal jurisdiction or venue in such courts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">17. Entire Agreement</h2>
            <p className="text-muted-foreground">
              These Terms, together with the{" "}
              <Link href="/inspection-disclaimer" className="text-primary underline underline-offset-2">Inspection Disclaimer</Link>,{" "}
              <Link href="/customer-agreement" className="text-primary underline underline-offset-2">Customer Agreement</Link>, and{" "}
              <Link href="/privacy" className="text-primary underline underline-offset-2">Privacy Policy</Link>{" "}
              constitute the entire agreement between you and RideCheck with respect to the Services
              and supersede all prior agreements or representations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">18. Contact Information</h2>
            <p className="text-muted-foreground">
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
