import Link from "next/link";

/** Full-page lock screen shown when a dashboard feature isn't included in the current plan. */
export function UpgradeGate({
  title,
  requiredPlan,
  body,
}: {
  title: string;
  requiredPlan: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="card mt-6 border-dashed text-center">
        <span className="rounded-full bg-warn/15 px-3 py-1 text-xs font-bold uppercase text-warn">
          {requiredPlan} feature
        </span>
        <h2 className="mt-4 text-xl font-bold">Unlock {title.toLowerCase()} with {requiredPlan}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-mist">{body}</p>
        <Link href="/dashboard/settings" className="btn-primary mt-6 !py-2 text-sm">
          Upgrade in Settings
        </Link>
      </div>
    </div>
  );
}
