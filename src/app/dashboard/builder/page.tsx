import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getSections, getSiteByUser } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import {
  getTemplate,
  planAllowsTemplate,
  RECOMMENDED_ORDER,
  SECTION_TEMPLATES,
  type FieldSpec,
} from "@/lib/sections";
import { DEFAULT_BG, DEFAULT_BORDER, DEFAULT_CARD, DEFAULT_LAYOUT, DEFAULT_LIGHT_BG, DEFAULT_LIGHT_CARD, DEFAULT_SIZE, DEFAULT_TEXT_ALIGN, getColorMode } from "@/lib/theme";
import { DEFAULT_FONT, DEFAULT_LIGHT_TEXT_COLOR, DEFAULT_TEXT_COLOR, DEFAULT_TEXT_SIZE } from "@/lib/fonts";
import { THEMES, themeCss } from "@/lib/themes";
import {
  addSectionAction,
  deleteAllSectionsAction,
  deleteSectionAction,
  moveSectionAction,
  organizeSectionsAction,
  setSectionThemeAction,
  updateSectionAction,
} from "@/lib/actions";
import { DangerButton } from "@/components/DangerButton";
import { ThemeForm } from "@/components/ThemeForm";
import { DraggableSections } from "@/components/DraggableSections";
import { SaveButton } from "@/components/SaveButton";
import { ArrowDownIcon, ArrowUpIcon, CheckIcon, CloseIcon, DragIcon, SortIcon } from "@/components/icons";
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
          <DragIcon className="text-mist/50" />
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
              aria-label="Move section up"
            >
              <ArrowUpIcon />
            </button>
          </form>
          <form action={moveSectionAction}>
            <input type="hidden" name="sectionId" value={section.id} />
            <input type="hidden" name="dir" value="down" />
            <button
              disabled={index === total - 1}
              className="rounded-lg border border-edge px-2.5 py-1.5 text-sm text-mist transition hover:text-snow disabled:opacity-30"
              title="Move down"
              aria-label="Move section down"
            >
              <ArrowDownIcon />
            </button>
          </form>
          <form action={deleteSectionAction}>
            <input type="hidden" name="sectionId" value={section.id} />
            <button
              className="rounded-lg border border-edge px-2.5 py-1.5 text-sm text-mist transition hover:border-brand2/60 hover:text-brand2"
              title="Delete section"
              aria-label="Delete section"
            >
              <CloseIcon />
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

/**
 * `tour` rides on the link itself rather than a wrapper element. A wrapper is
 * what a flex child becomes, leaving the <a> inside it inline — and vertical
 * padding on an inline box doesn't contribute to layout height, so a wrapped
 * tab's label sits higher than its unwrapped neighbour's.
 */
