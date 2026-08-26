import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { UpgradeButton } from "@/components/BillingButtons";
import { getCurrentUser } from "@/lib/auth";
import { PLANS, VAT_NOTE, VAT_SHORT, type Plan } from "@/lib/plans";

export const metadata: Metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

function PlanFeatures({ plan }: { plan: Plan }) {
  const items = [
    `${plan.monthlyRenders.toLocaleString()} renders / month`,
    plan.watermark ? "OGsmith watermark" : "No watermark",
    "All templates & themes",
    ...(plan.watermark ? [] : ["Custom logo on cards"]),
    "CDN-cached responses",
    "Quota alert emails",
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
                <p className="mb-3 w-fit rounded-full bg-indigo-500 px-3 py-0.5 text-xs font-medium text-white">
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
                        ? "bg-indigo-600 text-white hover:bg-indigo-500"
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
