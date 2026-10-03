"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clipboard, ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FACEBOOK_CONTACT_EXPLANATION,
  FACEBOOK_SELLER_MESSAGE,
  isFacebookMarketplaceListing,
  type FacebookContactEvent,
  type FacebookContactState,
} from "@/lib/seller-contact/facebook-marketplace";

type Props = {
  listingUrl: string;
  storageKey: string;
  contact: FacebookContactState;
  auditWarning: string;
  failedAudit: { events: FacebookContactEvent[]; onceKey?: string } | null;
  onAudit: (events: FacebookContactEvent[], onceKey?: string) => Promise<boolean>;
  onContactChange: (contact: FacebookContactState) => void;
  onListingUrlChange: (url: string) => void;
};

const INITIAL_EVENTS: FacebookContactEvent[] = [
  "facebook_marketplace_detected",
  "facebook_concierge_initial_contact_unavailable",
  "seller_message_displayed",
];

function safeMarketplaceUrl(value: string) {
  const candidate = value.trim();
  return candidate && isFacebookMarketplaceListing(candidate, null) ? candidate : "";
}

export function FacebookSellerContact({ listingUrl, storageKey, contact, auditWarning, failedAudit, onAudit, onContactChange, onListingUrlChange }: Props) {
    const [linkDraft, setLinkDraft] = useState("");
    const [copiedError, setCopiedError] = useState(false);
    const initialAttempted = useRef<string | null>(null);
    const auditRef = useRef(onAudit);
    auditRef.current = onAudit;
    const link = safeMarketplaceUrl(listingUrl) || safeMarketplaceUrl(linkDraft);

    useEffect(() => {
      let alreadyRecorded = false;
      try {
        alreadyRecorded = sessionStorage.getItem(`${storageKey}:initial-audit`) === "done";
      } catch {
        // Audit submission still works when storage access is restricted.
      }
      if (initialAttempted.current === storageKey || alreadyRecorded) return;
      initialAttempted.current = storageKey;
      void auditRef.current(INITIAL_EVENTS, "initial");
    // Each source/listing gets one batched initial event request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey]);

    const copyMessage = async () => {
      setCopiedError(false);
      try {
        await navigator.clipboard.writeText(FACEBOOK_SELLER_MESSAGE);
        onContactChange({ ...contact, seller_message_copied: true });
        void auditRef.current(["seller_message_copied"]);
      } catch {
        setCopiedError(true);
      }
    };

    const reportAgreement = () => {
      if (contact.seller_consent_reported) return;
      onContactChange({
        ...contact,
        seller_consent_reported: true,
        seller_consent_reported_at: new Date().toISOString(),
      });
      void auditRef.current(["seller_consent_reported"]);
    };

    const openListing = () => {
      if (!link) return;
      onContactChange({ ...contact, facebook_listing_opened: true });
      void auditRef.current(["facebook_listing_opened"]);
    };

    const retryAudit = () => {
      if (failedAudit) void auditRef.current(failedAudit.events, failedAudit.onceKey);
    };

    return (
      <section className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50/70 shadow-sm dark:border-blue-900 dark:bg-blue-950/20" aria-labelledby="facebook-contact-title">
        <div className="border-b border-blue-200/80 px-5 py-4 dark:border-blue-900">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-blue-100 p-2 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-800 dark:text-blue-200">Facebook Marketplace</p>
              <h2 id="facebook-contact-title" className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Start the seller conversation</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{FACEBOOK_CONTACT_EXPLANATION}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-lg border border-blue-100 bg-white/80 p-4 dark:border-blue-900 dark:bg-slate-950/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Message to send in Messenger</p>
            <p className="text-sm leading-relaxed text-slate-800 dark:text-slate-200">&ldquo;{FACEBOOK_SELLER_MESSAGE}&rdquo;</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={copyMessage} className="sm:flex-1" data-testid="button-copy-seller-message">
              {contact.seller_message_copied ? <Check className="mr-2 h-4 w-4" /> : <Clipboard className="mr-2 h-4 w-4" />}
              {contact.seller_message_copied ? "Seller Message Copied" : "Copy Seller Message"}
            </Button>
            {link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openListing}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground sm:flex-1"
                data-testid="link-open-facebook-listing"
              >
                <ExternalLink className="mr-2 h-4 w-4" /> Open Facebook Listing
              </a>
            ) : (
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="facebook-listing-link" className="text-xs text-muted-foreground">Optional Facebook Marketplace listing link</Label>
                <div className="flex gap-2">
                  <Input
                    id="facebook-listing-link"
                    type="url"
                    value={linkDraft}
                    onChange={(event) => {
                      const value = event.target.value;
                      setLinkDraft(value);
                      if (safeMarketplaceUrl(value)) onListingUrlChange(value.trim());
                    }}
                    placeholder="https://www.facebook.com/marketplace/…"
                    aria-describedby="facebook-listing-link-help"
                    data-testid="input-facebook-listing-link"
                  />
                  <span className="sr-only" id="facebook-listing-link-help">Paste a valid Facebook Marketplace listing URL to enable opening it.</span>
                </div>
                {linkDraft && !safeMarketplaceUrl(linkDraft) && (
                  <p className="text-xs text-amber-700 dark:text-amber-300" role="status">Enter a valid Facebook Marketplace listing URL. You can continue without one.</p>
                )}
              </div>
            )}
          </div>

          {contact.seller_message_copied && (
            <p className="rounded-md bg-blue-100/70 px-3 py-2 text-sm leading-relaxed text-blue-950 dark:bg-blue-900/40 dark:text-blue-100" role="status">
              Send this message to the seller through Facebook Messenger. Once the seller agrees, return here to continue.
            </p>
          )}

          {contact.seller_consent_reported && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" role="status">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Your report is saved for this booking. It is not an independent confirmation of the seller, appointment, date, time, or location.</span>
            </div>
          )}

          {auditWarning && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
              <p>{auditWarning}</p>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={retryAudit} disabled={!failedAudit}>Retry activity record</Button>
            </div>
          )}
          {copiedError && <p className="text-sm text-amber-800 dark:text-amber-300" role="alert">We couldn’t copy the message. Select and copy it from the message above instead.</p>}

          <div className="border-t border-blue-200/80 pt-4 dark:border-blue-900">
            <p className="mb-3 text-sm text-slate-700 dark:text-slate-300">After the seller agrees, report it here. You can continue even if they have not shared contact or scheduling details yet.</p>
            <Button type="button" variant={contact.seller_consent_reported ? "outline" : "default"} onClick={reportAgreement} disabled={contact.seller_consent_reported} data-testid="button-seller-agreed">
              {contact.seller_consent_reported && <Check className="mr-2 h-4 w-4" />}
              {contact.seller_consent_reported ? "Seller Agreement Reported" : "Seller Agreed — Continue"}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              {link ? "Opening Facebook does not send a message for you." : "No listing link? You can still report the seller’s agreement and continue."}
            </p>
          </div>
        </div>
      </section>
    );
}