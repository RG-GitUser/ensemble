"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as store from "./db";
import { ADMIN_EMAIL, endSession, getCurrentUser, hashPassword, requireUser, startSession, verifyPassword } from "./auth";
import { getPlan, PLANS } from "./plans";
import { embedUrl, getTemplate, planAllowsTemplate } from "./sections";
import { getThemeDef } from "./themes";
import { extractContent, fetchSiteHtml, validateSiteUrl } from "./scrape";
import { cleanFacebookLiveUrl, cleanHandle, cleanInstagramUser, cleanTwitchChannel, getPlatform, isDiscordWebhook } from "./social";
import { blueskySession, publishPost } from "./publish";
import { QUOTE_ACCESS_METHODS, QUOTE_FILE_MAX_BYTES, QUOTE_PLATFORMS } from "./quotes";
import { cleanHostname, platformHosts } from "./domains";
import { ACCENTS, BACKGROUNDS, CONTAINERS, DEFAULT_BG, DEFAULT_CARD, pickSwatch } from "./theme";
import {
  billingEnabled,
  billingOk,
  changeSubscriptionPlan,
  createCheckoutUrl,
  createPortalUrl,
  reconcileBilling,
} from "./billing";
import fs from "fs";
import path from "path";
import type { Plan, Site, SiteConfig } from "./types";

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

  // With Stripe configured, the page needs a subscription before it can go live.
  if (billingEnabled()) {
    store.setSiteBilling(site.id, { billingStatus: "unpaid" });
    let checkoutUrl: string;
    try {
      checkoutUrl = await createCheckoutUrl(store.getSiteById(site.id)!, user, planId as Plan);
    } catch {
      redirect("/dashboard?billing=error");
    }
    redirect(checkoutUrl);
  }
  redirect("/dashboard");
}

export async function submitQuote(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const websiteUrl = str(fd, "websiteUrl");
  const details = str(fd, "details");
  if (!websiteUrl) return { error: "Please include your current website URL." };

  const platform = str(fd, "platform");
  if (!QUOTE_PLATFORMS.some((p) => p.id === platform)) return { error: "Pick what your site runs on." };
  const accessMethod = str(fd, "accessMethod");
  if (!QUOTE_ACCESS_METHODS.some((a) => a.id === accessMethod)) return { error: "Pick how we should connect your site." };

  // Validate any project zip before touching the database.
  const file = fd.get("projectFile");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (accessMethod !== "zip") return { error: "Attach a file only with the 'upload my project files' option." };
    if (!/\.zip$/i.test(file.name)) return { error: "Project files must be a single .zip archive." };
    if (file.size > QUOTE_FILE_MAX_BYTES) return { error: "Zips are capped at 25MB — trim node_modules/media and retry." };
  } else if (accessMethod === "zip") {
    return { error: "Attach your project zip, or pick a different access option." };
  }

  const quote = store.createQuoteRequest(
    user.id,
    user.name,
    user.businessName,
    user.email,
    websiteUrl,
    details,
    platform,
    accessMethod
  );

  if (hasFile) {
    const safe = path.basename(file.name).replace(/[^\w.-]/g, "_").slice(-80);
    const storedName = `quote-${quote.id}-${safe}`;
    const dir = path.join(process.cwd(), "data", "uploads");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));
    store.setQuoteFileName(quote.id, storedName);
  }

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

/* ---------------- finance connections ---------------- */

export async function connectFinanceStripe(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!getPlan(site.plan).payments) return { error: "Financial breakdowns are a Pro feature." };
  const key = str(fd, "financeStripeKey");
  if (!/^(sk|rk)_(live|test)_/.test(key)) {
    return { error: "That doesn't look like a Stripe secret or restricted key (sk_... / rk_...)." };
  }
  // Prove the key works before storing it.
  try {
    const { fetchStripeFinance } = await import("./finance");
    await fetchStripeFinance(key);
  } catch {
    return { error: "Stripe rejected that key — check it has read access to Balance and Charges." };
  }
  store.updateSite(site.id, { config: { ...site.config, financeStripeKey: key } });
  revalidatePath("/dashboard/analytics");
  return { ok: true };
}

