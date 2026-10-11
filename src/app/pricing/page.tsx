import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { UpgradeButton } from "@/components/BillingButtons";
import { getCurrentUser } from "@/lib/auth";
import {
  AGENCY_PREVIEW,
  PLANS,
  VAT_NOTE,
  VAT_SHORT,
  type Plan,
} from "@/lib/plans";
import { contactEmail } from "@/lib/stripe";

import { TRIAL_DAYS } from "@/lib/trial";

export const metadata: Metadata = {
  title: "Pricing",
  description: `OGsmith pricing: start free with ${TRIAL_DAYS} days without a watermark, then Pro at $${PLANS.pro.priceMonthlyUsd}/month for ${PLANS.pro.monthlyRenders.toLocaleString()} renders. Flat monthly quotas, no overage charges.`,
  alternates: { canonical: "/pricing" },
};
export const dynamic = "force-dynamic";

/** The few lines that actually tell the plans apart. The rest is in the table. */
function PlanFeatures({ plan }: { plan: Plan }) {
  const items = [
    `${plan.monthlyRenders.toLocaleString()} renders / month`,
    plan.watermark ? `No watermark for ${TRIAL_DAYS} days, then a small one` : "No watermark, your logo on cards",
    `${plan.templates} custom ${plan.templates === 1 ? "design" : "designs"} in the editor`,
    `${plan.experiments} split ${plan.experiments === 1 ? "test" : "tests"} at once`,
    plan.id === "scale" ? "Priority support" : "Email support",
  ];
  return (
    <ul className="mt-6 flex flex-col gap-2 text-sm text-zinc-400">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-0.5 text-indigo-400">✓</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

type Cell = string | boolean;

/** Every plan limit side by side, so the cards above can stay short. */
const COMPARE_ROWS: Array<{ label: string; value: (p: Plan) => Cell }> = [
  { label: "Renders per month", value: (p) => p.monthlyRenders.toLocaleString() },
  { label: "Watermark", value: (p) => (p.watermark ? `After ${TRIAL_DAYS}-day trial` : "None") },
  { label: "Custom logo on cards", value: (p) => !p.watermark },
  { label: "Custom designs (editor)", value: (p) => String(p.templates) },
  { label: "Uploaded fonts & images", value: (p) => String(p.assets) },
  { label: "Split tests at once", value: (p) => String(p.experiments) },
  { label: "Cards per batch", value: (p) => p.batchRows.toLocaleString() },
  { label: "Webhook endpoints", value: (p) => String(p.webhooks) },
  { label: "All templates & themes", value: () => true },
  { label: "Cards straight from a URL", value: () => true },
  { label: "Cache refresh for shared links", value: () => true },
  { label: "CDN-cached responses", value: () => true },
  { label: "Quota alert emails", value: () => true },
  { label: "Support", value: (p) => (p.id === "scale" ? "Priority" : "Email") },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true) {
    return (
      <span className="text-indigo-400">
        ✓<span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="text-zinc-600">
        —<span className="sr-only">Not included</span>
      </span>
    );
  }
  return <>{value}</>;
}

function CompareTable() {
  const plans = Object.values(PLANS);
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-bold">Compare plans</h2>
      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-zinc-900 text-zinc-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Feature</span>
              </th>
              {plans.map((p) => (
                <th
                  key={p.id}
                  scope="col"
                  className={`px-4 py-3 font-medium ${p.id === "pro" ? "text-indigo-300" : ""}`}
                >
                  {p.name} · ${p.priceMonthlyUsd}/mo
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {COMPARE_ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-4 py-3 font-medium text-zinc-300">
                  {row.label}
                </th>
                {plans.map((p) => (
                  <td key={p.id} className="px-4 py-3 tabular-nums text-zinc-200">
                    <CellValue value={row.value(p)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Advertised, not purchasable. It is visually quieter than the real plans
 * and has no price button, because a card someone can't buy sitting in a
 * row of ones they can is a small trap.
 */
function AgencyPreview() {
  const email = contactEmail();
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/30 p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">{AGENCY_PREVIEW.name}</h2>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-0.5 text-xs font-medium text-amber-300">
              Coming soon
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {AGENCY_PREVIEW.description}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-zinc-300">
            ${AGENCY_PREVIEW.priceMonthlyUsd}
            <span className="text-base font-normal text-zinc-500">/mo</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">{VAT_SHORT}</p>
        </div>
      </div>

      <ul className="mt-6 grid gap-2 text-sm text-zinc-400 sm:grid-cols-2">
        {AGENCY_PREVIEW.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-0.5 text-zinc-600">+</span>
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {email ? (
          <a
            href={`mailto:${email}?subject=${encodeURIComponent("Agency plan — put me on the list")}`}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-medium hover:border-zinc-500"
          >
            Tell us you want it
          </a>
        ) : null}
        <p className="text-sm text-zinc-500">
          Multi-brand workspaces are next on the roadmap. Scale covers
          everything else in the meantime.
        </p>
      </div>
    </div>
  );
}

export default async function PricingPage() {
  const user = await getCurrentUser().catch(() => null);
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-center text-4xl font-bold">Pricing</h1>
        <p className="mt-3 text-center text-zinc-400">
          Every plan is a flat monthly price with a generous render quota.
        </p>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {Object.values(PLANS).map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl border p-8 ${
                plan.id === "pro"
                  ? "border-indigo-500 bg-indigo-500/5"
                  : "border-zinc-800 bg-zinc-900/50"
              }`}
            >
              {plan.id === "pro" ? (
                <p className="mb-3 w-fit rounded-full bg-indigo-500 px-3 py-0.5 text-xs font-medium text-zinc-950">
                  Most popular
                </p>
              ) : null}
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-1 text-sm text-zinc-500">{plan.description}</p>
              <p className="mt-4 text-4xl font-bold">
                ${plan.priceMonthlyUsd}
                <span className="text-base font-normal text-zinc-500">/mo</span>
              </p>
              {plan.priceMonthlyUsd > 0 ? (
                <p className="mt-1 text-xs text-zinc-500">{VAT_SHORT}</p>
              ) : null}
              <PlanFeatures plan={plan} />
              <div className="mt-8">
                {plan.id === "free" ? (
                  <Link
                    href={user ? "/dashboard" : "/signup"}
                    className="block rounded-lg border border-zinc-700 px-4 py-2.5 text-center text-sm font-medium hover:border-zinc-500"
                  >
                    {user ? "Go to dashboard" : "Start for free"}
                  </Link>
                ) : user ? (
                  <UpgradeButton
                    plan={plan.id}
                    label={`Upgrade to ${plan.name}`}
                    primary={plan.id === "pro"}
                  />
                ) : (
                  <Link
                    href="/signup"
                    className={`block rounded-lg px-4 py-2.5 text-center text-sm font-medium ${
                      plan.id === "pro"
                        ? "bg-indigo-600 text-zinc-950 hover:bg-indigo-500"
                        : "border border-zinc-700 hover:border-zinc-500"
                    }`}
                  >
                    Sign up to upgrade
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <CompareTable />

        <AgencyPreview />

        <p className="mt-10 text-center text-sm text-zinc-500">
          Renders that hit the CDN cache don&apos;t count against your quota.
          Need more than 150k renders? <span className="text-zinc-300">Get in touch.</span>
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-zinc-500">
          {VAT_NOTE}
        </p>
      </main>
      <Footer />
    </>
  );
}