function Tab({
  href,
  active,
  tour,
  children,
}: {
  href: string;
  active: boolean;
  tour?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-tour={tour}
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
    // The Design tab runs a controls column beside a sticky preview, so it gets
    // more room than the single column of section editors.
    <div className={`mx-auto ${designTab ? "max-w-6xl" : "max-w-4xl"}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Page Builder</h1>
          <p className="mt-1 text-sm text-mist">
            {designTab
              ? "Backdrop, containers and accent — every look here is on every plan, and goes live when you save."
              : "Copy & paste your content into sections below — changes go live when you save."}
          </p>
        </div>
        <Link href={`/${site.slug}?preview=1`} target="_blank" className="btn-ghost !py-2 text-sm">
          Preview page ↗
        </Link>
      </div>

      <div className="mt-6 flex border-b border-edge">
        <Tab href="/dashboard/builder" active={!designTab}>Sections</Tab>
        <Tab href="/dashboard/builder?tab=design" active={designTab} tour="design">Design</Tab>
      </div>

      {designTab ? (
        <div className="mt-6">
          <ThemeForm
            themeColor={site.config.themeColor}
            bgColor={site.config.bgColor ?? DEFAULT_BG}
            cardColor={site.config.cardColor ?? DEFAULT_CARD}
            containerSize={site.config.containerSize ?? DEFAULT_SIZE}
            borderStyle={site.config.borderStyle ?? DEFAULT_BORDER}
            bgImage={site.config.bgImage ?? ""}
            cardImage={site.config.cardImage ?? ""}
            faviconUrl={site.config.faviconUrl ?? ""}
            gradient={site.config.gradient !== false}
            themeId={site.config.themeId ?? ""}
            fontId={site.config.fontId ?? DEFAULT_FONT}
            fontScale={site.config.fontScale ?? DEFAULT_TEXT_SIZE}
            textColor={site.config.textColor ?? DEFAULT_TEXT_COLOR}
            layout={site.config.layout ?? DEFAULT_LAYOUT}
            textAlign={site.config.textAlign ?? DEFAULT_TEXT_ALIGN}
            colorMode={getColorMode(site.config.colorMode)}
            lightBgColor={site.config.lightBgColor ?? DEFAULT_LIGHT_BG}
            lightCardColor={site.config.lightCardColor ?? DEFAULT_LIGHT_CARD}
            lightTextColor={site.config.lightTextColor ?? DEFAULT_LIGHT_TEXT_COLOR}
            lightThemeId={site.config.lightThemeId ?? ""}
            looks={site.config.looks ?? []}
            slug={site.slug}
          />
        </div>
      ) : (
        <BuilderSections site={site} plan={plan} sections={sections} atLimit={atLimit} />
      )}
    </div>
  );
}

/**
 * The gallery reads top-to-bottom in the order a page is usually built —
 * the same running order "Organize my page" applies — so the list mirrors the
 * page instead of the order templates happen to be declared in. Anything not
 * ranked there sorts to the end, keeping its own order.
 */
function galleryOrder(templates: typeof SECTION_TEMPLATES) {
  const rank = (t: (typeof SECTION_TEMPLATES)[number]) => {
    const i = RECOMMENDED_ORDER.indexOf(t.type);
    return i === -1 ? RECOMMENDED_ORDER.length : i;
  };
  return [...templates].sort((a, b) => rank(a) - rank(b));
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
  // How many of each type are already on the page — drives the "Added" state,
  // so the gallery shows what you've used rather than reading identically
  // whether your page is empty or finished.
  const used = new Map<string, number>();
  for (const s of sections) used.set(s.type, (used.get(s.type) ?? 0) + 1);

  return (
    <>
      {/* Add-section gallery */}
      <div className="card mt-6 !bg-panel/60" data-tour="gallery">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold">Add a section</h2>
          <span className={`text-xs ${atLimit ? "text-warn" : "text-mist"}`}>
            {sections.length} / {plan.maxSections === Infinity ? "∞" : plan.maxSections} used
            {atLimit ? " — limit reached, upgrade for more" : ""}
          </span>
        </div>
        {/* `items-stretch` + `h-full` on both the form and the button: each
            form is the grid item, so without this the button shrink-wraps its
            own text and tiles in the same row end at different heights. */}
        <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {galleryOrder(SECTION_TEMPLATES).map((tpl) => {
            const allowed = planAllowsTemplate(site.plan, tpl);
            const added = used.has(tpl.type);
            // One of each kind per page — an added type is done, not repeatable.
            const disabled = !allowed || added || atLimit;
            return (
              <form key={tpl.type} action={addSectionAction} className="h-full">
                <input type="hidden" name="type" value={tpl.type} />
                <button
                  disabled={disabled}
                  className={`flex h-full w-full flex-col rounded-xl border p-3.5 text-left transition disabled:cursor-not-allowed ${
                    added
                      ? "border-brand/50 bg-brand/5 opacity-100 disabled:opacity-100"
                      : "border-edge bg-panel2 hover:border-brand/60 disabled:opacity-40"
                  }`}
                  title={
                    !allowed
                      ? `Requires the ${tpl.requires === "pro" ? "Pro" : "Enterprise"} plan`
                      : added
                        ? `${tpl.name} is already on your page — edit it below, or delete it to add a fresh one`
                        : tpl.description
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold">{tpl.name}</span>
                    {!allowed ? (
                      <span className="shrink-0 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warn">
                        {tpl.requires}
                      </span>
                    ) : added ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase text-brand">
                        <CheckIcon />
                        Added
                      </span>
                    ) : null}
                  </div>
                  {/* flex-1 pushes every tile's footer to the same baseline. */}
                  <p className="mt-1.5 flex-1 text-xs text-mist">{tpl.description}</p>
                  <p className={`mt-2.5 text-[11px] font-semibold ${added ? "text-brand/80" : "text-mist/70"}`}>
                    {added ? "On your page — edit it below" : "Add to page"}
                  </p>
                </button>
              </form>
            );
          })}
        </div>
      </div>

      {/* Existing sections */}
      <div className="mt-8" data-tour="sections">
        {sections.length === 0 ? (
          <div className="card text-center text-mist">Your page is empty — add a section above to get started.</div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-mist/70">Drag a section by its title to reorder, or use the arrows.</p>
              <div className="flex flex-wrap items-center gap-2">
                <DangerButton
                  label="Delete all content"
                  title="Delete everything on your page?"
                  body={`This removes all ${sections.length} sections and everything you've typed into them. Your design, plan and page address are untouched — but the content itself can't be brought back.`}
                  confirmLabel="Delete everything"
                  action={deleteAllSectionsAction}
                />
                {sections.length > 1 && (
                <form action={organizeSectionsAction}>
                  <button
                    className="btn-ghost inline-flex items-center gap-1.5 !py-1.5 !px-3 text-xs"
                    title="Restack your sections into a proven order: hook first, your best content next, merch while attention is high, then story, email capture, community, and links & contact at the bottom. You can still drag anything afterwards."
                  >
                    <SortIcon /> Organize my page
                  </button>
                </form>
                )}
              </div>
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
