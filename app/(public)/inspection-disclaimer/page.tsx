import { Logo } from "@/components/layout/Logo";
import { InspectionDisclaimer } from "@/components/legal/InspectionDisclaimer";
import { EFFECTIVE_DATE } from "@/lib/legal/constants";

export const metadata = {
  title: "Inspection Disclaimer | RideCheck",
  description:
    "Understand the scope, limitations, and conditions of a RideCheck pre-purchase vehicle inspection.",
};

export default function InspectionDisclaimerPage() {
  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={36} />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-disclaimer">
              Inspection Disclaimer
            </h1>
            <p className="text-sm text-muted-foreground">
              Effective Date: {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <InspectionDisclaimer variant="banner" className="mb-8" />

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Nature of Service</h2>
            <p className="text-muted-foreground">
              RideCheck provides a <strong>visual, non-invasive, observational pre-purchase vehicle
              inspection</strong>. Our service is limited to what a trained independent contractor
              (a &ldquo;RideChecker&rdquo;) can observe, document, and report on without disassembly,
              mechanical modification, or invasive testing of any kind.
            </p>
            <p className="text-muted-foreground mt-3">
              RideCheck is an <strong>inspection and reporting service only</strong>. We are not a
              repair shop, dealership, appraiser, insurance adjuster, or vehicle certification authority.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. What Is Not Performed</h2>
            <p className="text-muted-foreground mb-2">
              The following procedures are <strong>explicitly not included</strong> in any RideCheck
              inspection unless separately stated in writing:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Engine teardown, disassembly, or internal inspection</li>
              <li>Compression or leak-down testing</li>
              <li>Internal transmission, differential, or transfer case inspection</li>
              <li>Frame or structural measurement analysis</li>
              <li>Destructive testing of any kind</li>
              <li>Fluid sampling or laboratory analysis</li>
              <li>Airbag system, SRS module, or pyrotechnic device inspection</li>
              <li>Electrical wiring harness inspection beyond accessible connectors</li>
              <li>Exhaust system inspection beyond visible exterior components</li>
              <li>Inspection of components not accessible due to seller restrictions or locked compartments</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Conditions That May Limit Findings</h2>
            <p className="text-muted-foreground mb-2">
              Inspection findings are a <strong>snapshot of observable conditions at the time of
              inspection only</strong>. The following conditions may affect the completeness or
              accuracy of any report:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Adverse weather (rain, snow, extreme cold or heat)</li>
              <li>Poor lighting at the inspection location</li>
              <li>Vehicle cleanliness or body covering obstructing surfaces</li>
              <li>Engine temperature (cold start vs. warmed up)</li>
              <li>Battery state of charge</li>
              <li>Seller-imposed access restrictions or locked compartments</li>
              <li>Software-controlled or intermittent electronic faults that are not active at time of inspection</li>
              <li>Modifications, aftermarket parts, or repairs that conceal original conditions</li>
              <li>Undercarriage access limitations due to ground clearance or mud/ice accumulation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Issues That May Not Be Detected</h2>
            <p className="text-muted-foreground mb-2">
              By the inherent nature of a non-invasive, visual-only inspection, the following types
              of issues <strong>may exist and may not be detected</strong>:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Internal engine or transmission wear not yet exhibiting external symptoms</li>
              <li>Intermittent electrical faults that do not appear during inspection</li>
              <li>Hidden or concealed prior accident damage (e.g., hidden welds, filler, repaints)</li>
              <li>Internal frame or unibody corrosion not visible from the exterior</li>
              <li>Pre-detonation, misfires, or valve issues requiring compression or cylinder-specific testing</li>
              <li>Emerging or impending component failures with no current observable symptom</li>
              <li>OBD fault codes that have been cleared shortly before inspection</li>
              <li>Odometer tampering or VIN cloning (beyond published VIN check scope)</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              <strong>RideCheck does not and cannot guarantee identification of all vehicle issues.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Not a Substitute for Certified Inspection</h2>
            <p className="text-muted-foreground">
              A RideCheck report is <strong>not a substitute</strong> for a comprehensive inspection by
              a licensed automotive repair facility, ASE-certified mechanic, manufacturer-authorized
              dealership, or a state-licensed vehicle inspection station. Buyers with material concerns
              about a vehicle&apos;s condition are encouraged to seek additional professional evaluation
              prior to purchase.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. No Warranty or Guarantee</h2>
            <p className="text-muted-foreground">
              A RideCheck inspection report <strong>does not constitute, and shall not be construed as,
              a warranty, guarantee, certification, or representation</strong> of:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5 mt-2">
              <li>The vehicle&apos;s mechanical soundness, fitness for a particular purpose, or merchantability</li>
              <li>The vehicle&apos;s freedom from defects, whether latent or patent</li>
              <li>The vehicle&apos;s future performance, reliability, or safety</li>
              <li>The vehicle&apos;s compliance with any safety or emissions standard</li>
              <li>The accuracy or completeness of the seller&apos;s representations</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              Any implied warranty or guarantee is hereby expressly disclaimed to the maximum extent
              permitted by applicable Illinois law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the fullest extent permitted by law, RideCheck&apos;s total liability for any claim
              arising from or related to an inspection shall not exceed the amount paid by the customer
              for that specific inspection service. RideCheck shall not be liable for any indirect,
              consequential, incidental, punitive, or special damages, including but not limited to:
              post-purchase repair costs, diminished value, towing, lost opportunity, travel expenses,
              or any financial loss resulting from reliance on a RideCheck report.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Buyer&apos;s Responsibility</h2>
            <p className="text-muted-foreground">
              The buyer remains <strong>solely responsible</strong> for the vehicle purchase decision.
              A RideCheck report is intended as one input among several that a prudent buyer should
              consider. Buyers should not rely solely on a RideCheck inspection when making a vehicle
              purchase decision, particularly for high-value, salvage-titled, high-mileage, or
              significantly modified vehicles.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Governing Law</h2>
            <p className="text-muted-foreground">
              This disclaimer is governed by the laws of the State of Illinois. Any dispute related
              to a RideCheck inspection shall be resolved exclusively in Lake County, Illinois.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
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
