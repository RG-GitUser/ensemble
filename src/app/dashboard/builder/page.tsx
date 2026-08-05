import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSections, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { getTemplate, planAllowsTemplate, SECTION_TEMPLATES, type FieldSpec } from "@/lib/sections";
import {
  addSectionAction,
  deleteSectionAction,
  moveSectionAction,
  updateSectionAction,
} from "@/lib/actions";
import type { Section } from "@/lib/types";

function Field({ spec, value }: { spec: FieldSpec; value: string }) {
  const name = `field_${spec.key}`;
  if (spec.kind === "textarea" || spec.kind === "lines") {
    return (
      <div>
        <label className="label">{spec.label}</label>
        {spec.help && <p className="-mt-1 mb-1.5 text-xs text-mist/70">{spec.help}</p>}
        <textarea
          name={name}
          defaultValue={value}
          placeholder={spec.placeholder}
          className={`field min-h-24 ${spec.kind === "lines" ? "font-mono text-sm" : ""}`}
        />
      </div>
    );
  }
  return (
    <div>
      <label className="label">{spec.label}</label>
      <input name={name} defaultValue={value} placeholder={spec.placeholder} className="field" />
    </div>
  );
}

function SectionCard({ section, index, total }: { section: Section; index: number; total: number }) {
  const tpl = getTemplate(section.type);
  if (!tpl) return null;
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold">
          <span>{tpl.icon}</span> {tpl.name}
        </h3>
        <div className="flex items-center gap-1.5">
          <form action={moveSectionAction}>
            <input type="hidden" name="sectionId" value={section.id} />
            <input type="hidden" name="dir" value="up" />
            <button
              disabled={index === 0}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-sm text-mist transition hover:text-snow disabled:opacity-30"
              title="Move up"
            >
              ↑
            </button>
          </form>
          <form action={moveSectionAction}>
            <input type="hidden" name="sectionId" value={section.id} />
            <input type="hidden" name="dir" value="down" />
            <button
              disabled={index === total - 1}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-sm text-mist transition hover:text-snow disabled:opacity-30"
              title="Move down"
            >
              ↓
            </button>
          </form>
          <form action={deleteSectionAction}>
            <input type="hidden" name="sectionId" value={section.id} />
            <button
              className="rounded-lg border border-edge px-2.5 py-1.5 text-sm text-mist transition hover:border-brand2/60 hover:text-brand2"
              title="Delete section"
            >
              ✕
            </button>
          </form>
        </div>
      </div>
      <form action={updateSectionAction} className="space-y-4">
        <input type="hidden" name="sectionId" value={section.id} />
        {tpl.fields.map((f) => (
          <Field key={f.key} spec={f} value={section.content[f.key] ?? ""} />
        ))}
        <button className="btn-ghost !py-2 text-sm">Save section</button>
      </form>
    </div>
  );
}

export default async function BuilderPage() {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const plan = getPlan(site.plan);
  const sections = getSections(site.id);
  const atLimit = sections.length >= plan.maxSections;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Page Builder</h1>
          <p className="mt-1 text-sm text-mist">
            Copy &amp; paste your content into sections below — changes go live when you save.
          </p>
        </div>
        <Link href={`/s/${site.slug}?preview=1`} target="_blank" className="btn-ghost !py-2 text-sm">
          Preview page ↗
        </Link>
      </div>

      {/* Add-section gallery */}
      <div className="card mt-6 !bg-panel/60">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold">Add a section</h2>
          <span className={`text-xs ${atLimit ? "text-warn" : "text-mist"}`}>
            {sections.length} / {plan.maxSections === Infinity ? "∞" : plan.maxSections} used
            {atLimit ? " — limit reached, upgrade for more" : ""}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SECTION_TEMPLATES.map((tpl) => {
            const allowed = planAllowsTemplate(site.plan, tpl);
            const disabled = !allowed || atLimit;
            return (
              <form key={tpl.type} action={addSectionAction}>
                <input type="hidden" name="type" value={tpl.type} />
                <button
                  disabled={disabled}
                  className="w-full rounded-xl border border-edge bg-panel2 p-3.5 text-left transition hover:border-brand/60 disabled:cursor-not-allowed disabled:opacity-40"
                  title={!allowed ? `Requires the ${tpl.requires === "pro" ? "Pro" : "Enterprise"} plan` : tpl.description}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{tpl.icon} {tpl.name}</span>
                    {!allowed && (
                      <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warn">
                        {tpl.requires}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-mist">{tpl.description}</p>
                </button>
              </form>
            );
          })}
        </div>
      </div>

      {/* Existing sections */}
      <div className="mt-8 space-y-5">
        {sections.length === 0 && (
          <div className="card text-center text-mist">Your page is empty — add a section above to get started.</div>
        )}
        {sections.map((s, i) => (
          <SectionCard key={s.id} section={s} index={i} total={sections.length} />
        ))}
      </div>
    </div>
  );
}
