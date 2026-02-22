"use client";

import * as React from "react";

const faqs = [
  { q: "What is RideCheck?", a: "RideCheck is an independent..." },
  // (same list as above)
];

export default function FaqAccordionSimple() {
  const [openIndex, setOpenIndex] = React.useState<number | null>(0);

  return (
    <section className="w-full max-w-3xl mx-auto px-4 py-10">
      <h2 className="text-3xl font-semibold tracking-tight">RideCheck FAQ</h2>
      <p className="mt-3 text-gray-600">Click a question to view the answer.</p>

      <div className="mt-8 space-y-3">
        {faqs.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div key={idx} className="border rounded-xl">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-4 text-left font-medium"
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                aria-expanded={isOpen}
              >
                <span>{item.q}</span>
                <span className="text-xl leading-none">{isOpen ? "−" : "+"}</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 text-sm leading-relaxed whitespace-pre-line text-gray-700">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}