export async function disconnectFinanceStripe(): Promise<void> {
  const { site } = await requireSite();
  store.updateSite(site.id, { config: { ...site.config, financeStripeKey: "" } });
  revalidatePath("/dashboard/analytics");
}

/* ---------------- design themes ---------------- */

export async function setSiteTheme(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const themeId = str(fd, "themeId");
  if (themeId && !getThemeDef(themeId)) return;
  store.updateSite(site.id, { config: { ...site.config, themeId } });
  revalidateSite(site);
}

export async function setSectionThemeAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "sectionId"));
  const theme = str(fd, "theme");
  if (theme && !getThemeDef(theme)) return;
  const section = store.getSection(id);
  if (!section || section.siteId !== site.id) return;
  store.setSectionTheme(id, theme);
  revalidateSite(site);
}

/* ---------------- site settings ---------------- */

export async function updateSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  const slug = slugify(str(fd, "slug"));
  const tagline = str(fd, "tagline");
  // Length rule only applies to slug changes, so sites with a shorter
  // pre-existing slug can still save their other settings.
  if (slug.length < 3 && slug !== site.slug) return { error: "Your page URL must be at least 3 characters." };
  if (store.slugTaken(slug, site.id)) return { error: "That page URL is taken — try another." };
  store.updateSite(site.id, { slug, config: { ...site.config, tagline } });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath(`/s/${slug}`);
  return {};
}

const THEME_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};
const THEME_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** Reject SVGs with anything active or external — they get served from our origin. */
function svgSafe(svg: string): boolean {
  if (svg.length > 100_000 || !/^\s*<svg[\s\S]*<\/svg>\s*$/i.test(svg)) return false;
  return !/<script|<foreignobject|<iframe|<image|<use|\bon\w+\s*=|javascript:|href\s*=/i.test(svg);
}

