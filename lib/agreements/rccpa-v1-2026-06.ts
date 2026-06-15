/**
 * lib/agreements/rccpa-v1-2026-06.ts
 *
 * RideCheck Independent Contractor Compensation & Performance Agreement
 * Version: RCCPA_v1_2026_06
 *
 * This file is the authoritative source for:
 *   - The current agreement version identifier
 *   - The agreement title
 *   - The full agreement text (stored as a snapshot on signing)
 *   - Version helpers used by sign/gate logic
 */

export const CURRENT_AGREEMENT_VERSION = "RCCPA_v1_2026_06";

export const CURRENT_AGREEMENT_TITLE =
  "RideCheck Independent Contractor Compensation & Performance Agreement";

export function getCurrentRideCheckerAgreementVersion(): string {
  return CURRENT_AGREEMENT_VERSION;
}

export function hasSignedCurrentAgreement(profile: {
  agreement_status?: string | null;
  current_agreement_version?: string | null;
}): boolean {
  return (
    profile.agreement_status === "signed" &&
    profile.current_agreement_version === CURRENT_AGREEMENT_VERSION
  );
}

export function getAgreementStatusLabel(
  status: string | null | undefined,
  version: string | null | undefined
): "signed" | "outdated" | "not_signed" {
  if (status === "signed" && version === CURRENT_AGREEMENT_VERSION) return "signed";
  if (status === "signed" && version !== CURRENT_AGREEMENT_VERSION) return "outdated";
  return "not_signed";
}

