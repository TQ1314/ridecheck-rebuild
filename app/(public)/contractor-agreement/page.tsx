import { Logo } from "@/components/layout/Logo";
import { EFFECTIVE_DATE } from "@/lib/legal/constants";

export const metadata = {
  title: "Contractor Agreement | RideCheck",
  description:
    "RideCheck Independent Contractor Agreement for RideChecker field inspectors.",
};

export default function ContractorAgreementPage() {
  return (
    <div className="py-12 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={36} />
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-contractor-agreement">
              Independent Contractor Agreement
            </h1>
            <p className="text-sm text-muted-foreground">
              Effective Date: {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This agreement applies to individuals operating as RideChecker field inspectors.
          By accepting an invite to join the RideCheck team, completing the onboarding process,
          or accepting a job assignment, you agree to the terms below.
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Independent Contractor Status</h2>
            <p className="text-muted-foreground mb-2">
              You are engaged by RideCheck as an <strong>independent contractor</strong>, not as an
              employee, agent, partner, or joint venturer. This Agreement does not create an
              employment relationship between you and RideCheck.
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>You retain the right to control your own methods, timing, and manner of performing inspections, subject to RideCheck&apos;s quality standards and reporting procedures.</li>
              <li>You are free to perform services for other parties, provided doing so does not create a conflict of interest or breach of confidentiality obligations herein.</li>
              <li>RideCheck has no authority to and will not direct, supervise, or control the specific manner in which you perform inspection work beyond providing required reporting formats and quality standards.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. No Employment Relationship or Benefits</h2>
            <p className="text-muted-foreground mb-2">
              Because you are an independent contractor:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>RideCheck is not your employer and you are not entitled to employment benefits, including health insurance, workers&apos; compensation, unemployment insurance, paid leave, or retirement benefits.</li>
              <li>RideCheck will not withhold income taxes, Social Security, Medicare, or any other payroll taxes on your behalf. You are solely responsible for reporting and paying all applicable federal, state, and local taxes on compensation received.</li>
              <li>You are responsible for obtaining your own liability insurance, errors and omissions insurance, and any other coverage appropriate to your work.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Tools, Equipment, and Expenses</h2>
            <p className="text-muted-foreground">
              You are responsible for providing your own vehicle, tools, OBD scanning equipment,
              mobile device, and any other equipment required to perform inspections. RideCheck
              does not reimburse general business expenses, mileage, fuel, equipment, or personal
              expenses unless separately agreed in writing for a specific assignment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Inspection Standards and Procedures</h2>
            <p className="text-muted-foreground mb-2">
              You agree to comply with RideCheck&apos;s inspection standards, reporting formats, and
              quality procedures as updated from time to time. This includes:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Completing all assigned inspection steps and documenting findings accurately and thoroughly</li>
              <li>Submitting reports, photos, and supporting data through RideCheck&apos;s designated platform within required timeframes</li>
              <li>Maintaining professional and respectful conduct with vehicle sellers and all parties</li>
              <li>Accurately reporting all findings, including unfavorable ones, without omission or embellishment</li>
              <li>Disclosing any conflict of interest, personal relationship, or financial interest in the vehicle or sale</li>
              <li>Completing only the inspections for which you are trained and qualified</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Authorized Representations Only</h2>
            <p className="text-muted-foreground">
              You agree that you will <strong>not make any promises, warranties, guarantees, or
              representations</strong> to any customer, seller, or third party beyond the scope of
              your inspection findings and RideCheck&apos;s approved report language. You may not:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5 mt-2">
              <li>Represent that a vehicle is defect-free, certified, or safe to purchase</li>
              <li>Provide legal, financial, mechanical repair, or insurance advice</li>
              <li>Negotiate on behalf of a buyer or make purchase recommendations beyond approved report language</li>
              <li>Represent yourself as an employee, officer, or agent of RideCheck beyond the scope of contracted inspection services</li>
              <li>Use RideCheck&apos;s name, logo, or brand in any marketing, social media, or communications without prior written approval</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Confidentiality and Data Protection</h2>
            <p className="text-muted-foreground mb-2">
              You agree to maintain strict confidentiality of all information obtained through your
              work with RideCheck, including but not limited to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1.5">
              <li>Customer names, contact information, vehicle details, and order information</li>
              <li>Seller contact details, pricing, and listing information</li>
              <li>RideCheck&apos;s proprietary inspection methodology, scoring criteria, and technology platforms</li>
              <li>Any business, operational, or financial information disclosed in the course of your engagement</li>
            </ul>
            <p className="text-muted-foreground mt-3">
              You may not share, sell, reproduce, or use any such information for any purpose other
              than completing assigned inspections. This confidentiality obligation survives
              termination of this Agreement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Indemnification</h2>
            <p className="text-muted-foreground">
              You agree to indemnify, defend, and hold harmless RideCheck, its officers, affiliates,
              and agents from any and all claims, liabilities, damages, losses, costs, and expenses
              (including attorneys&apos; fees) arising from or related to: (a) your negligence, gross
              negligence, or willful misconduct in the performance of inspection services; (b) any
              unauthorized representation, warranty, or promise made to a customer or seller; (c) any
              violation of this Agreement; (d) your violation of any applicable law, regulation, or
              licensing requirement; or (e) any data breach or unauthorized disclosure of confidential
              information caused by your actions or omissions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Compensation</h2>
            <p className="text-muted-foreground">
              Compensation for completed and accepted inspection reports will be communicated through
              RideCheck&apos;s platform at the time of job assignment. RideCheck reserves the right to
              withhold or reduce compensation for reports that are incomplete, inaccurate, late, or
              otherwise fail to meet quality standards, as determined in RideCheck&apos;s reasonable
              discretion. Compensation terms may be updated from time to time with reasonable notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
            <p className="text-muted-foreground">
              Either party may terminate this Agreement at any time, with or without cause, upon
              written or platform-based notice. RideCheck reserves the right to immediately suspend
              or terminate your access to the platform and assignment pipeline if you violate any
              provision of this Agreement, engage in fraudulent or dishonest conduct, or otherwise
              act in a manner inconsistent with RideCheck&apos;s standards. Termination does not relieve
              you of obligations accrued prior to termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Governing Law and Venue</h2>
            <p className="text-muted-foreground">
              This Agreement is governed by the laws of the State of Illinois, without regard to
              conflict-of-law principles. Any dispute arising under this Agreement shall be resolved
              exclusively in Lake County, Illinois.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contact</h2>
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