function storeThemeAsset(siteId: number, kind: "bg" | "card", data: Buffer, ext: string): string {
  const dir = path.join(process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const name = `theme-${siteId}-${kind}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(dir, name), data);
  return `/api/uploads/${name}`;
}

/** Uploaded theme image → stored URL, or a form error string. */
async function themeImageFrom(fd: FormData, field: string, siteId: number, kind: "bg" | "card"): Promise<string | { error: string } | null> {
  const file = fd.get(field);
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = THEME_IMAGE_TYPES[file.type];
  if (!ext) return { error: "Images can be SVG, PNG, JPG, WebP or GIF." };
  if (file.size > THEME_IMAGE_MAX_BYTES) return { error: "Theme images are capped at 4MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  if (ext === "svg" && !svgSafe(buf.toString("utf8"))) {
    return { error: "That SVG has features we can't safely serve (scripts or links) — export it as a plain graphic." };
  }
  return storeThemeAsset(siteId, kind, buf, ext);
}

/** Saves the Design tab of the page builder. */
export async function updateTheme(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  // Theme values go into inline styles on the public page — only accept
  // curated palette values, keeping whatever the site already had otherwise.
  const themeColor = pickSwatch(ACCENTS, str(fd, "themeColor"), site.config.themeColor);
  const bgColor = pickSwatch(BACKGROUNDS, str(fd, "bgColor"), site.config.bgColor ?? DEFAULT_BG);
  const cardColor = pickSwatch(CONTAINERS, str(fd, "cardColor"), site.config.cardColor ?? DEFAULT_CARD);
  const themeIdRaw = str(fd, "themeId");
  const config: SiteConfig = {
    ...site.config,
    themeColor,
    bgColor,
    cardColor,
    gradient: fd.get("gradient") === "on",
    // Preset backdrop — only known preset ids; "" = custom backdrop.
    themeId: getThemeDef(themeIdRaw) ? themeIdRaw : "",
  };

  // Background image: an upload wins, then a client-generated random SVG,
  // then an explicit remove; otherwise whatever was there stays.
  const bgUpload = await themeImageFrom(fd, "bgImageFile", site.id, "bg");
  if (bgUpload && typeof bgUpload === "object") return bgUpload;
  const bgSvg = str(fd, "bgSvg");
  if (bgUpload) {
    config.bgImage = bgUpload;
  } else if (bgSvg) {
    if (!svgSafe(bgSvg)) return { error: "That generated SVG couldn't be validated — try randomizing again." };
    config.bgImage = storeThemeAsset(site.id, "bg", Buffer.from(bgSvg, "utf8"), "svg");
  } else if (str(fd, "clearBgImage") === "1") {
    delete config.bgImage;
  }

  const cardUpload = await themeImageFrom(fd, "cardImageFile", site.id, "card");
  if (cardUpload && typeof cardUpload === "object") return cardUpload;
  if (cardUpload) {
    config.cardImage = cardUpload;
  } else if (str(fd, "clearCardImage") === "1") {
    delete config.cardImage;
  }

  store.updateSite(site.id, { config });
  revalidatePath("/dashboard/builder");
  revalidatePath(`/s/${site.slug}`);
  return { ok: true };
}

export async function setCustomDomainAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!getPlan(site.plan).customDomain) return { error: "Custom domains need the Pro plan — upgrade below." };
  const hostname = cleanHostname(str(fd, "hostname"));
  if (!hostname) return { error: "Enter just your domain, like janedoe.com — no https:// or paths needed." };
  if (platformHosts().has(hostname)) return { error: "That domain is reserved." };
  if (store.domainTaken(hostname, site.id)) return { error: "That domain is already connected to another Ensemble page." };
  store.setCustomDomain(site.id, hostname);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function removeCustomDomainAction(): Promise<void> {
  const { site } = await requireSite();
  store.deleteCustomDomain(site.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function togglePublish(): Promise<void> {
  const { site } = await requireSite();
  // Publishing requires an active subscription once billing is configured.
  if (!site.published && !billingOk(site)) {
    redirect("/dashboard?billing=required");
  }
  store.updateSite(site.id, { published: !site.published });
  revalidateSite(site);
}

export async function changePlan(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const planId = str(fd, "plan");
  if (!(planId in PLANS)) return;

  if (billingEnabled()) {
    const user = await requireUser();
    // A webhook may not have landed yet — ask Stripe for the truth first.
    let current = site;
    try {
      current = await reconcileBilling(site);
    } catch {
      // Stripe unreachable: fall through to the state we have.
    }
    if (current.stripeSubscriptionId && billingOk(current)) {
      // Existing subscription: swap the price (prorated). The webhook confirms
      // the change, but we update optimistically so the UI reflects it now.
      try {
        await changeSubscriptionPlan(current.stripeSubscriptionId, planId as Plan);
      } catch {
        redirect("/dashboard/settings?billing=error");
      }
      store.updateSite(site.id, { plan: planId });
    } else {
      // No live subscription — checkout for the chosen plan. The plan is NOT
      // persisted here: it travels in the session metadata and is applied by
      // the checkout.session.completed webhook only after payment.
      let checkoutUrl: string;
      try {
        checkoutUrl = await createCheckoutUrl(current, user, planId as Plan);
      } catch {
        redirect("/dashboard/settings?billing=error");
      }
      redirect(checkoutUrl);
    }
  } else {
    store.updateSite(site.id, { plan: planId });
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/builder");
  revalidatePath(`/s/${site.slug}`);
}

/** Restart checkout for a site whose subscription never started or lapsed. */
export async function resumeCheckout(): Promise<void> {
  const user = await requireUser();
  let site = store.getSiteByUser(user.id);
  if (!site) redirect("/onboarding");
  if (!billingEnabled() || billingOk(site)) redirect("/dashboard");
  // If a just-paid checkout's webhook hasn't landed, Stripe already has the
  // subscription — reconcile instead of selling a second one.
  try {
    site = await reconcileBilling(site);
  } catch {
    // Stripe unreachable: proceed with what we have.
  }
  if (billingOk(site)) redirect("/dashboard?billing=success");
  let checkoutUrl: string;
  try {
    checkoutUrl = await createCheckoutUrl(site, user, site.plan);
  } catch {
    redirect("/dashboard?billing=error");
  }
  redirect(checkoutUrl);
}

/** Open the Stripe customer portal (payment method, invoices, cancel). */
export async function openBillingPortal(): Promise<void> {
  const { site } = await requireSite();
  if (!billingEnabled() || !site.stripeCustomerId) redirect("/dashboard/settings");
  let portalUrl: string;
  try {
    portalUrl = await createPortalUrl(site.stripeCustomerId);
  } catch {
    redirect("/dashboard/settings?billing=error");
  }
  redirect(portalUrl);
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

/* ---------------- chatroom ---------------- */

export async function postChatMessage(_prev: FormState, fd: FormData): Promise<FormState> {
  const siteId = Number(str(fd, "siteId"));
  const site = store.getSiteById(siteId);
  if (!site) return { error: "Page not found." };
  if (!site.published) {
    // Drafts accept messages only from their owner (dashboard chatroom).
    const user = await getCurrentUser();
    if (!user || user.id !== site.userId) return { error: "Page not found." };
  }
  const plan = getPlan(site.plan);
  if (!plan.chatroom || site.config.chatroomEnabled === false) return { error: "Chat is not enabled on this page." };

  const author = str(fd, "author").slice(0, 40) || "anon";
  const body = str(fd, "body").slice(0, 500);
  if (!body) return { error: "Write a message first." };

  store.addChatMessage(siteId, author, body);
  revalidatePath(`/s/${site.slug}`);
  revalidatePath("/dashboard/chatroom");
  return { ok: true };
}

export async function deleteChatMessageAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "messageId"));
  const message = store.getChatMessage(id);
  if (!message || message.siteId !== site.id) return;
  store.deleteChatMessage(id);
  revalidatePath("/dashboard/chatroom");
  revalidatePath(`/s/${site.slug}`);
}

export async function toggleChatroom(): Promise<void> {
  const { site } = await requireSite();
  if (!getPlan(site.plan).chatroom) return;
  store.updateSite(site.id, {
    config: { ...site.config, chatroomEnabled: site.config.chatroomEnabled === false },
  });
  revalidatePath("/dashboard/chatroom");
  revalidatePath("/dashboard/integrations");
  revalidatePath(`/s/${site.slug}`);
}

/* ---------------- audience ---------------- */

export async function deleteLeadAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "leadId"));
  const lead = store.getLead(id);
  if (!lead || lead.siteId !== site.id) return;
  store.deleteLead(id);
  revalidatePath("/dashboard/audience");
  revalidatePath("/dashboard/integrations");
}

/* ---------------- connect website ---------------- */

export async function regenerateEmbedTokenAction(): Promise<void> {
  const { site } = await requireSite();
  store.regenerateEmbedToken(site.id);
  revalidatePath("/dashboard/connect");
}

async function scanIntoInventory(siteId: number, rawUrl: string): Promise<FormState> {
  const checked = validateSiteUrl(rawUrl);
  if ("error" in checked) return { error: checked.error };
  let html: string;
  try {
    html = await fetchSiteHtml(checked.url);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't reach that website." };
  }
  const items = extractContent(html, checked.url);
  if (items.length === 0) return { error: "Couldn't find any editable content on that page." };
  store.upsertConnection(siteId, checked.url.href);
  store.replaceSiteContent(siteId, items);
  revalidatePath("/dashboard/connect");
  return { ok: true };
}

export async function connectWebsite(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  const url = str(fd, "url");
  if (!url) return { error: "Enter your website's address." };
  return scanIntoInventory(site.id, url);
}

export async function rescanWebsite(_prev: FormState, _fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  const connection = store.getConnection(site.id);
  if (!connection) return { error: "Connect a website first." };
  return scanIntoInventory(site.id, connection.url);
}

export async function saveWebsiteContent(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const items = store.getSiteContent(site.id);
  for (const item of items) {
    const raw = fd.get(`content_${item.id}`);
    if (typeof raw !== "string") continue;
    let value = raw.trim();
    if (item.kind === "text") value = value.replace(/\s+/g, " ");
    if (item.kind === "video") value = embedUrl(value) ?? value;
    if (item.kind !== "text" && value && !/^https?:\/\//.test(value)) continue;
    // Matching the original (or blanking a URL field) reverts the override.
    const edited = value === "" || value === item.original ? null : value;
    if (edited !== item.edited) store.setContentEdit(site.id, item.id, edited);
  }
  revalidatePath("/dashboard/connect");
}

export async function toggleConnection(): Promise<void> {
  const { site } = await requireSite();
  const connection = store.getConnection(site.id);
  if (!connection) return;
  store.setConnectionEnabled(site.id, !connection.enabled);
  revalidatePath("/dashboard/connect");
}

export async function disconnectWebsite(): Promise<void> {
  const { site } = await requireSite();
  store.deleteConnection(site.id);
  revalidatePath("/dashboard/connect");
}

/* ---------------- social media ---------------- */

export async function connectSocial(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!getPlan(site.plan).social) return { error: "Social accounts are a Pro feature — upgrade in Settings." };
  const platform = getPlatform(str(fd, "platform"));
  if (!platform) return { error: "Unknown platform." };

  if (platform.authType === "bluesky") {
    const handle = cleanHandle(str(fd, "handle"));
    const secret = str(fd, "secret");
    if (!handle || !secret) return { error: "Enter your Bluesky handle and an app password." };
    try {
      // Verify the credentials against Bluesky before storing anything.
      await blueskySession(handle, secret);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Bluesky sign-in failed." };
    }
    store.upsertSocialAccount(site.id, platform.id, handle, { authKind: "bluesky", secret });
  } else if (platform.authType === "webhook") {
    const secret = str(fd, "secret") || str(fd, "handle");
    if (!isDiscordWebhook(secret)) {
      return { error: "Paste a Discord webhook URL (Server Settings → Integrations → Webhooks → New Webhook)." };
    }
    store.upsertSocialAccount(site.id, platform.id, "channel webhook", { authKind: "webhook", secret });
  } else {
    const handle = cleanHandle(str(fd, "handle"));
    if (!handle) return { error: "Enter your handle or profile URL." };
    store.upsertSocialAccount(site.id, platform.id, handle);
  }

  revalidatePath("/dashboard/integrations");
  return { ok: true };
}

export async function disconnectSocial(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  store.deleteSocialAccount(site.id, str(fd, "platform"));
  revalidatePath("/dashboard/integrations");
}

export async function createSocialPostAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!getPlan(site.plan).social) return { error: "Posting is a Pro feature — upgrade in Settings." };
  const body = str(fd, "body").slice(0, 2000);
  if (!body) return { error: "Write something to post." };
  const mediaUrl = str(fd, "mediaUrl");
  if (mediaUrl && !/^https?:\/\//.test(mediaUrl)) return { error: "The media link must be a full http(s) URL." };

  const connected = new Set(store.getSocialAccounts(site.id).map((a) => a.platform));
  const platforms = fd.getAll("platforms").map(String).filter((p) => connected.has(p));
  if (platforms.length === 0) return { error: "Pick at least one connected platform." };

  const postId = store.createSocialPost(site.id, body, mediaUrl, platforms);
  await publishPost(site.id, postId);
  revalidatePath("/dashboard/integrations");
  return { ok: true };
}

/** Re-attempt delivery of a post's queued/failed targets. */
export async function retrySocialPost(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  if (!getPlan(site.plan).social) return;
  const postId = Number(str(fd, "postId"));
  if (postId) await publishPost(site.id, postId);
  revalidatePath("/dashboard/integrations");
}

export async function saveLiveStreams(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!getPlan(site.plan).live) return { error: "Live streams are an Enterprise feature — upgrade in Settings." };
  const rawTwitch = str(fd, "twitchChannel");
  const rawFacebook = str(fd, "facebookLiveUrl");
  const rawInstagram = str(fd, "instagramLiveUser");

  const twitchChannel = cleanTwitchChannel(rawTwitch);
  if (rawTwitch && !twitchChannel) return { error: "That doesn't look like a Twitch channel name." };
  const facebookLiveUrl = cleanFacebookLiveUrl(rawFacebook);
  if (rawFacebook && !facebookLiveUrl) return { error: "The Facebook Live link must be an https facebook.com video URL." };
  const instagramLiveUser = cleanInstagramUser(rawInstagram);
  if (rawInstagram && !instagramLiveUser) return { error: "That doesn't look like an Instagram username." };

  store.updateSite(site.id, {
    config: {
      ...site.config,
      twitchChannel,
      facebookLiveUrl,
      instagramLiveUser,
      twitchStreamKey: str(fd, "twitchStreamKey"),
      facebookStreamKey: str(fd, "facebookStreamKey"),
      instagramStreamKey: str(fd, "instagramStreamKey"),
    },
  });
  revalidatePath("/dashboard/integrations");
  revalidatePath(`/s/${site.slug}`);
  return { ok: true };
}

/** Flip everything live at once and announce it to every connected platform. */
export async function goLive(_prev: FormState, _fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!getPlan(site.plan).live) return { error: "Going live is an Enterprise feature — upgrade in Settings." };
  const c = site.config;
  const destinations: string[] = [];
  if (c.twitchChannel) destinations.push(`twitch.tv/${c.twitchChannel}`);
  if (c.facebookLiveUrl) destinations.push("Facebook Live");
  if (c.instagramLiveUser) destinations.push(`instagram.com/${c.instagramLiveUser}`);
  if (destinations.length === 0) {
    return { error: "Link at least one live platform below before going live." };
  }

  store.updateSite(site.id, { config: { ...c, liveNow: true } });

  // Auto-announce on every connected social account.
  const platforms = store.getSocialAccounts(site.id).map((a) => a.platform);
  if (platforms.length > 0) {
    const postId = store.createSocialPost(site.id, `I'm live right now — come watch: ${destinations.join(" · ")}`, "", platforms);
    await publishPost(site.id, postId);
  }

  revalidatePath("/dashboard/integrations");
  revalidatePath(`/s/${site.slug}`);
  return { ok: true };
}

