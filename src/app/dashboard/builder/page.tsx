import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSections, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { getTemplate, planAllowsTemplate, SECTION_TEMPLATES, type FieldSpec } from "@/lib/sections";
import { THEMES, themeCss } from "@/lib/themes";
import {
  addSectionAction,
  deleteSectionAction,
  moveSectionAction,
  organizeSectionsAction,
  setSectionThemeAction,
  updateSectionAction,
} from "@/lib/actions";
import { ThemeForm } from "@/components/ThemeForm";
import { DraggableSections } from "@/components/DraggableSections";
import { SaveButton } from "@/components/SaveButton";
import type { Section } from "@/lib/types";

/** The classic look when no theme is chosen. */
function defaultCss(accent: string): React.CSSProperties {
  return {
    backgroundImage: `radial-gradient(120px 60px at 50% -10%, ${accent}55, transparent 70%)`,
    backgroundColor: "#0a0812",
  };
}

function SectionThemeRow({ section, accent }: { section: Section; accent: string }) {
  const options = [{ id: "", name: "Page theme" }, ...THEMES];
  return (
    <div className="mb-4 border-b border-edge pb-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-mist">Container theme</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((t) => {
          const selected = section.theme === t.id;
          return (
            <form key={t.id || "inherit"} action={setSectionThemeAction}>
              <input type="hidden" name="sectionId" value={section.id} />
              <input type="hidden" name="theme" value={t.id} />
              <button
                className={`block h-8 w-12 overflow-hidden rounded-lg border transition ${
                  selected ? "border-brand ring-1 ring-brand" : "border-edge hover:border-brand/60"
                }`}
                title={t.name}
                style={themeCss(t.id, accent) ?? defaultCss(accent)}
              >
                {t.id === "" && <span className="text-[9px] font-semibold text-white/70">page</span>}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

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

function SectionCard({
  section,
  index,
  total,
  accent,
}: {
  section: Section;
  index: number;
  total: number;
  accent: string;
}) {
  const tpl = getTemplate(section.type);
  if (!tpl) return null;
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-3">
        {/* `draggable` + the marker attribute are static markup: DraggableSections
            catches the bubbled dragstart, so this card needs no client JS. */}
        <h3
          draggable
          data-drag-handle
          title="Drag to reorder"
          className="flex cursor-grab select-none items-center gap-2 font-bold active:cursor-grabbing"
        >
          <span aria-hidden className="text-mist/50">⠿</span>
          {tpl.name}
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
      <SectionThemeRow section={section} accent={accent} />
      <form action={updateSectionAction} className="space-y-4">
        <input type="hidden" name="sectionId" value={section.id} />
        {tpl.fields.map((f) => (
          <Field key={f.key} spec={f} value={section.content[f.key] ?? ""} />
        ))}
        <SaveButton />
      </form>
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
        active ? "border-brand text-snow" : "border-transparent text-mist hover:text-snow"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function BuilderPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const site = getSiteByUser(user.id);
  if (!site) redirect("/dashboard");
  const { tab } = await searchParams;
  const designTab = tab === "design";
  const plan = getPlan(site.plan);
  const sections = getSections(site.id);
  const atLimit = sections.length >= plan.maxSections;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Page Builder</h1>
          <p className="mt-1 text-sm text-mist">
            {designTab
              ? "Style your page — colors apply the moment you save."
              : "Copy & paste your content into sections below — changes go live when you save."}
          </p>
        </div>
        <Link href={`/s/${site.slug}?preview=1`} target="_blank" className="btn-ghost !py-2 text-sm">
          Preview page ↗
        </Link>
      </div>

      <div className="mt-6 flex border-b border-edge">
        <Tab href="/dashboard/builder" active={!designTab}>Sections</Tab>
        <Tab href="/dashboard/builder?tab=design" active={designTab}>Design</Tab>
      </div>

      {designTab ? (
        <div className="mt-6">
          <ThemeForm
            themeColor={site.config.themeColor}
            bgColor={site.config.bgColor ?? "#0a0812"}
            cardColor={site.config.cardColor ?? "rgba(255,255,255,0.05)"}
            bgImage={site.config.bgImage ?? ""}
            cardImage={site.config.cardImage ?? ""}
            faviconUrl={site.config.faviconUrl ?? ""}
            gradient={site.config.gradient !== false}
            themeId={site.config.themeId ?? ""}
          />
        </div>
      ) : (
        <BuilderSections site={site} plan={plan} sections={sections} atLimit={atLimit} />
      )}
    </div>
  );
}

function BuilderSections({
  site,
  plan,
  sections,
  atLimit,
}: {
  site: NonNullable<ReturnType<typeof getSiteByUser>>;
  plan: ReturnType<typeof getPlan>;
  sections: Section[];
  atLimit: boolean;
}) {
  return (
    <>
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
                    <span className="font-semibold text-sm">{tpl.name}</span>
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
      <div className="mt-8">
        {sections.length === 0 ? (
          <div className="card text-center text-mist">Your page is empty — add a section above to get started.</div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-mist/70">Drag a section by its title to reorder, or use ↑ ↓.</p>
              {sections.length > 1 && (
                <form action={organizeSectionsAction}>
                  <button
                    className="btn-ghost !py-1.5 !px-3 text-xs"
                    title="Restack your sections into a proven order: hook first, your best content next, merch while attention is high, then story, email capture, community, and links & contact at the bottom. You can still drag anything afterwards."
                  >
                    ✨ Organize my page
                  </button>
                </form>
              )}
            </div>
            <DraggableSections
              items={sections.map((s, i) => ({
                id: s.id,
                node: (
                  <SectionCard section={s} index={i} total={sections.length} accent={site.config.themeColor} />
                ),
              }))}
            />
          </>
        )}
      </div>
    </>
  );
}
