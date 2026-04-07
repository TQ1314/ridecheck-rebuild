import { Logo } from "@/components/layout/Logo";
import { EFFECTIVE_DATE, TERMS_VERSION } from "@/lib/legal/constants";

export const metadata = {
  title: "Customer Agreement | RideCheck",
  description:
    "RideCheck Customer Agreement — understand your rights, responsibilities, and the scope of our pre-purchase vehicle inspection service.",
};

export default function CustomerAgreementPage() {
  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={36} />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-customer-agreement">
              Customer Agreement
            </h1>
            <p className="text-sm text-muted-foreground">
              Effective Date: {EFFECTIVE_DATE} &nbsp;·&nbsp; Version: {TERMS_VERSION}
            </p>
          </div>
        </div>

        <p className="text-muted-foreground mb-8 leading-relaxed">
          This Customer Agreement (&ldquo;Agreement&rdquo;) governs your use of RideCheck&apos;s
          pre-purchase vehicle inspection and reporting services (&ldquo;Services&rdquo;). By
          completing a booking or clicking &ldquo;I agree&rdquo; on any checkout or intake form,
          you acknowledge that you have read, understood, and agree to be bound by this Agreement.
          This electronic acceptance constitutes a legally binding agreement under Illinois law and
          applicable federal electronic commerce statutes, including the Electronic Signatures in
          Global and National Commerce Act (E-SIGN).
        </p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Scope of Service</h2>
            <p className="text-muted-foreground mb-2">
              RideCheck provides a <strong>visual, non-invasive observational pre-purchase vehicle
              inspection</strong> and a structured written findings report (&ldquo;Report&rdquo;). Services may
              include, depending on the purchased package:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Multi-point exterior and interior visual inspection</li>
              <li>OBD-II scan when port is accessible and seller grants permission</li>
              <li>Short road test when seller grants permission and conditions are safe</li>
              <li>Photographs and/or video documentation of findings</li>
              <li>Structured report with risk indicators and observational findings</li>
              <li>Market value context and negotiation observations where applicable</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Services do <strong>not</strong> include mechanical disassembly, repair services,
              engine teardown, frame measurement, compressed-air testing, any form of destructive
              testing, or any activity requiring licensing as a mechanic or repair facility.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Customer Acknowledgment of Limitations</h2>
            <p className="text-muted-foreground mb-2">
              You acknowledge and agree that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>RideCheck inspections are visual and non-invasive only</li>
              <li>Hidden, intermittent, concealed, inaccessible, or emerging defects may not be detected</li>
              <li>Inspection findings represent observable conditions at the time of inspection only and may change over time</li>
              <li>Inspection accuracy may be affected by weather, lighting, vehicle cleanliness, temperature, access restrictions, and site conditions</li>
              <li>No inspection — invasive or non-invasive — can guarantee identification of every vehicle defect</li>
              <li>RideCheck does not control seller access or cooperation, and incomplete access may limit findings</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. No Sole Reliance</h2>
            <p className="text-muted-foreground">
              You agree that you will <strong>not rely solely on a RideCheck report</strong> as the
              basis for your vehicle purchase decision. A RideCheck inspection is one tool among
              several that a reasonable buyer should consider. RideCheck strongly encourages customers
              to consult licensed mechanics, conduct additional due diligence, obtain vehicle history
              reports, and seek professional advice appropriate to the value and complexity of the
              vehicle under consideration.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. No Warranty or Guarantee</h2>
            <p className="text-muted-foreground">
              A RideCheck Report does <strong>not</strong> constitute a warranty, guarantee,
              certification, appraisal, or promise of any kind regarding the vehicle&apos;s condition,
              merchantability, safety, reliability, fitness for a particular purpose, or future
              performance. All implied warranties are expressly disclaimed to the maximum extent
              permitted by Illinois law. The existence of a favorable report does not assure that
              the vehicle will remain in the same condition or perform reliably after purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-2">
              To the maximum extent permitted by applicable law:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>
                <strong>RideCheck&apos;s total liability for any claim arising from or related to
                Services shall not exceed the inspection fee actually paid by you for that specific
                order.</strong>
              </li>
              <li>RideCheck shall not be liable for any post-purchase vehicle repair costs, diminished value, towing or transportation costs, lost opportunity, travel expenses, lost wages, or any consequential, incidental, indirect, punitive, or special damages of any kind.</li>
              <li>RideCheck is not a party to any vehicle sale transaction and has no responsibility for the seller&apos;s representations, the vehicle&apos;s title status, or the terms of any sale agreement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify, defend, and hold harmless RideCheck, its affiliates, officers,
              RideCheckers, and agents from and against any claims, liabilities, damages, costs, and
              expenses (including reasonable attorneys&apos; fees) arising out of or related to: (a) your
              use of the Services; (b) your vehicle purchase decision; (c) your violation of this
              Agreement; (d) your negligence or willful misconduct; or (e) inaccurate information
              you provided in connection with your booking.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Payment and Refund Policy</h2>
            <p className="text-muted-foreground mb-2">
              All payments are processed securely via Stripe. Payment is required prior to scheduling
              the inspection. Our refund policy is as follows:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li><strong>Full refund</strong> if no inspector has been assigned and seller contact has not been initiated.</li>
              <li><strong>No refund</strong> once inspector assignment, dispatch, or travel has begun — regardless of whether inspection is completed.</li>
              <li><strong>No refund</strong> for completed inspections, regardless of findings or report content.</li>
              <li><strong>No refund</strong> if seller refuses access after inspector arrival.</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Chargebacks or payment disputes filed without first contacting RideCheck at
              support@ridecheckauto.com may result in account restrictions and reporting to fraud
              prevention services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Seller Access and Cooperation</h2>
            <p className="text-muted-foreground">
              RideCheck&apos;s ability to complete a thorough inspection depends on seller cooperation
              and access. You acknowledge that the seller — not RideCheck — controls access to the
              vehicle, and that restricted access, locked compartments, seller refusal, or unsafe
              conditions may limit or prevent inspection activities. RideCheck is not responsible for
              inspection limitations resulting from seller conduct.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Report Use and Confidentiality</h2>
            <p className="text-muted-foreground">
              Reports are provided solely for the use of the ordering customer. Reports may not be
              resold, publicly distributed, or shared with third parties for commercial purposes without
              RideCheck&apos;s prior written consent. Third parties who receive or view a RideCheck Report
              should not rely on it as they are not the intended recipient and RideCheck assumes no duty
              to them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Electronic Acceptance</h2>
            <p className="text-muted-foreground">
              By clicking &ldquo;I agree,&rdquo; completing your booking, or initiating payment, you
              acknowledge that you have read and understood this Agreement and intend to be legally
              bound. Electronic acceptance is valid and enforceable under the Illinois Electronic
              Commerce Security Act and the federal E-SIGN Act. RideCheck maintains a timestamped
              audit record of your acceptance including IP address (hashed), browser agent, terms
              version, and time of acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Governing Law and Venue</h2>
            <p className="text-muted-foreground">
              This Agreement is governed exclusively by the laws of the State of Illinois, without
              regard to conflict-of-law principles. Any claim or dispute arising under or related to
              this Agreement shall be resolved exclusively in the state or federal courts located in
              Lake County, Illinois. You waive any objection to personal jurisdiction or venue in
              such courts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Modifications</h2>
            <p className="text-muted-foreground">
              RideCheck may update this Agreement at any time by posting a revised version with an
              updated effective date. Continued use of the Services after the effective date constitutes
              acceptance of the revised Agreement. We will maintain versioned records of agreements
              accepted by each customer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contact</h2>
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