export async function endLive(): Promise<void> {
  const { site } = await requireSite();
  store.updateSite(site.id, { config: { ...site.config, liveNow: false } });
  revalidatePath("/dashboard/integrations");
  revalidatePath(`/s/${site.slug}`);
}

/* ---------------- support ---------------- */

export async function createTicketAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const site = store.getSiteByUser(user.id);
  if (!site || !getPlan(site.plan).helpdesk) return { error: "Support isn't available on your plan." };
  if (!billingOk(site)) return { error: "Help desk opens once your subscription is active." };

  const subject = str(fd, "subject").slice(0, 120);
  const body = str(fd, "body").slice(0, 2000);
  if (!subject || !body) return { error: "Subject and message are both required." };

  store.createTicket(user.id, subject, body);
  revalidatePath("/dashboard/support");
  revalidatePath("/admin");
  return { ok: true };
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

export async function replyTicket(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) return;
  const id = Number(str(fd, "ticketId"));
  const reply = str(fd, "reply");
  store.updateTicket(id, { reply, status: reply ? "answered" : undefined });
  revalidatePath("/admin");
  revalidatePath("/dashboard/support");
}

export async function setTicketStatus(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) return;
  const id = Number(str(fd, "ticketId"));
  const status = str(fd, "status");
  if (!["open", "answered", "closed"].includes(status)) return;
  store.updateTicket(id, { status });
  revalidatePath("/admin");
  revalidatePath("/dashboard/support");
}
