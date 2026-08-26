import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import AdminBarChart from "@/components/AdminBarChart";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getAdminMetrics, isAdminUser } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {sub ? <p className="mt-1 text-xs text-zinc-500">{sub}</p> : null}
    </div>
  );
}

export default async function AdminPage() {
  const user = await getCurrentUser().catch(() => null);
  // Non-admins get a 404, not a 403, so the page's existence isn't revealed.
  if (!user || !isAdminUser(user)) notFound();

  const m = await getAdminMetrics(getDb());
  const verifiedPct =
    m.totalUsers > 0 ? Math.round((m.verifiedUsers / m.totalUsers) * 100) : 0;
  const planMax = Math.max(1, m.planCounts.free, m.planCounts.pro, m.planCounts.scale);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="mb-8 text-2xl font-bold">Admin</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="MRR"
            value={`$${m.mrrUsd.toLocaleString()}`}
            sub={`${m.payingCustomers} paying customer${m.payingCustomers === 1 ? "" : "s"}`}
          />
          <Tile
            label="Users"
            value={m.totalUsers.toLocaleString()}
            sub={`${verifiedPct}% verified`}
          />
          <Tile
            label="Renders this month"
            value={m.rendersThisMonth.toLocaleString()}
          />
          <Tile label="Active API keys" value={m.activeKeys.toLocaleString()} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="mb-3 font-semibold">Signups — last 30 days</h2>
            <AdminBarChart
              bars={m.signupsLast30Days.map((d, i) => ({
                label: i % 7 === 0 ? d.day.slice(5) : "",
                tooltip: `${d.day}: ${d.count} signup${d.count === 1 ? "" : "s"}`,
                value: d.count,
              }))}
            />
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="mb-3 font-semibold">Renders — last 6 months</h2>
            <AdminBarChart
              bars={m.rendersByMonth.map((r) => ({
                label: r.month.slice(5),
                tooltip: `${r.month}: ${r.count.toLocaleString()} renders`,
                value: r.count,
              }))}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="mb-4 font-semibold">Plan mix</h2>
            <div className="flex flex-col gap-3">
              {(["free", "pro", "scale"] as const).map((plan) => (
                <div key={plan} className="flex items-center gap-3 text-sm">
                  <span className="w-12 capitalize text-zinc-400">{plan}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-indigo-400/85"
                      style={{
                        width: `${(m.planCounts[plan] / planMax) * 100}%`,
                        minWidth: m.planCounts[plan] > 0 ? "3px" : 0,
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-zinc-300">
                    {m.planCounts[plan].toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="mb-4 font-semibold">Top accounts this month</h2>
            {m.topAccounts.length === 0 ? (
              <p className="text-sm text-zinc-500">No renders yet this month.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="pb-2 font-medium">Account</th>
                    <th className="pb-2 font-medium">Plan</th>
                    <th className="pb-2 text-right font-medium">Renders</th>
                  </tr>
                </thead>
                <tbody>
                  {m.topAccounts.map((a) => (
                    <tr key={a.email} className="border-t border-zinc-800">
                      <td className="max-w-48 truncate py-2 pr-2">{a.email}</td>
                      <td className="py-2 capitalize text-zinc-400">{a.plan}</td>
                      <td className="py-2 text-right text-zinc-300">
                        {a.renders.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
