"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as store from "./db";
import { ADMIN_EMAIL, endSession, getCurrentUser, hashPassword, requireUser, startSession, verifyPassword } from "./auth";
import { getPlan, PLANS } from "./plans";
import { embedUrl, getTemplate, planAllowsTemplate } from "./sections";
import { extractContent, fetchSiteHtml, validateSiteUrl } from "./scrape";
import { cleanFacebookLiveUrl, cleanHandle, cleanInstagramUser, cleanTwitchChannel, getPlatform, isDiscordWebhook } from "./social";
import { blueskySession, publishPost } from "./publish";
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

/* ---------------- chatroom ---------------- */

export async function postChatMessage(_prev: FormState, fd: FormData): Promise<FormState> {
  const siteId = Number(str(fd, "siteId"));
  const site = store.getSiteById(siteId);
  if (!site) return { error: "Page not found." };
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
  const postId = Number(str(fd, "postId"));
  if (postId) await publishPost(site.id, postId);
  revalidatePath("/dashboard/integrations");
}

export async function saveLiveStreams(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
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
  if (!site || !getPlan(site.plan).helpdesk) return { error: "Help desk support is an Enterprise feature." };

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