export const AGREEMENT_TEXT = `RIDECHECK INDEPENDENT CONTRACTOR COMPENSATION & PERFORMANCE AGREEMENT
Version: RCCPA_v1_2026_06
Effective Date: June 2026

This Independent Contractor Compensation & Performance Agreement ("Agreement") is entered into between RideCheck ("Company") and the individual identified during the electronic signing process ("Inspector" or "Independent Contractor").

─────────────────────────────────────────────────────────────────────────────
1. INDEPENDENT CONTRACTOR RELATIONSHIP
─────────────────────────────────────────────────────────────────────────────

1.1 The Inspector acknowledges and agrees that they are retained by the Company as an independent contractor and not as an employee, agent, joint venturer, or partner of the Company. Nothing in this Agreement shall be interpreted or construed as creating or establishing an employment relationship between the Company and the Inspector.

1.2 The Inspector retains full control over the manner and means of performing the inspection services described herein, subject to the performance standards set forth in Section 4.

1.3 The Inspector is solely responsible for all federal, state, and local taxes, contributions, and assessments arising from compensation received under this Agreement, including self-employment taxes.

1.4 The Inspector is not entitled to and will not receive any employee benefits, including but not limited to health insurance, retirement benefits, paid leave, or workers' compensation coverage from the Company.

─────────────────────────────────────────────────────────────────────────────
2. SERVICES
─────────────────────────────────────────────────────────────────────────────

2.1 The Inspector agrees to perform pre-purchase vehicle inspection services ("Inspections") on behalf of buyers and as assigned by the Company through the RideCheck platform ("Platform").

2.2 Each Inspection includes a standardized visual and functional assessment of the assigned vehicle using the Company's proprietary inspection checklist, photographic documentation of required vehicle components, completion of the structured digital inspection report via the Platform, and timely submission of all inspection data.

2.3 The Inspector agrees to perform Inspections only for orders formally assigned through the Platform and accepted in accordance with the assignment acceptance workflow.

2.4 The Inspector will not perform Inspections or solicit business from buyers, sellers, or parties associated with RideCheck orders outside of the Platform.

─────────────────────────────────────────────────────────────────────────────
3. COMPENSATION
─────────────────────────────────────────────────────────────────────────────

3.1 Base Compensation. The Company will pay the Inspector the per-inspection rate established for each accepted job as displayed in the Platform at the time of assignment acceptance. Rates vary by vehicle package tier as determined by the Company.

3.2 Distance and Adjustment Bonuses. Additional compensation may be offered for same-day inspections, rush requests (less than four hours' notice), extended travel distance, and other factors at the Company's discretion, as communicated through the Platform's compensation panel at the time of offer.

3.3 Surge Bonuses. The Company may offer additional surge pay for high-demand periods. Surge pay, when offered, is displayed in the assignment offer.

3.4 Payment Timing. Compensation is paid after the completed inspection report is reviewed and approved by the Company's operations team. Payment is made via the Inspector's registered payment method on file. The Company targets payment processing within seven (7) business days of approval.

3.5 Compensation Disputes. Any dispute regarding compensation must be raised in writing within thirty (30) days of the payment date in question. The Company will review and respond within fourteen (14) business days.

3.6 Compensation Modification. The Company reserves the right to modify its standard compensation rates with thirty (30) days' advance notice to the Inspector. Modifications will be communicated through the Platform and may require execution of a new version of this Agreement.

─────────────────────────────────────────────────────────────────────────────
4. PERFORMANCE STANDARDS
─────────────────────────────────────────────────────────────────────────────

4.1 The Inspector agrees to maintain the following performance standards:

  (a) Quality: Complete all required inspection checklist sections accurately and thoroughly. Submit clear, properly lit photographs for all required vehicle areas.

  (b) Timeliness: Accept or decline assignment offers within the acceptance window displayed in the Platform. Arrive at the inspection location at the scheduled time. Submit completed inspection reports within two (2) hours of completing the physical inspection.

  (c) Professionalism: Conduct all interactions with vehicle sellers, buyers, and third parties in a professional and courteous manner. Accurately represent the Company and refrain from providing personal opinions, repair estimates, or vehicle valuations to any party.

  (d) Accuracy: Report only observable conditions. Do not speculate, diagnose, or provide conclusions beyond the scope of the standardized inspection checklist. Do not misrepresent vehicle condition in either direction.

  (e) Availability: Update availability status promptly through the Platform when unavailable for assignments.

4.2 The Company reserves the right to review inspection quality scores, response rates, and acceptance rates. Persistent failure to meet performance standards may result in reduced assignment priority, temporary suspension, or termination of this Agreement.

─────────────────────────────────────────────────────────────────────────────
5. ASSIGNMENT ACCEPTANCE AND DECLINATION
─────────────────────────────────────────────────────────────────────────────

5.1 Assignment offers are time-limited. The Inspector must accept or decline within the window displayed in the Platform. Expired offers are treated as declined.

5.2 The Inspector may decline assignment offers for legitimate reasons including scheduling conflicts, distance, vehicle type, or other valid reasons as provided in the Platform's declination workflow.

5.3 Repeated declinations or failure to respond to offers may affect the Inspector's assignment priority and availability status as described in the Platform's performance policies.

─────────────────────────────────────────────────────────────────────────────
6. CONFIDENTIALITY AND NON-DISCLOSURE
─────────────────────────────────────────────────────────────────────────────

6.1 "Confidential Information" means all non-public information disclosed by the Company to the Inspector in connection with this Agreement, including but not limited to: inspection methodologies, scoring algorithms, software, customer and buyer data, order details, pricing structures, business strategies, and proprietary checklists.

6.2 The Inspector agrees to hold all Confidential Information in strict confidence, not to disclose it to any third party, and to use it solely for the purpose of performing services under this Agreement.

6.3 The Inspector will not discuss, share, post, or publish any buyer-submitted information, vehicle owner information, order details, or inspection findings with any party other than the Company.

6.4 This confidentiality obligation survives termination of this Agreement indefinitely.

─────────────────────────────────────────────────────────────────────────────
7. INTELLECTUAL PROPERTY
─────────────────────────────────────────────────────────────────────────────

7.1 All inspection data, photographs, reports, findings, and related work product created by the Inspector in the course of performing services under this Agreement are the sole and exclusive property of the Company.

7.2 The Inspector irrevocably assigns to the Company all right, title, and interest in and to such work product, including all intellectual property rights therein.

7.3 The Inspector agrees to execute any additional documents necessary to perfect the Company's ownership of such work product upon request.

─────────────────────────────────────────────────────────────────────────────
8. NON-SOLICITATION
─────────────────────────────────────────────────────────────────────────────

8.1 During the term of this Agreement and for twelve (12) months after termination, the Inspector agrees not to directly or indirectly solicit, contact, or offer competing vehicle inspection services to any buyer, seller, or customer introduced through the RideCheck Platform.

8.2 This section does not restrict the Inspector from performing vehicle inspections for clients obtained independently and without any connection to the Company or its customers.

─────────────────────────────────────────────────────────────────────────────
9. LIMITATION OF LIABILITY
─────────────────────────────────────────────────────────────────────────────

9.1 The Company's maximum aggregate liability to the Inspector under this Agreement shall not exceed the total compensation paid to the Inspector in the three (3) months immediately preceding the claim.

9.2 In no event shall either party be liable for indirect, incidental, consequential, special, or punitive damages, regardless of the theory of liability.

─────────────────────────────────────────────────────────────────────────────
10. INDEMNIFICATION
─────────────────────────────────────────────────────────────────────────────

10.1 The Inspector agrees to indemnify, defend, and hold harmless the Company and its officers, directors, employees, and agents from and against any claims, liabilities, damages, costs, and expenses (including reasonable attorneys' fees) arising from: (a) the Inspector's performance of or failure to perform services under this Agreement; (b) any breach by the Inspector of any representation, warranty, or obligation under this Agreement; or (c) any negligent or wrongful act or omission of the Inspector.

─────────────────────────────────────────────────────────────────────────────
11. TERM AND TERMINATION
─────────────────────────────────────────────────────────────────────────────

11.1 This Agreement commences on the date of electronic acceptance and continues until terminated by either party.

11.2 Either party may terminate this Agreement at any time with or without cause by providing written notice (including email) to the other party.

11.3 Upon termination, the Inspector must immediately cease performing services on the Platform, return or destroy any Confidential Information, and complete any inspections already accepted and in progress unless mutually agreed otherwise.

11.4 Compensation for completed and approved work performed prior to termination will be paid in accordance with Section 3.

─────────────────────────────────────────────────────────────────────────────
12. REPRESENTATIONS AND WARRANTIES
─────────────────────────────────────────────────────────────────────────────

12.1 The Inspector represents and warrants that: (a) they are at least 18 years of age and legally authorized to work in the United States; (b) they have the skills, knowledge, and experience necessary to perform vehicle inspections competently; (c) the execution and performance of this Agreement do not conflict with any other agreement or obligation binding on the Inspector; and (d) all information provided to the Company in connection with the Inspector's application and profile is accurate and complete.

─────────────────────────────────────────────────────────────────────────────
13. GOVERNING LAW AND DISPUTE RESOLUTION
─────────────────────────────────────────────────────────────────────────────

13.1 This Agreement shall be governed by and construed in accordance with the laws of the United States applicable to contracts entered into and fully performed therein.

13.2 Any dispute arising out of or relating to this Agreement shall first be subject to good-faith negotiation between the parties. If negotiation fails, disputes shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.

─────────────────────────────────────────────────────────────────────────────
14. ENTIRE AGREEMENT; AMENDMENTS
─────────────────────────────────────────────────────────────────────────────

14.1 This Agreement constitutes the entire agreement between the parties with respect to its subject matter and supersedes all prior agreements, representations, and understandings.

14.2 The Company may update this Agreement from time to time. Continued use of the Platform after notice of a new agreement version constitutes acceptance of the updated terms.

14.3 No amendment or modification of this Agreement is effective unless accepted electronically through the Platform's agreement acceptance workflow.

─────────────────────────────────────────────────────────────────────────────
15. ELECTRONIC SIGNATURE
─────────────────────────────────────────────────────────────────────────────

15.1 The Inspector agrees that submitting their legal name and checking the acceptance checkbox in the Platform's agreement acceptance workflow constitutes a legally binding electronic signature under the Electronic Signatures in Global and National Commerce Act (E-SIGN Act) and applicable state law.

15.2 A record of this acceptance, including the signed name, timestamp, IP address, user agent, and a snapshot of the agreement text, is retained by the Company.

─────────────────────────────────────────────────────────────────────────────

BY ELECTRONICALLY SIGNING THIS AGREEMENT, YOU CONFIRM THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY ALL TERMS AND CONDITIONS SET FORTH ABOVE.

Agreement Version: RCCPA_v1_2026_06
`;
