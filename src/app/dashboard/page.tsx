import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import KeysManager from "@/components/KeysManager";
import BrandPanel from "@/components/BrandPanel";
import SigningPanel from "@/components/SigningPanel";
import RefreshPanel from "@/components/RefreshPanel";
import UrlCardPanel from "@/components/UrlCardPanel";
import VerifyBanner from "@/components/VerifyBanner";
import ActivationChecklist from "@/components/onboarding/ActivationChecklist";
import DashboardNav, { type DashboardSection } from "@/components/DashboardNav";
import {
  UpgradeButton,
  ManageBillingButton,
  LogoutButton,
} from "@/components/BillingButtons";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listActiveKeys } from "@/lib/keys";
import { countTemplates } from "@/lib/templates";
import { countExperiments } from "@/lib/experiments";
import { getMonthlyUsage, getUserPlan, getUsageHistory } from "@/lib/usage";
import { PLANS, VAT_NOTE } from "@/lib/plans";
import { refreshStatus } from "@/lib/cachebust";
import { effectiveWatermark, trialActive, trialDaysLeft } from "@/lib/trial";
import { appUrl } from "@/lib/stripe";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const db = getDb();
  const [plan, used, keys, history, templateCount, experimentCount] = await Promise.all([
    getUserPlan(db, user.id),
    getMonthlyUsage(db, user.id),
    listActiveKeys(db, user.id),
    getUsageHistory(db, user.id, 6),
    countTemplates(db, user.id),
    countExperiments(db, user.id),
  ]);
  const historyMax = Math.max(1, ...history.map((h) => h.count));
  const planInfo = PLANS[plan];
  const refresh = refreshStatus(user);
  const inTrial = trialActive(user);
  const daysLeft = trialDaysLeft(user);
  const watermarked = effectiveWatermark(plan, user);
  const pct = Math.min(100, Math.round((used / planInfo.monthlyRenders) * 100));
  const keyHint = keys[0]?.keyPrefix ? `${keys[0].keyPrefix}…` : "YOUR_KEY";

  const anyHistory = history.some((h) => h.count > 0);
  const sections: DashboardSection[] = [
    { id: "overview", label: "Overview" },
    { id: "integrate", label: "Integrate" },
    { id: "brand", label: "Brand" },
    { id: "tools", label: "Tools" },
    { id: "billing", label: "Billing" },
    { id: "advanced", label: "Advanced" },
  ];
  const card = "rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-6";
  const linkButton =
    "inline-block rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500";

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-zinc-500">{user.email}</p>
          </div>
          <LogoutButton />
        </div>

        <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
          <aside className="lg:relative">
            <DashboardNav sections={sections} />
          </aside>

          <div className="mt-6 flex min-w-0 flex-col gap-12 lg:mt-0">
            <Section id="overview" title="Overview">
              {!user.emailVerifiedAt ? <VerifyBanner /> : null}

              {/* Gone for good once a card has been seen on a real page. */}
              {!user.liveAt ? (
                <ActivationChecklist
                  baseUrl={appUrl()}
                  keyHint={keyHint}
                  savedUrl={user.onboardingUrl}
                  rendered={Boolean(user.firstRenderAt)}
                />
              ) : null}

              <div className={card}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold">Usage this month</h3>
                  <a
                    href="#billing"
                    className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-0.5 text-xs text-indigo-300 hover:border-indigo-400"
                  >
                    {planInfo.name} plan
                  </a>
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
                    className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : "bg-indigo-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {inTrial ? (
                  <p className="mt-3 text-sm text-emerald-200">
                    Free trial: {daysLeft} {daysLeft === 1 ? "day" : "days"} left without a
                    watermark. Put real cards on your real site and see how they do before you
                    decide. When the trial ends, cards already shared keep the version platforms
                    have cached, and only new renders get the watermark.
                  </p>
                ) : watermarked ? (
                  <p className="mt-3 text-sm text-zinc-400">
                    Free-plan images include a small watermark. Upgrading removes it.
                  </p>
                ) : null}
                {plan === "free" ? (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <UpgradeButton
                      plan="pro"
                      label={`Upgrade to Pro, $${PLANS.pro.priceMonthlyUsd}/mo`}
                      primary
                    />
                    <a href="#billing" className="self-center text-sm text-zinc-400 hover:text-zinc-200">
                      Compare plans
                    </a>
                  </div>
                ) : null}

                {anyHistory ? (
                  <div className="mt-6 border-t border-zinc-800 pt-4">
                    <h4 className="mb-4 text-sm font-medium text-zinc-300">Last 6 months</h4>
                    <div className="flex h-32 items-end gap-3">
                      {history.map((h) => (
                        <div key={h.month} className="flex flex-1 flex-col items-center gap-2">
                          <span className="text-xs text-zinc-500">{h.count.toLocaleString()}</span>
                          <div
                            className="w-full rounded-t bg-indigo-500/70"
                            style={{ height: `${Math.max(3, (h.count / historyMax) * 80)}px` }}
                          />
                          <span className="text-xs text-zinc-500">{h.month.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>

            <Section id="integrate" title="Integrate">
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

              <div className={card}>
                <h3 className="mb-3 font-semibold">Quickstart</h3>
                <code className="block overflow-x-auto whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-emerald-400">
                  &lt;meta property=&quot;og:image&quot;
                  content=&quot;{`${appUrl()}`}/api/og?key=YOUR_KEY&amp;title=Hello&amp;template=gradient&amp;v={refresh.version}&quot;
                  /&gt;
                </code>
                <p className="mt-3 text-sm text-zinc-500">
                  Replace YOUR_KEY with one of your keys. Every parameter is in the{" "}
                  <Link href="/docs" className="text-indigo-400 hover:underline">
                    docs
                  </Link>
                  .
                </p>
              </div>

              <UrlCardPanel baseUrl={appUrl()} apiKeyHint={keyHint} />
            </Section>

            <Section id="brand" title="Brand">
              <BrandPanel
                // Remounts when the saved brand changes elsewhere, such as the
                // defaults read from the site during onboarding.
                key={`${user.brandSite}|${user.brandAccent}|${user.brandLogo?.length ?? 0}`}
                initial={{
                  template: user.brandTemplate ?? "",
                  theme: user.brandTheme ?? "",
                  accent: user.brandAccent ?? "",
                  site: user.brandSite ?? "",
                }}
                logo={user.brandLogo ?? null}
                paidPlan={plan !== "free"}
              />

              <div className={card}>
                <h3 className="mb-1 font-semibold">Templates</h3>
                <p className="mb-4 text-sm text-zinc-400">
                  Design your own card in the visual editor with your fonts, images and layout.
                  Then render it with{" "}
                  <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-emerald-400">
                    &amp;tpl=your-design
                  </code>{" "}
                  and fill it in from the URL.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/dashboard/templates" className={linkButton}>
                    {templateCount > 0 ? `Open templates (${templateCount})` : "Design a template"}
                  </Link>
                  <span className="text-xs text-zinc-500">
                    {templateCount} of {planInfo.templates} on the {planInfo.name} plan
                  </span>
                </div>
              </div>
            </Section>

            <Section id="tools" title="Tools">
              <div className="grid gap-6 md:grid-cols-2">
                <div className={card}>
                  <h3 className="mb-1 font-semibold">Experiments</h3>
                  <p className="mb-4 text-sm text-zinc-400">
                    Test one card design against another. Half your pages get A and half get B,
                    because a platform caches one image per link, so the split is across pages
                    rather than viewers.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link href="/dashboard/experiments" className={linkButton}>
                      {experimentCount > 0
                        ? `Open experiments (${experimentCount})`
                        : "Start an experiment"}
                    </Link>
                    <span className="text-xs text-zinc-500">
                      {experimentCount} of {planInfo.experiments} on the {planInfo.name} plan
                    </span>
                  </div>
                </div>

                <div className={card}>
                  <h3 className="mb-1 font-semibold">Batches &amp; webhooks</h3>
                  <p className="mb-4 text-sm text-zinc-400">
                    Render a whole back catalogue from a CSV and download the files. Webhooks send
                    a signed POST when a batch finishes or your usage crosses a threshold.
                  </p>
                  <Link href="/dashboard/batches" className={linkButton}>
                    Open batches
                  </Link>
                </div>
              </div>
            </Section>

            <Section id="billing" title="Billing">
              <div className={card}>
                <p className="mb-4 text-sm text-zinc-400">
                  You&apos;re on the {planInfo.name} plan:{" "}
                  {planInfo.monthlyRenders.toLocaleString()} renders a month.{" "}
                  <Link href="/pricing" className="text-indigo-400 hover:underline">
                    See all plans
                  </Link>
                  .
                </p>
                <div className="flex flex-wrap gap-3">
                  {plan === "free" ? (
                    <>
                      <UpgradeButton
                        plan="pro"
                        label={`Upgrade to Pro, $${PLANS.pro.priceMonthlyUsd}/mo`}
                        primary
                      />
                      <UpgradeButton
                        plan="scale"
                        label={`Upgrade to Scale, $${PLANS.scale.priceMonthlyUsd}/mo`}
                      />
                    </>
                  ) : (
                    <>
                      {plan === "pro" ? (
                        <UpgradeButton
                          plan="scale"
                          label={`Switch to Scale, $${PLANS.scale.priceMonthlyUsd}/mo`}
                        />
                      ) : null}
                      <ManageBillingButton />
                    </>
                  )}
                </div>
                <p className="mt-4 text-xs text-zinc-500">{VAT_NOTE}</p>
              </div>
            </Section>

            <section id="advanced" className="scroll-mt-20">
              {/* Opens on its own when the brand changed and links need a new cache version. */}
              <details open={refresh.needsRepublish} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-zinc-800 px-4 py-3 sm:px-6">
                  <span>
                    <span className="text-lg font-semibold">Advanced</span>
                    <span className="ml-3 text-sm text-zinc-500">Cache refresh and signed URLs</span>
                  </span>
                  <span aria-hidden="true" className="text-zinc-500 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="mt-6 flex flex-col gap-6">
                  <RefreshPanel
                    version={refresh.version}
                    brandUpdatedAt={refresh.brandUpdatedAt?.toISOString() ?? null}
                    needsRepublish={refresh.needsRepublish}
                    baseUrl={appUrl()}
                  />
                  <SigningPanel accountId={user.id} />
                </div>
              </details>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 lg:scroll-mt-8">
      <h2 id={`${id}-title`} className="mb-4 text-lg font-semibold">
        {title}
      </h2>
      <div className="grid gap-6 [&>*]:min-w-0">{children}</div>
    </section>
  );
}
