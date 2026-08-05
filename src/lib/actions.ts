"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as store from "./db";
import { ADMIN_EMAIL, endSession, getCurrentUser, hashPassword, requireUser, startSession, verifyPassword } from "./auth";
import { getPlan, PLANS } from "./plans";
import { getTemplate, planAllowsTemplate } from "./sections";
import type { Site, SiteConfig } from "./types";

export interface FormState {
  error?: string;
  ok?: boolean;
}

/* ---------------- helpers ---------------- */

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s || "my-page";
}

function uniqueSlug(base: string): string {
  let slug = slugify(base);
  let n = 1;
  while (store.slugTaken(slug)) slug = `${slugify(base)}-${++n}`;
  return slug;
}

async function requireSite(): Promise<{ site: Site }> {
  const user = await requireUser();
  const site = store.getSiteByUser(user.id);
  if (!site) redirect("/onboarding");
  return { site };
}

function revalidateSite(site: Site): void {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/builder");
  revalidatePath(`/s/${site.slug}`);
}

/* ---------------- auth ---------------- */

export async function signup(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  const businessName = str(fd, "businessName");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");

  if (!name || !businessName || !email || !password) return { error: "All fields are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (store.getUserByEmail(email)) return { error: "An account with that email already exists. Try logging in." };

  const user = store.createUser(email, hashPassword(password), name, businessName);
  await startSession(user.id);

  // Carry marketing-page intent (chosen plan / integrate path) into onboarding.
  const params = new URLSearchParams();
  const plan = str(fd, "intentPlan");
  const path = str(fd, "intentPath");
  if (plan in PLANS) params.set("plan", plan);
  if (path === "integrate") params.set("path", "integrate");
  const qs = params.toString();
  redirect(qs ? `/onboarding?${qs}` : "/onboarding");
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const user = store.getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) return { error: "Invalid email or password." };
  await startSession(user.id);
  const site = store.getSiteByUser(user.id);
  const quote = store.getQuoteByUser(user.id);
  redirect(site || quote ? "/dashboard" : "/onboarding");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}

/* ---------------- onboarding ---------------- */

export async function startFromScratch(fd: FormData): Promise<void> {
  const user = await requireUser();
  const planId = str(fd, "plan");
  if (!(planId in PLANS)) redirect("/onboarding");
  if (store.getSiteByUser(user.id)) redirect("/dashboard");

  const config: SiteConfig = { themeColor: "#8b5cf6", tagline: "" };
  const site = store.createSite(user.id, uniqueSlug(user.businessName), planId, config);

  // Seed a starter page so the builder never starts empty.
  for (const type of ["hero", "about", "bonus", "links"]) {
    const tpl = getTemplate(type)!;
    store.addSection(site.id, type, {
      ...tpl.defaults,
      ...(type === "hero" ? { heading: user.businessName } : {}),
    });
  }
  redirect("/dashboard");
}

export async function submitQuote(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const websiteUrl = str(fd, "websiteUrl");
  const details = str(fd, "details");
  if (!websiteUrl) return { error: "Please include your current website URL." };
  store.createQuoteRequest(user.id, user.name, user.businessName, user.email, websiteUrl, details);
  redirect("/dashboard?quote=submitted");
}

/* ---------------- builder ---------------- */

export async function addSectionAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const type = str(fd, "type");
  const tpl = getTemplate(type);
  if (!tpl) return;
  const plan = getPlan(site.plan);
  if (!planAllowsTemplate(site.plan, tpl)) return;
  if (store.countSections(site.id) >= plan.maxSections) return;
  store.addSection(site.id, type, { ...tpl.defaults });
  revalidateSite(site);
}

export async function updateSectionAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "sectionId"));
  const section = store.getSection(id);
  if (!section || section.siteId !== site.id) return;
  const tpl = getTemplate(section.type);
  if (!tpl) return;
  const content: Record<string, string> = {};
  for (const f of tpl.fields) content[f.key] = str(fd, `field_${f.key}`);
  store.updateSectionContent(id, content);
  revalidateSite(site);
}

export async function moveSectionAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "sectionId"));
  const dir = str(fd, "dir") === "up" ? "up" : "down";
  const section = store.getSection(id);
  if (!section || section.siteId !== site.id) return;
  store.moveSection(id, dir);
  revalidateSite(site);
}

export async function deleteSectionAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "sectionId"));
  const section = store.getSection(id);
  if (!section || section.siteId !== site.id) return;
  store.deleteSection(id);
  revalidateSite(site);
}

/* ---------------- site settings ---------------- */

export async function updateSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  const slug = slugify(str(fd, "slug"));
  const tagline = str(fd, "tagline");
  const themeColor = str(fd, "themeColor") || site.config.themeColor;
  if (slug.length < 3) return { error: "Your page URL must be at least 3 characters." };
  if (store.slugTaken(slug, site.id)) return { error: "That page URL is taken — try another." };
  store.updateSite(site.id, { slug, config: { ...site.config, tagline, themeColor } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath(`/s/${slug}`);
  return {};
}

export async function togglePublish(): Promise<void> {
  const { site } = await requireSite();
  store.updateSite(site.id, { published: !site.published });
  revalidateSite(site);
}

export async function changePlan(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const planId = str(fd, "plan");
  if (!(planId in PLANS)) return;
  store.updateSite(site.id, { plan: planId });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/builder");
  revalidatePath(`/s/${site.slug}`);
}

export async function updateIntegrations(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  const plan = getPlan(site.plan);
  const config: SiteConfig = { ...site.config };
  if (plan.payments) config.stripeKey = str(fd, "stripeKey");
  if (plan.calendar) config.calendlyUrl = str(fd, "calendlyUrl");
  if (plan.chatroom) config.chatroomEnabled = fd.get("chatroomEnabled") === "on";
  if (plan.newsletter) config.newsletterEnabled = fd.get("newsletterEnabled") === "on";
  store.updateSite(site.id, { config });
  revalidatePath("/dashboard/integrations");
  revalidatePath(`/s/${site.slug}`);
  return {};
}

/* ---------------- public site ---------------- */

export async function subscribeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const siteId = Number(str(fd, "siteId"));
  const email = str(fd, "email").toLowerCase();
  const site = store.getSiteById(siteId);
  if (!site) return { error: "Page not found." };
  const plan = getPlan(site.plan);
  if (!plan.newsletter) return { error: "Newsletter is not enabled on this page." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  store.addLead(siteId, email);
  return { ok: true };
}

/* ---------------- admin ---------------- */

export async function markQuote(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) return;
  const id = Number(str(fd, "quoteId"));
  const status = str(fd, "status");
  if (!["new", "quoted", "closed"].includes(status)) return;
  store.updateQuoteStatus(id, status);
  revalidatePath("/admin");
}
