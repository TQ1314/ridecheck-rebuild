import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Car,
  Gauge,
  Eye,
  Wrench,
  Disc,
  MonitorSmartphone,
} from "lucide-react";

export const metadata: Metadata = {
  title: "What We Check — RideCheck",
  description:
    "See what a RideCheck inspector evaluates during an on-site vehicle inspection. Exterior, interior, mechanical, tires, diagnostics, and more.",
};

export default function WhatWeCheckPage() {
  return (
    <main className="bg-white text-gray-900">
      <section className="mx-auto max-w-4xl px-4 py-12 md:py-16">
        <h1 className="text-3xl font-extrabold md:text-4xl">What Gets Checked</h1>
        <p className="mt-3 max-w-2xl text-gray-600">
          Every RideCheck inspection follows a structured process. Here's what our
          inspector evaluates when they visit the vehicle.
        </p>

        <div className="mt-10 space-y-8">
          <CheckSection
            icon={<Car className="h-6 w-6 text-emerald-600" />}
            title="Exterior Condition"
            items={[
              "Body panels — dents, dings, rust, repaint indicators",
              "Glass — chips, cracks, seal condition",
              "Lights and lenses — headlights, taillights, signals",
              "Trim, moldings, and weather stripping",
              "Frame and undercarriage visual check (where accessible)",
            ]}
          />
          <CheckSection
            icon={<Eye className="h-6 w-6 text-emerald-600" />}
            title="Interior Condition"
            items={[
              "Seats — wear, tears, stains, adjustments",
              "Dashboard — warning lights, gauges, controls",
              "Steering wheel, pedals, and shift mechanism",
              "Air conditioning and heating function",
              "Odors — smoke, mildew, flood indicators",
              "Windows, mirrors, and locks operation",
            ]}
          />
          <CheckSection
            icon={<Wrench className="h-6 w-6 text-emerald-600" />}
            title="Under the Hood"
            items={[
              "Engine bay visual inspection",
              "Fluid levels and condition — oil, coolant, transmission, brake",
              "Belts and hoses — cracking, wear, leaks",
              "Battery condition and terminals",
              "Visible leak indicators",
            ]}
          />
          <CheckSection
            icon={<Disc className="h-6 w-6 text-emerald-600" />}
            title="Tires & Brakes"
            items={[
              "Tread depth measurement on all four tires",
              "Tire age and condition — cracking, uneven wear",
              "Spare tire presence and condition",
              "Brake pad thickness assessment (when visible)",
              "Rotor condition observation",
            ]}
          />
          <CheckSection
            icon={<MonitorSmartphone className="h-6 w-6 text-emerald-600" />}
            title="Diagnostic Scan"
            items={[
              "OBD-II code scan (when port is accessible)",
              "Active and pending trouble codes",
              "Check engine light status",
              "Emissions readiness indicators",
            ]}
          />
          <CheckSection
            icon={<Gauge className="h-6 w-6 text-emerald-600" />}
            title="Operational Observations"
            items={[
              "Cold start behavior",
              "Idle quality and engine sounds",
              "Warning lights on startup",
              "Unusual sounds, vibrations, or smells",
              "Steering and suspension feel (when test conditions allow)",
            ]}
          />
        </div>

        <div className="mt-12 rounded-2xl border bg-gray-50 p-6">
          <p className="text-sm text-gray-600">
            <strong>Note:</strong> RideCheck is an on-site inspection, not a full
            mechanical teardown. Some conditions may require a repair shop diagnostic
            for complete evaluation. Our goal is to give you the information you need
            to make a smart buying decision.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/book"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Book an Inspection →
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-semibold hover:bg-gray-50"
          >
            View Pricing
          </Link>
        </div>
      </section>
    </main>
  );
}

function CheckSection(props: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        {props.icon}
        <h2 className="text-lg font-bold">{props.title}</h2>
      </div>
      <ul className="mt-3 space-y-2 pl-9">
        {props.items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
