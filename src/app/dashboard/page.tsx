import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import KeysManager from "@/components/KeysManager";
import BrandPanel from "@/components/BrandPanel";
import SigningPanel from "@/components/SigningPanel";
import VerifyBanner from "@/components/VerifyBanner";
import {
  UpgradeButton,
  ManageBillingButton,
  LogoutButton,
} from "@/components/BillingButtons";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listActiveKeys } from "@/lib/keys";
import { getMonthlyUsage, getUserPlan, getUsageHistory } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { appUrl } from "@/lib/stripe";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const db = getDb();
  const [plan, used, keys, history] = await Promise.all([
    getUserPlan(db, user.id),
    getMonthlyUsage(db, user.id),
    listActiveKeys(db, user.id),
    getUsageHistory(db, user.id, 6),
  ]);
  const historyMax = Math.max(1, ...history.map((h) => h.count));
  const planInfo = PLANS[plan];
  const pct = Math.min(100, Math.round((used / planInfo.monthlyRenders) * 100));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>
          <LogoutButton />
        </div>

        <div className="grid gap-6">
          {!user.emailVerifiedAt ? <VerifyBanner /> : null}
          {/* Usage */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold">Usage this month</h2>
              <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-0.5 text-xs text-indigo-300">
                {planInfo.name} plan
              </span>
            </div>
            <p className="mb-3 text-3xl font-bold">
              {used.toLocaleString()}
              <span className="text-base font-normal text-zinc-500">
                {" "}
                / {planInfo.monthlyRenders.toLocaleString()} renders
              </span>
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full ${
                  pct >= 90 ? "bg-red-500" : "bg-indigo-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {planInfo.watermark ? (
              <p className="mt-3 text-xs text-zinc-500">
                Free-plan images include a small watermark. Upgrade to remove it.
              </p>
            ) : null}
          </div>

          {/* Usage history */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 font-semibold">Last 6 months</h2>
            <div className="flex h-32 items-end gap-3">
              {history.map((h) => (
                <div
                  key={h.month}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <span className="text-xs text-zinc-500">
                    {h.count.toLocaleString()}
                  </span>
                  <div
                    className="w-full rounded-t bg-indigo-500/70"
                    style={{
                      height: `${Math.max(3, (h.count / historyMax) * 80)}px`,
                    }}
                  />
                  <span className="text-xs text-zinc-500">
                    {h.month.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <KeysManager
            keys={keys.map((k) => ({
              id: k.id,
              name: k.name,
              keyPrefix: k.keyPrefix,
              createdAt: k.createdAt.toISOString(),
              lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
              rendersThisMonth: k.rendersThisMonth,
            }))}
          />

          <BrandPanel
            initial={{
              template: user.brandTemplate ?? "",
              theme: user.brandTheme ?? "",
              accent: user.brandAccent ?? "",
              site: user.brandSite ?? "",
            }}
            logo={user.brandLogo ?? null}
            paidPlan={plan !== "free"}
          />

          <SigningPanel accountId={user.id} />

          {/* Billing */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 font-semibold">Billing</h2>
            <div className="flex flex-wrap gap-3">
              {plan === "free" ? (
                <>
                  <UpgradeButton
                    plan="pro"
                    label={`Upgrade to Pro — $${PLANS.pro.priceMonthlyUsd}/mo`}
                    primary
                  />
                  <UpgradeButton
                    plan="scale"
                    label={`Upgrade to Scale — $${PLANS.scale.priceMonthlyUsd}/mo`}
                  />
                </>
              ) : (
                <>
                  {plan === "pro" ? (
                    <UpgradeButton
                      plan="scale"
                      label={`Switch to Scale — $${PLANS.scale.priceMonthlyUsd}/mo`}
                    />
                  ) : null}
                  <ManageBillingButton />
                </>
              )}
            </div>
          </div>

          {/* Quickstart */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-3 font-semibold">Quickstart</h2>
            <code className="block overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-emerald-400">
              &lt;meta property=&quot;og:image&quot;
              content=&quot;{`${appUrl()}`}/api/og?key=YOUR_KEY&amp;title=Hello&amp;template=gradient&quot;
              /&gt;
            </code>
            <p className="mt-3 text-sm text-zinc-500">
              Full parameter reference in the{" "}
              <a href="/docs" className="text-indigo-400 hover:underline">
                docs
              </a>
              .
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
