"use client";

import { useState } from "react";
import { Link2, User, Phone, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type FormState = "idle" | "loading" | "success" | "error";

export function BlogLeadCapture() {
  const [listingUrl, setListingUrl] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingUrl.trim()) return;

    setFormState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/blog/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingUrl: listingUrl.trim(),
          name: name.trim() || undefined,
          contact: contact.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Submission failed");
      }

      setFormState("success");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setFormState("error");
    }
  };

  if (formState === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 mb-3" />
        <p className="font-bold text-gray-900 mb-1">We got it — thank you!</p>
        <p className="text-sm text-gray-600">
          A RideCheck team member will follow up with you shortly about scheduling
          your pre-purchase inspection.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-emerald-600 rounded-t-2xl px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-100 mb-0.5">
          Lake County Pre-Purchase Check
        </p>
        <p className="text-lg font-extrabold text-white leading-snug">
          Found a car in Lake County? Start your RideCheck.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4" data-testid="form-blog-lead">
        <div>
          <label
            htmlFor="blog-listing-url"
            className="block text-xs font-semibold text-gray-700 mb-1"
          >
            Marketplace or dealer listing URL
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="blog-listing-url"
              type="url"
              required
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              placeholder="https://www.facebook.com/marketplace/item/..."
              className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 placeholder:text-gray-400"
              data-testid="input-listing-url"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="blog-lead-name"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Your name
              <span className="ml-1 text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="blog-lead-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First name"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 placeholder:text-gray-400"
                data-testid="input-lead-name"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="blog-lead-contact"
              className="block text-xs font-semibold text-gray-700 mb-1"
            >
              Email or phone
              <span className="ml-1 text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="blog-lead-contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="email or phone"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 placeholder:text-gray-400"
                data-testid="input-lead-contact"
              />
            </div>
          </div>
        </div>

        {formState === "error" && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          disabled={formState === "loading" || !listingUrl.trim()}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          data-testid="button-submit-lead"
        >
          {formState === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            "Send My Listing →"
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          No commitment. A team member will reach out to confirm availability.
        </p>
      </form>
    </div>
  );
}
