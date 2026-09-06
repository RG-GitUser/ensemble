"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cleanDay, todayISO } from "./followers";
import * as store from "./db";
import {
  ADMIN_EMAIL,
  currentSessionToken,
  endSession,
  getCurrentUser,
  hashPassword,
  needsRehash,
  requireUser,
  startSession,
  verifyPassword,
} from "./auth";
import { PLANS } from "./plans";
import {
  embedUrl,
  getTemplate,
  planAllowsTemplate,
  RECOMMENDED_ORDER,
  safeCreatorUrl,
  STARTER_SECTIONS,
  starterContent,
} from "./sections";
import { getThemeDef } from "./themes";
import { cleanFacebookLiveUrl, cleanHandle, cleanInstagramUser, cleanTwitchChannel, DEFAULT_METRIC, getMetric, getPlatform, isDiscordWebhook, parseCount } from "./social";
import { blueskySession, publishPost, summarisePublish } from "./publish";
import {
  mailEnabled,
  maskEmail,
  sendBackupVerification,
  sendLoginChangedNotice,
  sendLoginRecovery,
  sendNewsletter,
  sendPasswordReset,
  sendSecurityNotice,
} from "./mailer";
import { QUOTE_ACCESS_METHODS, QUOTE_FILE_MAX_BYTES, QUOTE_PLATFORMS } from "./quotes";
import { randomBytes } from "node:crypto";
import { checkDomainOwnership } from "./domain-verify";
import { cleanHostname, platformHosts } from "./domains";
import { isReservedSlug } from "./slugs";
import { forwardSubscriber, getEmailProvider } from "./email-providers";
import { clientIp, LIMITS, rateLimit } from "./ratelimit";
import { fetchPageHtml, inspectSnippet, UnsafeUrlError, validateSiteUrl, type SnippetCheck } from "./siteurl";
import {
  ACCENTS,
  BACKGROUNDS,
  clampMinHeight,
  clampSize,
  TEXT_ALIGNS,
  CONTAINERS,
  DEFAULT_BG,
  DEFAULT_BORDER,
  DEFAULT_CARD,
  DEFAULT_CORNER,
  DEFAULT_SIZE,
  DEFAULT_LAYOUT,
  DEFAULT_SPACING,
  getCorner,
  getSpacing,
  DEFAULT_LIGHT_BG,
  DEFAULT_LIGHT_CARD,
  getBorderStyle,
  getColorMode,
  DEFAULT_BULLET_SHAPE,
  DEFAULT_BUTTON_STYLE,
  DEFAULT_MARKER,
  DEFAULT_FRAME,
  DEFAULT_GLOW,
  DEFAULT_CONTAINER_HOVER,
  DEFAULT_BUTTON_HOVER,
  getContainerHover,
  getButtonHover,
  DEFAULT_GLOW_SIZE,
  getGlowSize,
  getBulletShape,
  getButtonStyle,
  getMarkerMode,
  getMarkerPosition,
  getFrame,
  getGlow,
  getLayout,
  LIGHT_BACKGROUNDS,
  LIGHT_CONTAINERS,
  MAX_LOOKS,
  normalizeHex,
  pickColor,
  pickSwatch,
} from "./theme";
import {
  DEFAULT_FONT,
  DEFAULT_TEXT_SIZE_ID,
  getTextSize,
  DEFAULT_LIGHT_TEXT_COLOR,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  FONTS,
  LIGHT_TEXT_COLORS,
  TEXT_COLORS,
  TEXT_SIZES,
} from "./fonts";
import {
  billingEnabled,
  billingOk,
  billingPreviewMode,
  cancelSubscription,
  changeSubscriptionPlan,
  effectivePlan,
  createCheckoutUrl,
  createPortalUrl,
  reconcileBilling,
  planFor,
} from "./billing";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { DesignConfig, Plan, Site, SiteConfig } from "./types";

export interface FormState {
  error?: string;
  ok?: boolean;
  /** A success line to show in place of the form's own copy. */
  message?: string;
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
  // Reserved names are unavailable for the same reason taken ones are: the
  // resulting page would never be reachable at the root.
  while (store.slugTaken(slug) || isReservedSlug(slug)) slug = `${slugify(base)}-${++n}`;
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
  // Publish state and domain status surface on these two as well.
  revalidatePath("/dashboard/connect");
  revalidatePath("/dashboard/settings");
  // The Shop tab is a second editor over the merch section, so any section
  // change may move its ground out from under it.
  revalidatePath("/dashboard/shop");
  revalidatePath(`/${site.slug}`);
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

  const user = store.createUser(email, await hashPassword(password), name, businessName);
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

/**
 * A syntactically valid hash that no password matches, used to spend the same
 * scrypt work on an unknown address as on a known one. Returning early made
 * "no such account" measurably faster than "wrong password", which is a clean
 * way to enumerate who has an account here — undoing the care taken to make
 * /forgot and /recover enumeration-safe.
 */
const DUMMY_PASSWORD_HASH = `scrypt$16384$8$1$${"0".repeat(32)}$${"0".repeat(128)}`;

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");

  // Every other credential endpoint was throttled; this one was not, in front
  // of a synchronous scrypt, against an admin address published in this repo.
  const ipLimit = rateLimit(`login:${await clientIp()}`, LIMITS.login);
  if (!ipLimit.ok) return { error: "Too many sign-in attempts. Try again in a few minutes." };
  // Per account as well: an IP budget alone does nothing against a distributed
  // attempt on one known address, which is the shape this actually takes.
  if (email) {
    const accountLimit = rateLimit(`login-account:${email}`, LIMITS.loginAccount);
    if (!accountLimit.ok) {
      return { error: "Too many sign-in attempts for that account. Try again in a few minutes." };
    }
  }

  const user = store.getUserByEmail(email);
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) return { error: "Invalid email or password." };

  // Now that the password is known-good, quietly upgrade a hash written with
  // weaker parameters. This is what makes raising the cost possible at all.
  if (needsRehash(user.passwordHash)) {
    store.setPasswordHash(user.id, await hashPassword(password));
  }

  await startSession(user.id);
  const site = store.getSiteByUser(user.id);
  const quote = store.getQuoteByUser(user.id);
  redirect(site || quote ? "/dashboard" : "/onboarding");
}

/**
 * Change the password from inside the account.
 *
 * There was no way to do this: sessions last thirty days, endSession drops
 * only the caller's own token, and the sole route to a new password was the
 * emailed reset. Requiring the current password is what makes this a
 * re-authentication rather than something a borrowed laptop can do, and
 * dropping the other sessions is the point of the exercise.
 */
export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = str(fd, "currentPassword");
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Those two passwords don't match." };

  const limit = rateLimit(`change-password:${user.id}`, LIMITS.loginAccount);
  if (!limit.ok) return { error: "Too many attempts. Try again in a few minutes." };

  const stored = store.getUserByEmail(user.email);
  if (!stored || !(await verifyPassword(current, stored.passwordHash))) {
    return { error: "That isn't your current password." };
  }

  store.setPasswordHash(user.id, await hashPassword(password));
  const token = await currentSessionToken();
  const signedOut = token ? store.deleteSessionsExcept(user.id, token) : 0;
  await sendSecurityNotice({
    to: user.email,
    subject: "Your Ensemble password was changed",
    line: "If this wasn't you, reset your password immediately and check your recovery address in Settings.",
  });
  revalidatePath("/dashboard/profile");
  return {
    ok: true,
    message: signedOut
      ? `Password changed. ${signedOut} other ${signedOut === 1 ? "browser was" : "browsers were"} signed out.`
      : "Password changed.",
  };
}

/**
 * How long a reset link stays good. Long enough to find the mail and act on
 * it, short enough that a link sitting in a mailbox is not a standing key.
 */
const RESET_TTL_MINUTES = 45;

/**
 * Ceiling on one broadcast.
 *
 * Sends are batched 100 at a time, sequentially, so a long list can outrun the
 * request timeout. Refusing past this is honest; silently truncating is not.
 */
const MAX_NEWSLETTER_RECIPIENTS = 5_000;

/**
 * Ask for a reset link.
 *
 * Always reports success, whether or not the address has an account. The
 * response to an unknown address has to be indistinguishable from the response
 * to a known one, or this form becomes a way to test which addresses are
 * registered. That is also why a mail failure is not surfaced: "we couldn't
 * send it" confirms the account exists just as loudly as sending it would.
 *
 * Rate limited per address so the form cannot be used to mailbomb someone.
 */
export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const byIp = rateLimit(`reset:${await clientIp()}`, LIMITS.passwordReset);
  if (!byIp.ok) return { error: "Too many attempts. Try again in a few minutes." };
  // Per address too. Without this the form really could be used to mailbomb
  // someone from a pool of addresses, and a corporate NAT locked colleagues
  // out of each other's resets while the mailbomb stayed open.
  const byAddress = rateLimit(`reset-to:${email}`, LIMITS.passwordReset);
  if (!byAddress.ok) {
    return { ok: true, message: "If there's an account for that address, a reset link is on its way." };
  }

  const user = store.getUserByEmail(email);
  // A locked account (the demo page) must not be mailable a way in — its whole
  // premise is that nobody can log into it. Silently doing nothing keeps the
  // response indistinguishable from an unknown address.
  if (user && !store.isLockedAccount(user.passwordHash)) {
    const token = randomBytes(32).toString("base64url");
    store.createAuthToken(token, user.id, "password_reset", Date.now() + RESET_TTL_MINUTES * 60_000);
    const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    await sendPasswordReset({
      to: user.email,
      url: `${base}/reset/${token}`,
      expiresMinutes: RESET_TTL_MINUTES,
    });
  }
  return { ok: true, message: "If there's an account for that address, a reset link is on its way." };
}

/**
 * Spend a reset link and set the new password.
 *
 * The token is checked and consumed inside one transaction, so a link that is
 * submitted twice — a double-click, a resubmitted form — changes the password
 * once and reports the second attempt as expired.
 */
export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Those two passwords don't match." };

  const limit = rateLimit(`reset-submit:${await clientIp()}`, LIMITS.passwordReset);
  if (!limit.ok) return { error: "Too many attempts. Try again in a few minutes." };

  // Check the token BEFORE hashing. Hashing first meant every junk token cost
  // a full scrypt, so this form was a second way to burn the event loop.
  // consumePasswordReset re-checks and spends it atomically below, so this is
  // a cheap pre-filter rather than the actual guard.
  if (!store.getAuthToken(token, "password_reset")) {
    return { error: "That link has expired or was already used. Ask for a new one." };
  }

  if (!store.consumePasswordReset(token, await hashPassword(password))) {
    return { error: "That link has expired or was already used. Ask for a new one." };
  }
  redirect("/login?reset=1");
}

/**
 * Set or replace the recovery address. Nothing is trusted until confirmed.
 *
 * Requires the current password. A confirmed recovery address can change both
 * the login address and the password, so setting one is equivalent to handing
 * over the account — and it previously needed nothing but a live session.
 * Someone with a borrowed laptop added their own address, confirmed it from
 * their own mailbox, and the owner was never told; the owner then "secured"
 * the account with a password reset, which drops sessions but left the
 * attacker's verified recovery address in place.
 */
export async function setBackupEmail(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const email = str(fd, "backupEmail").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (email === user.email.toLowerCase()) {
    return { error: "That's already your login address. A recovery address has to be a different inbox." };
  }
  if (!mailEnabled()) return { error: "Email sending isn't switched on for this server, so the address can't be confirmed." };

  const limit = rateLimit(`backup:${await clientIp()}`, LIMITS.recovery);
  if (!limit.ok) return { error: "Too many attempts. Try again in a few minutes." };

  const stored = store.getUserByEmail(user.email);
  if (!stored || !(await verifyPassword(str(fd, "currentPassword"), stored.passwordHash))) {
    return { error: "Enter your current password to change your recovery address." };
  }

  // The address rides on the token rather than being written to the account,
  // so an unconfirmed address is never a way in and a typo cannot lock anyone
  // out of the recovery path they already had.
  const token = randomBytes(32).toString("base64url");
  store.createAuthToken(token, user.id, "verify_backup", Date.now() + RESET_TTL_MINUTES * 60_000, email);
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  await sendBackupVerification({
    to: email,
    url: `${base}/verify-backup/${token}`,
    expiresMinutes: RESET_TTL_MINUTES,
    account: maskEmail(user.email),
  });
  // The login address is told, always. It is the one mailbox that must never
  // learn about a recovery-address change after the fact.
  await sendSecurityNotice({
    to: user.email,
    subject: "A recovery address was added to your Ensemble account",
    line: `A confirmation link was sent to ${maskEmail(email)}. If this wasn't you, change your password now — that removes the pending link.`,
  });
  revalidatePath("/dashboard/settings");
  return { ok: true, message: `Confirmation sent to ${email}. It becomes your recovery address once you open the link.` };
}

/**
 * Spend a recovery-address confirmation link.
 *
 * A POST behind a button, not a side effect of rendering. Confirming grants
 * the power to change the account's login address AND password, and the old
 * page spent the token on GET — so a mistyped address reached a stranger who
 * confirmed out of curiosity, or a mail provider that prefetches links did it
 * with no human involved at all. "The token is single-use so a prefetch only
 * costs a re-send" was true for a password reset and false for this one: here
 * the prefetch IS the grant.
 */
export async function confirmBackupEmail(fd: FormData): Promise<void> {
  const token = str(fd, "token");
  const limit = rateLimit(`verify-backup:${await clientIp()}`, LIMITS.recovery);
  if (!limit.ok) redirect(`/verify-backup/${token}?state=expired`);

  const pending = store.getAuthToken(token, "verify_backup");
  if (!pending) redirect(`/verify-backup/${token}?state=expired`);

  const confirmed = store.consumeBackupVerification(token);
  if (confirmed) {
    // The login address hears about it either way — this is the change that
    // decides who can take the account back later.
    await sendSecurityNotice({
      to: pending.user.email,
      subject: "A recovery address was confirmed on your Ensemble account",
      line:
        `${maskEmail(pending.payload)} can now be used to recover this account. ` +
        `If this wasn't you, change your password now — that removes the address and any link issued for it.`,
    });
  }
  redirect(`/verify-backup/${token}?state=${confirmed ? "done" : "expired"}`);
}

/** Drop the recovery address, and any link already issued against it. */
export async function removeBackupEmail(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const limit = rateLimit(`backup-remove:${user.id}`, LIMITS.recovery);
  if (!limit.ok) return { error: "Too many attempts. Try again in a few minutes." };

  const stored = store.getUserByEmail(user.email);
  if (!stored || !(await verifyPassword(str(fd, "currentPassword"), stored.passwordHash))) {
    return { error: "Enter your current password to remove your recovery address." };
  }
  store.clearBackupEmail(user.id);
  await sendSecurityNotice({
    to: user.email,
    subject: "The recovery address on your Ensemble account was removed",
    line: "If this wasn't you, change your password now.",
  });
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Recovery address removed." };
}

/**
 * Recovery, step one: someone knows their recovery address but not the address
 * they log in with.
 *
 * Answers identically whether or not the address is a verified backup, for the
 * same reason the password form does — this must not become a way to test
 * which addresses are registered anywhere.
 */
export async function requestLoginRecovery(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const byIp = rateLimit(`recover:${await clientIp()}`, LIMITS.recovery);
  if (!byIp.ok) return { error: "Too many attempts. Try again in a few minutes." };
  const byAddress = rateLimit(`recover-to:${email}`, LIMITS.recovery);
  if (!byAddress.ok) {
    return { ok: true, message: "If that's a confirmed recovery address, a way back in is on its way to it." };
  }

  const user = store.getUserByBackupEmail(email);
  if (user) {
    const token = randomBytes(32).toString("base64url");
    store.createAuthToken(token, user.id, "recover_login", Date.now() + RESET_TTL_MINUTES * 60_000);
    const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    await sendLoginRecovery({ to: email, url: `${base}/recover/${token}`, expiresMinutes: RESET_TTL_MINUTES });
  }
  return { ok: true, message: "If that's a confirmed recovery address, a way back in is on its way to it." };
}

/**
 * Recovery, step two: set the login address and password together.
 *
 * Both at once because someone who has lost track of which address they used
 * has almost certainly lost the password with it, and they have already proved
 * they can read the recovery mailbox.
 */
export async function recoverLogin(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = str(fd, "token");
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Those two passwords don't match." };

  const limit = rateLimit(`recover-submit:${await clientIp()}`, LIMITS.recovery);
  if (!limit.ok) return { error: "Too many attempts. Try again in a few minutes." };

  const pending = store.getAuthToken(token, "recover_login");
  if (!pending) return { error: "That link has expired or was already used. Ask for a new one." };

  // Checked before spending the token so a clash leaves the link usable.
  const taken = store.getUserByEmail(email);
  if (taken && taken.id !== pending.user.id) {
    return { error: "Another account already uses that address. Pick a different one." };
  }

  const previous = pending.user.email;
  if (!store.consumeLoginRecovery(token, email, await hashPassword(password))) {
    return { error: "That link has expired or was already used. Ask for a new one." };
  }
  // The address being replaced should never be the last to know.
  if (previous.toLowerCase() !== email) await sendLoginChangedNotice({ to: previous, newEmail: email });

  // Actually sign them in, which is what the button says. This used to redirect
  // to a bare login form — at the exact moment the person had just proved they
  // could not remember their login address. consumeLoginRecovery drops every
  // session first, so this is a single fresh one.
  await startSession(pending.user.id);
  redirect("/dashboard?recovered=1");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}

/** Wipe collected data (Profile → danger zone). The page and account stay. */
export async function deleteMyData(): Promise<void> {
  const user = await requireUser();
  const site = store.getSiteByUser(user.id);
  if (site) store.deleteSiteData(site.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
}

/**
 * Delete the account and everything under it, then end the session. The
 * admin account is refused: it anchors the seeded pages and the /admin inbox,
 * and bricking the platform should take more than one dialog.
 *
 * Order matters. The subscription is cancelled and the files are removed while
 * the rows naming them still exist — the cascade takes stripe_subscription_id
 * and the quote's file name with it, and afterwards there is nothing left to
 * find them by. The dialog promises "nothing is recoverable afterwards", and
 * this is what has to be true for that sentence to be honest: uploaded quote
 * zips (up to 25MB of a customer's own project source) and every theme,
 * profile and favicon image used to survive on disk and in every backup.
 */
export async function deleteMyAccount(): Promise<void> {
  const user = await requireUser();
  if (user.email === ADMIN_EMAIL) return;

  const site = store.getSiteByUser(user.id);
  const quote = store.getQuoteByUser(user.id);

  if (site?.stripeSubscriptionId && billingEnabled()) {
    try {
      await cancelSubscription(site.stripeSubscriptionId);
    } catch (err) {
      // Keep the pointer rather than dropping it. An orphan we can see is a
      // support ticket; an orphan we cannot see is a card being charged
      // forever with no record of who to refund.
      console.error(`Could not cancel subscription ${site.stripeSubscriptionId} during account deletion:`, err);
      store.recordBillingOrphan({
        stripeCustomerId: site.stripeCustomerId,
        stripeSubscriptionId: site.stripeSubscriptionId,
        userEmail: user.email,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (site) deleteSiteAssets(site.id);
  if (quote?.fileName) deleteUploadedFile(quote.fileName);

  store.deleteUserAccount(user.id);
  await endSession();
  redirect("/");
}

/* ---------------- follower counts ---------------- */

/**
 * Record follower counts for one date.
 *
 * Blank fields are skipped rather than stored as zero: leaving a platform
 * empty means "I didn't check that one", and writing 0 would claim the
 * creator lost every follower they had. A count of 0 typed deliberately is
 * still honoured — it's the empty string that's treated as absent.
 */
export async function logFollowerCounts(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const day = cleanDay(str(fd, "day")) || todayISO();
  // A date in the future would sit past the right-hand edge of every chart and
  // describe a count nobody can have taken yet.
  if (day > todayISO()) redirect("/dashboard/analytics?tab=followers&error=future");

  let wrote = 0;
  for (const account of store.getSocialAccounts(site.id)) {
    const raw = str(fd, `count_${account.platform}`);
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) continue;
    store.recordFollowerCount(site.id, account.platform, day, n);
    wrote++;
  }

  revalidatePath("/dashboard/analytics");
  redirect(`/dashboard/analytics?tab=followers&on=${day}${wrote ? "" : "&error=empty"}`);
}

/** Remove a single reading — the way out of a figure typed on the wrong date. */
export async function deleteFollowerCount(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const platform = str(fd, "platform");
  const day = cleanDay(str(fd, "day"));
  if (!platform || !day) return;
  store.deleteFollowerCount(site.id, platform, day);
  revalidatePath("/dashboard/analytics");
  redirect(`/dashboard/analytics?tab=followers&on=${day}`);
}

/* ---------------- onboarding ---------------- */

export async function startFromScratch(fd: FormData): Promise<void> {
  const user = await requireUser();
  const planId = str(fd, "plan");
  if (!(planId in PLANS)) redirect("/onboarding");
  if (store.getSiteByUser(user.id)) redirect("/dashboard");

  const config: SiteConfig = { themeColor: "#8b5cf6", tagline: "" };
  const site = store.createSite(user.id, uniqueSlug(user.businessName), planId, config);

  // Seed a starter page so the builder never starts empty. What goes in comes
  // from starterContent, which the setup checklist also reads to work out
  // which sections are still untouched.
  for (const type of STARTER_SECTIONS) {
    store.addSection(site.id, type, starterContent(type, user.businessName));
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
  const plan = planFor(site);
  if (!planAllowsTemplate(effectivePlan(site), tpl)) return;
  if (store.countSections(site.id) >= plan.maxSections) return;
  // One of each kind per page. Two Hero sections or two Link Lists is nearly
  // always a misclick, and the page it produces reads as a mistake — the
  // gallery disables an added type, and this is the same rule server-side.
  if (store.getSections(site.id).some((s) => s.type === type)) return;
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
  // `url` fields are scheme-checked as they are stored, so the renderer is not
  // the only thing standing between a creator's content and a data:/blob: URL.
  for (const f of tpl.fields) {
    const raw = str(fd, `field_${f.key}`);
    content[f.key] = f.kind === "url" ? safeCreatorUrl(raw) : raw;
  }

  // The portrait is offered on every container rather than declared per
  // template, so it sits outside tpl.fields. The loop above rebuilds content
  // from scratch, which would drop it on every unrelated save, so it has to be
  // carried across here: a new upload wins, an explicit remove clears it, and
  // otherwise whatever was there stays.
  const upload = await themeImageFrom(fd, "sectionImageFile", site.id, "profile");
  if (typeof upload === "string") content.profileImage = upload;
  else if (str(fd, "clearSectionImage") === "1") content.profileImage = "";
  else content.profileImage = section.content.profileImage ?? "";

  // Same reasoning as the portrait: offered on every container, so outside
  // tpl.fields, so the loop above would drop them. Only known bullet ids are
  // stored, and numbering is a flag rather than free text.
  content.markerMode = getMarkerMode(str(fd, "markerMode"))?.id ?? DEFAULT_MARKER;
  content.bulletShape = getBulletShape(str(fd, "bulletShape"))?.id ?? DEFAULT_BULLET_SHAPE;
  content.sectionMarker = getMarkerMode(str(fd, "sectionMarker"))?.id ?? DEFAULT_MARKER;
  content.sectionBulletShape = getBulletShape(str(fd, "sectionBulletShape"))?.id ?? DEFAULT_BULLET_SHAPE;
  content.markerPosition = getMarkerPosition(str(fd, "markerPosition"));
  content.textScale = getTextSize(str(fd, "textScale"))?.id ?? DEFAULT_TEXT_SIZE_ID;

  store.updateSectionContent(id, content);
  revalidateSite(site);
}

/**
 * The Shop tab saves through the merch section's own template fields — it is
 * a friendlier editor over that one section, not a second product store, so
 * whatever it writes is exactly what the Page Builder and the public page
 * read back.
 */
export async function saveShopAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "sectionId"));
  const section = store.getSection(id);
  if (!section || section.siteId !== site.id || section.type !== "merch") return;
  const tpl = getTemplate("merch");
  if (!tpl) return;
  const content: Record<string, string> = {};
  for (const f of tpl.fields) {
    const raw = str(fd, `field_${f.key}`);
    content[f.key] = f.kind === "url" ? safeCreatorUrl(raw) : raw;
  }

  // PATCH, not replace. updateSectionAction rebuilds content from the template
  // fields too, but then carries the portrait, marker mode, bullet shape and
  // text scale back across because they are offered on every container and so
  // sit outside tpl.fields. This editor never got that block, so a creator who
  // styled their Merch section in the Page Builder and then edited a price
  // here lost all of it — no warning, no undo. Merging is the same fix without
  // a second copy of the list to keep in step.
  store.patchSectionContent(id, content);
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

/**
 * Drag-and-drop reordering. Takes the full new order in one call because
 * Next dispatches Server Actions sequentially per client — one action per
 * moved section would queue up behind itself.
 *
 * The ids arrive from the browser, so they are only trusted as far as being
 * a permutation of what this site already owns: same length, same members,
 * no duplicates. Anything else is a malformed or hostile payload and is
 * dropped rather than partially applied.
 */
export interface SectionStylePatch {
  id: number;
  sectionMarker: string;
  sectionBulletShape: string;
  markerMode: string;
  bulletShape: string;
  markerPosition: string;
  textScale: string;
}

/**
 * Save the style rail's changes for several sections at once.
 *
 * Every value goes through the same lookup the section form uses, so a
 * tampered payload writes a known id or nothing. Ids are checked against the
 * site's own sections, so one creator cannot restyle another's page.
 */
export async function saveSectionStylesAction(patches: SectionStylePatch[]): Promise<void> {
  const { site } = await requireSite();
  if (!Array.isArray(patches)) return;
  const own = new Set(store.getSections(site.id).map((s) => s.id));

  for (const p of patches) {
    const id = Number(p?.id);
    if (!Number.isInteger(id) || !own.has(id)) continue;
    store.patchSectionContent(id, {
      sectionMarker: getMarkerMode(p.sectionMarker)?.id ?? DEFAULT_MARKER,
      sectionBulletShape: getBulletShape(p.sectionBulletShape)?.id ?? DEFAULT_BULLET_SHAPE,
      markerMode: getMarkerMode(p.markerMode)?.id ?? DEFAULT_MARKER,
      bulletShape: getBulletShape(p.bulletShape)?.id ?? DEFAULT_BULLET_SHAPE,
      markerPosition: getMarkerPosition(p.markerPosition),
      textScale: getTextSize(p.textScale)?.id ?? DEFAULT_TEXT_SIZE_ID,
    });
  }
  revalidateSite(site);
}

export async function reorderSectionsAction(orderedIds: number[]): Promise<void> {
  const { site } = await requireSite();
  if (!Array.isArray(orderedIds)) return;
  const ids = orderedIds.map(Number);
  if (ids.some((id) => !Number.isInteger(id))) return;

  const current = store.getSections(site.id).map((s) => s.id);
  if (ids.length !== current.length) return;
  if (new Set(ids).size !== ids.length) return;
  if (!ids.every((id) => current.includes(id))) return;

  store.reorderSections(site.id, ids);
  revalidateSite(site);
}

/**
 * One-click "Organize my page": restack sections into the recommended
 * content order (see RECOMMENDED_ORDER). The sort is stable, so several
 * sections of the same type keep their relative order, and unknown types
 * sink to the bottom without being dropped. Nothing is added or removed —
 * a drag can always undo it.
 */
export async function organizeSectionsAction(): Promise<void> {
  const { site } = await requireSite();
  const sections = store.getSections(site.id);
  if (sections.length < 2) return;
  const rank = (type: string) => {
    const i = RECOMMENDED_ORDER.indexOf(type);
    return i === -1 ? RECOMMENDED_ORDER.length : i;
  };
  const ordered = [...sections].sort((a, b) => rank(a.type) - rank(b.type) || a.position - b.position);
  store.reorderSections(site.id, ordered.map((s) => s.id));
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

/**
 * Empties the page — every section and everything typed into it. The
 * confirmation lives in the UI (DangerButton); this only refuses to act on a
 * page that's already empty.
 */
export async function deleteAllSectionsAction(): Promise<void> {
  const { site } = await requireSite();
  store.deleteAllSections(site.id);
  revalidateSite(site);
}

/* ---------------- tutorials ---------------- */

/** Records that this person has been through a tour, so it doesn't reappear. */
/**
 * Answer the first-sign-in walkthrough offer.
 *
 * Revalidates the whole dashboard layout, not just the page: the prompt and
 * the tour bubbles are both mounted there, so the layout has to re-read prefs
 * or the dialog stays on screen after it has been answered.
 */
export async function completeWelcomeAction(takeTour: boolean): Promise<void> {
  const user = await requireUser();
  store.completeWelcome(user.id, takeTour);
  revalidatePath("/dashboard", "layout");
}

/** Put the finished setup checklist away. */
export async function dismissSetupAction(): Promise<void> {
  const user = await requireUser();
  store.dismissSetup(user.id);
  revalidatePath("/dashboard");
}

export async function dismissTourAction(tourId: string): Promise<void> {
  const user = await requireUser();
  store.markTourSeen(user.id, tourId);
}

/**
 * The Tutorials switch. Turning them back on also clears the seen list, so
 * "on" means what people expect it to mean — show me the tips again.
 */
export async function setTutorialsAction(enabled: boolean): Promise<void> {
  const user = await requireUser();
  store.setTutorialsEnabled(user.id, enabled);
  revalidatePath("/dashboard", "layout");
}

/** The Settings switch — flips whichever way it currently isn't. */
export async function toggleTutorials(): Promise<void> {
  const user = await requireUser();
  const prefs = store.getUserPrefs(user.id);
  store.setTutorialsEnabled(user.id, !prefs.tutorialsEnabled);
  revalidatePath("/dashboard", "layout");
}

/* ---------------- finance connections ---------------- */

export async function connectFinanceStripe(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!planFor(site).payments) return { error: "Financial breakdowns are a Pro feature." };
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
  store.patchSiteConfig(site.id, { financeStripeKey: key });
  revalidatePath("/dashboard/analytics");
  return { ok: true };
}

export async function disconnectFinanceStripe(): Promise<void> {
  const { site } = await requireSite();
  store.patchSiteConfig(site.id, { financeStripeKey: "" });
  revalidatePath("/dashboard/analytics");
}

/* ---------------- design themes ---------------- */

export async function setSiteTheme(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const themeId = str(fd, "themeId");
  if (themeId && !getThemeDef(themeId)) return;
  store.patchSiteConfig(site.id, { themeId });
  revalidateSite(site);
}

/**
 * Alignment is stored on the section, so it rides with the container it
 * describes: reordering or deleting a section takes its alignment with it,
 * and no page-level value has to be kept in step.
 */
export async function setSectionAlignAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "sectionId"));
  const align = str(fd, "align");
  if (!TEXT_ALIGNS.some((a) => a.value === align)) return;
  const section = store.getSection(id);
  if (!section || section.siteId !== site.id) return;
  store.setSectionAlign(id, align);
  revalidateSite(site);
}

/** Where the section's buttons sit. Their labels are always centred. */
export async function setSectionButtonAlignAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "sectionId"));
  const align = str(fd, "align");
  if (!TEXT_ALIGNS.some((a) => a.value === align)) return;
  const section = store.getSection(id);
  if (!section || section.siteId !== site.id) return;
  store.setSectionButtonAlign(id, align);
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
  // Length rule only applies to slug changes, so sites with a shorter
  // pre-existing slug can still save their other settings.
  if (slug.length < 3 && slug !== site.slug) return { error: "Your page URL must be at least 3 characters." };
  if (store.slugTaken(slug, site.id)) return { error: "That page URL is taken — try another." };
  // Only checked when it actually changes, so a site that predates the
  // reserved list can still save its other settings.
  if (slug !== site.slug && isReservedSlug(slug)) {
    return { error: "That page URL is reserved by Ensemble — try another." };
  }
  // Page settings is the address and nothing else now. Passing no config at
  // all leaves site.config untouched, which matters because the tagline moved
  // to the Footer section and this form no longer carries it.
  store.updateSite(site.id, { slug });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  // The free-address card lives here and shows the slug back to the user.
  revalidatePath("/dashboard/connect");
  revalidatePath(`/${slug}`);
  return {};
}

/** Profile tab — the creator's own name and business name. */
export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = str(fd, "name").slice(0, 80);
  const businessName = str(fd, "businessName").slice(0, 80);
  if (!name) return { error: "Your name can't be empty." };
  if (!businessName) return { error: "Your business name can't be empty — it labels your dashboard and page." };
  store.updateUser(user.id, { name, businessName });
  // The business name is printed in the sidebar and on the public page.
  revalidatePath("/dashboard", "layout");
  const site = store.getSiteByUser(user.id);
  if (site) revalidatePath(`/${site.slug}`);
  return { ok: true };
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

/**
 * Tab icons are a narrower case than theme images: browsers only reliably
 * render a handful of formats at 16px, and the file is tiny by nature — so
 * the allowlist and the size cap are both tighter.
 */
const FAVICON_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/webp": "webp",
};
const FAVICON_MAX_BYTES = 512 * 1024;

function uploadsDir(): string {
  return path.join(process.cwd(), "data", "uploads");
}

/** The on-disk name behind a stored `/api/uploads/...` URL, or "" if it isn't one. */
function uploadNameFromUrl(url: string): string {
  const m = /^\/api\/uploads\/([\w.-]+)$/.exec(url || "");
  return m ? m[1] : "";
}

/** Remove one stored upload. Never throws — a missing file is the goal state. */
function deleteUploadedFile(name: string): void {
  if (!name) return;
  try {
    fs.unlinkSync(path.join(uploadsDir(), path.basename(name)));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Could not remove upload ${name}:`, err);
    }
  }
}

/** Remove a superseded asset once its replacement is stored. See OPS-9. */
function deleteSupersededAsset(previousUrl: string, nextUrl: string): void {
  const previous = uploadNameFromUrl(previousUrl);
  if (previous && previous !== uploadNameFromUrl(nextUrl)) deleteUploadedFile(previous);
}

/**
 * Every theme asset belonging to a site.
 *
 * Prefix-matched on the naming scheme in storeThemeAsset. `theme-1-` cannot
 * match `theme-10-...` because the trailing dash is part of the prefix.
 */
function deleteSiteAssets(siteId: number): void {
  try {
    for (const name of fs.readdirSync(uploadsDir())) {
      if (name.startsWith(`theme-${siteId}-`)) deleteUploadedFile(name);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Could not list uploads for site ${siteId}:`, err);
    }
  }
}

function storeThemeAsset(siteId: number, kind: "bg" | "card" | "icon" | "profile", data: Buffer, ext: string): string {
  fs.mkdirSync(uploadsDir(), { recursive: true });
  const name = `theme-${siteId}-${kind}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir(), name), data);
  return `/api/uploads/${name}`;
}

/** Uploaded theme image → stored URL, or a form error string. */
async function themeImageFrom(fd: FormData, field: string, siteId: number, kind: "bg" | "card" | "profile"): Promise<string | { error: string } | null> {
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

/** Uploaded tab icon → stored URL, or a form error string. */
async function faviconFrom(fd: FormData, siteId: number): Promise<string | { error: string } | null> {
  const file = fd.get("faviconFile");
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = FAVICON_TYPES[file.type];
  if (!ext) return { error: "Tab icons can be PNG, SVG, ICO or WebP." };
  if (file.size > FAVICON_MAX_BYTES) return { error: "Tab icons are capped at 512KB — they display at 16 pixels." };
  const buf = Buffer.from(await file.arrayBuffer());
  if (ext === "svg" && !svgSafe(buf.toString("utf8"))) {
    return { error: "That SVG has features we can't safely serve (scripts or links) — export it as a plain graphic." };
  }
  return storeThemeAsset(siteId, "icon", buf, ext);
}

/**
 * Run an untrusted design blob through exactly the gates updateTheme uses.
 *
 * Saved looks are round-tripped through the browser, so nothing in one may be
 * trusted on the way back in — every colour is re-normalized and every id is
 * re-checked against its list. Image URLs are the exception worth noting: they
 * are only ever accepted if the site already references them, so a look can
 * never point the page at someone else's upload.
 */
function sanitizeDesign(raw: unknown, site: Site): DesignConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const text = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  const knownImages = [site.config.bgImage, site.config.cardImage].filter(Boolean) as string[];
  const image = (k: string) => (knownImages.includes(text(k)) ? text(k) : undefined);

  return {
    themeColor: pickColor(ACCENTS, text("themeColor"), site.config.themeColor),
    bgColor: pickColor(BACKGROUNDS, text("bgColor"), site.config.bgColor ?? DEFAULT_BG),
    cardColor: pickColor(CONTAINERS, text("cardColor"), site.config.cardColor ?? DEFAULT_CARD),
    containerSize: clampSize(text("containerSize") || site.config.containerSize),
    containerMinHeight: clampMinHeight(text("containerMinHeight")),
    borderStyle: getBorderStyle(text("borderStyle")) ? text("borderStyle") : DEFAULT_BORDER,
    bgImage: image("bgImage"),
    cardImage: image("cardImage"),
    gradient: r.gradient !== false,
    themeId: getThemeDef(text("themeId")) ? text("themeId") : "",
    fontId: FONTS.some((f) => f.id === text("fontId")) ? text("fontId") : DEFAULT_FONT,
    fontScale: pickSwatch(TEXT_SIZES, text("fontScale"), site.config.fontScale ?? DEFAULT_TEXT_SIZE),
    textColor: pickColor(TEXT_COLORS, text("textColor"), site.config.textColor ?? DEFAULT_TEXT_COLOR),
    layout: getLayout(text("layout")) ? text("layout") : DEFAULT_LAYOUT,
    sectionSpacing: getSpacing(text("sectionSpacing")) ? text("sectionSpacing") : DEFAULT_SPACING,
    cornerStyle: getCorner(text("cornerStyle")) ? text("cornerStyle") : DEFAULT_CORNER,
    colorMode: getColorMode(text("colorMode")),
    lightThemeId: getThemeDef(text("lightThemeId")) ? text("lightThemeId") : "",
    lightBgColor: pickColor(LIGHT_BACKGROUNDS, text("lightBgColor"), site.config.lightBgColor ?? DEFAULT_LIGHT_BG),
    lightCardColor: pickColor(LIGHT_CONTAINERS, text("lightCardColor"), site.config.lightCardColor ?? DEFAULT_LIGHT_CARD),
    lightTextColor: pickColor(
      LIGHT_TEXT_COLORS,
      text("lightTextColor"),
      site.config.lightTextColor ?? DEFAULT_LIGHT_TEXT_COLOR
    ),
    // The rest of what the Design tab owns. Same rule as everything above:
    // every id is re-checked against its own list on the way back in, so a
    // hand-edited look can only ever contain values the tab could have made.
    buttonStyle: getButtonStyle(text("buttonStyle")) ? text("buttonStyle") : DEFAULT_BUTTON_STYLE,
    containerHover: getContainerHover(text("containerHover")) ? text("containerHover") : DEFAULT_CONTAINER_HOVER,
    buttonHover: getButtonHover(text("buttonHover")) ? text("buttonHover") : DEFAULT_BUTTON_HOVER,
    glowStrength: getGlow(text("glowStrength")) ? text("glowStrength") : DEFAULT_GLOW,
    glowSize: getGlowSize(text("glowSize")) ? text("glowSize") : DEFAULT_GLOW_SIZE,
    glowColor: normalizeHex(text("glowColor")) || "",
    profileFrame: getFrame(text("profileFrame")) ? text("profileFrame") : DEFAULT_FRAME,
  };
}

/** Stores the design currently in the builder under a name. */
export async function saveLookAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  const name = str(fd, "lookName").trim().slice(0, 40);
  if (!name) return { error: "Give this look a name first." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(str(fd, "lookDesign") || "{}");
  } catch {
    return { error: "That look couldn't be read — reload the page and try again." };
  }
  const design = sanitizeDesign(parsed, site);

  const looks = [...(site.config.looks ?? [])];
  const existing = looks.findIndex((l) => l.name.toLowerCase() === name.toLowerCase());
  if (existing >= 0) {
    // Same name means "update this one" — otherwise saving twice quietly
    // fills the list with near-identical entries.
    looks[existing] = { ...looks[existing], design };
  } else {
    if (looks.length >= MAX_LOOKS) return { error: `You can keep ${MAX_LOOKS} looks — delete one first.` };
    looks.push({ id: randomUUID(), name, design });
  }

  store.patchSiteConfig(site.id, { looks });
  revalidatePath("/dashboard/builder");
  return { ok: true };
}

export async function deleteLookAction(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = str(fd, "lookId");
  const looks = (site.config.looks ?? []).filter((l) => l.id !== id);
  store.patchSiteConfig(site.id, { looks });
  revalidatePath("/dashboard/builder");
}

/** Saves the Design tab of the page builder. */
export async function updateTheme(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  // Theme values go into inline styles on the public page — only accept
  // curated palette values, keeping whatever the site already had otherwise.
  // The accent is concatenated with alpha suffixes ("ACCENT55") by the theme
  // and border code, so a custom one has to be a full six-digit hex —
  // pickColor normalizes to exactly that, and rejects everything else.
  const themeColor = pickColor(ACCENTS, str(fd, "themeColor"), site.config.themeColor);
  // Backdrop and container tints also accept a typed hex — pickColor takes a
  // palette value as-is and otherwise normalizes the hex, so anything that
  // isn't one of those two things still can't reach the page.
  const bgColor = pickColor(BACKGROUNDS, str(fd, "bgColor"), site.config.bgColor ?? DEFAULT_BG);
  const cardColor = pickColor(CONTAINERS, str(fd, "cardColor"), site.config.cardColor ?? DEFAULT_CARD);
  // Free value now, so it is clamped into range rather than matched to a list.
  const containerSize = clampSize(str(fd, "containerSize") || site.config.containerSize);
  const containerMinHeight = clampMinHeight(str(fd, "containerMinHeight"));
  const borderRaw = str(fd, "borderStyle");
  const themeIdRaw = str(fd, "themeId");
  const fontIdRaw = str(fd, "fontId");
  const layoutRaw = str(fd, "layout");
  // A PATCH of the fields this form owns, not a copy of the whole config.
  //
  // Two reasons. Spreading site.config and writing it back whole is a
  // read-modify-write across the awaits below — themeImageFrom runs four image
  // pipelines, seconds for a large background — so anything that landed in
  // between was reverted. The case that bit: MediaMTX posting `live: true`
  // during that window, undone by the theme save, and because the relay only
  // posts on state change it never fired again. Second, toSite merges
  // SITE_CONFIG_DEFAULTS on the way in, so writing the spread back persisted
  // the shipped palette as if the creator had chosen it.
  const config: Record<string, unknown> = {
    themeColor,
    bgColor,
    cardColor,
    containerSize,
    containerMinHeight,
    // Border treatment — only known style ids reach the page's inline CSS.
    borderStyle: getBorderStyle(borderRaw) ? borderRaw : DEFAULT_BORDER,
    gradient: fd.get("gradient") === "on",
    // Both are ids from fixed lists, so only known values reach the page.
    glowStrength: getGlow(str(fd, "glowStrength")) ? str(fd, "glowStrength") : DEFAULT_GLOW,
    glowSize: getGlowSize(str(fd, "glowSize")) ? str(fd, "glowSize") : DEFAULT_GLOW_SIZE,
    // "" is a real choice here — it means "follow the accent" — so this can't
    // go through pickColor, which treats empty as absent and substitutes the
    // fallback. Anything non-empty has to normalize to a hex before it reaches
    // the page's inline CSS.
    glowColor: normalizeHex(str(fd, "glowColor")) || "",
    buttonStyle: getButtonStyle(str(fd, "buttonStyle")) ? str(fd, "buttonStyle") : DEFAULT_BUTTON_STYLE,
    containerHover: getContainerHover(str(fd, "containerHover")) ? str(fd, "containerHover") : DEFAULT_CONTAINER_HOVER,
    buttonHover: getButtonHover(str(fd, "buttonHover")) ? str(fd, "buttonHover") : DEFAULT_BUTTON_HOVER,
    // Preset backdrop — only known preset ids; "" = custom backdrop.
    themeId: getThemeDef(themeIdRaw) ? themeIdRaw : "",
    // Type. Family and size are ids from a fixed list; the ink is a color, so
    // it takes a hex the same way the backdrop does.
    fontId: FONTS.some((f) => f.id === fontIdRaw) ? fontIdRaw : DEFAULT_FONT,
    fontScale: pickSwatch(TEXT_SIZES, str(fd, "fontScale"), site.config.fontScale ?? DEFAULT_TEXT_SIZE),
    textColor: pickColor(TEXT_COLORS, str(fd, "textColor"), site.config.textColor ?? DEFAULT_TEXT_COLOR),
    // Section arrangement — only known layout ids reach the page.
    layout: getLayout(layoutRaw) ? layoutRaw : DEFAULT_LAYOUT,
    // Page shape — rhythm and corner ids from their fixed lists.
    sectionSpacing: getSpacing(str(fd, "sectionSpacing")) ? str(fd, "sectionSpacing") : DEFAULT_SPACING,
    cornerStyle: getCorner(str(fd, "cornerStyle")) ? str(fd, "cornerStyle") : DEFAULT_CORNER,
    // Light/dark. The mode is one of three known ids; the light palette goes
    // through the same pickColor gate as the dark one, against the light
    // swatch lists.
    // Storefront profile panel. The frame is an id from a fixed list; the two
    // lines under the name are trimmed short because they sit in a narrow
    // column and a long one would wrap into the portrait.
    profileFrame: getFrame(str(fd, "profileFrame")) ? str(fd, "profileFrame") : DEFAULT_FRAME,
    profileHandle: str(fd, "profileHandle").slice(0, 40),
    profileLocation: str(fd, "profileLocation").slice(0, 60),
    colorMode: getColorMode(str(fd, "colorMode")),
    lightThemeId: getThemeDef(str(fd, "lightThemeId")) ? str(fd, "lightThemeId") : "",
    lightBgColor: pickColor(LIGHT_BACKGROUNDS, str(fd, "lightBgColor"), site.config.lightBgColor ?? DEFAULT_LIGHT_BG),
    lightCardColor: pickColor(LIGHT_CONTAINERS, str(fd, "lightCardColor"), site.config.lightCardColor ?? DEFAULT_LIGHT_CARD),
    lightTextColor: pickColor(
      LIGHT_TEXT_COLORS,
      str(fd, "lightTextColor"),
      site.config.lightTextColor ?? DEFAULT_LIGHT_TEXT_COLOR
    ),
  };

  // Background image: an upload wins, then a client-generated random SVG,
  // then an explicit remove; otherwise whatever was there stays.
  //
  // Each replacement also unlinks the file it supersedes. Every theme save
  // used to write a NEW timestamped file and leave the old one behind forever,
  // with no per-site quota and no total cap — so one account looping uploads
  // fills the droplet, at which point SQLite writes fail for every tenant, the
  // backup's .backup fails, and Caddy can't write its certificates.
  const previous = site.config;

  const bgUpload = await themeImageFrom(fd, "bgImageFile", site.id, "bg");
  if (bgUpload && typeof bgUpload === "object") return bgUpload;
  const bgSvg = str(fd, "bgSvg");
  if (bgUpload) {
    config.bgImage = bgUpload;
    deleteSupersededAsset(previous.bgImage ?? "", bgUpload);
  } else if (bgSvg) {
    if (!svgSafe(bgSvg)) return { error: "That generated SVG couldn't be validated — try randomizing again." };
    const stored = storeThemeAsset(site.id, "bg", Buffer.from(bgSvg, "utf8"), "svg");
    config.bgImage = stored;
    deleteSupersededAsset(previous.bgImage ?? "", stored);
  } else if (str(fd, "clearBgImage") === "1") {
    // undefined removes the key — see patchSiteConfig.
    config.bgImage = undefined;
    deleteSupersededAsset(previous.bgImage ?? "", "");
  }

  const cardUpload = await themeImageFrom(fd, "cardImageFile", site.id, "card");
  if (cardUpload && typeof cardUpload === "object") return cardUpload;
  if (cardUpload) {
    config.cardImage = cardUpload;
    deleteSupersededAsset(previous.cardImage ?? "", cardUpload);
  } else if (str(fd, "clearCardImage") === "1") {
    config.cardImage = undefined;
    deleteSupersededAsset(previous.cardImage ?? "", "");
  }

  // The storefront portrait follows the same rules as the other uploads: a
  // new file wins, an explicit remove clears it, and otherwise it stays.
  const portraitUpload = await themeImageFrom(fd, "profileImageFile", site.id, "profile");
  if (portraitUpload && typeof portraitUpload === "object") return portraitUpload;
  if (portraitUpload) {
    config.profileImage = portraitUpload;
    deleteSupersededAsset(previous.profileImage ?? "", portraitUpload);
  } else if (str(fd, "clearProfileImage") === "1") {
    config.profileImage = undefined;
    deleteSupersededAsset(previous.profileImage ?? "", "");
  }
  const iconUpload = await faviconFrom(fd, site.id);
  if (iconUpload && typeof iconUpload === "object") return iconUpload;
  if (iconUpload) {
    config.faviconUrl = iconUpload;
    deleteSupersededAsset(previous.faviconUrl ?? "", iconUpload);
  } else if (str(fd, "clearFavicon") === "1") {
    config.faviconUrl = undefined;
    deleteSupersededAsset(previous.faviconUrl ?? "", "");
  }

  store.patchSiteConfig(site.id, config);
  revalidatePath("/dashboard/builder");
  revalidatePath(`/${site.slug}`);
  // The tab icon is served from the page's metadata, so both public routes
  // need re-rendering, not just the section content.
  revalidatePath("/domain", "layout");
  return { ok: true };
}

export async function setCustomDomainAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!planFor(site).customDomain) return { error: "Custom domains need the Pro plan — upgrade below." };
  const hostname = cleanHostname(str(fd, "hostname"));
  if (!hostname) return { error: "Enter just your domain, like janedoe.com — no https:// or paths needed." };
  if (platformHosts().has(hostname)) return { error: "That domain is reserved." };
  // Only a verified claim reserves a name, so this refuses the real owner of
  // an already-proven domain and nobody else.
  if (store.domainTaken(hostname, site.id)) return { error: "That domain is already connected to another Ensemble page." };
  store.claimCustomDomain(site.id, hostname, randomBytes(16).toString("hex"));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/connect");
  return { ok: true };
}

/**
 * Check the TXT record and, if it holds our token, trust the domain.
 *
 * Re-checks that nobody proved the same name first: two sites can hold an
 * unverified claim on one hostname, and the race is settled here rather than
 * by whoever typed it first.
 */
export async function verifyDomainAction(): Promise<FormState> {
  const { site } = await requireSite();
  const domain = store.getDomainBySite(site.id);
  if (!domain) return { error: "Add your domain first." };
  if (domain.verifiedAt) return { ok: true };

  // Unbounded, this drives outbound DNS queries against an attacker-chosen
  // hostname from the droplet's resolver — free traffic amplification wearing
  // our IP. DNS also takes minutes to propagate, so a real creator has no use
  // for more than a handful of attempts.
  const limit = rateLimit(`verify-domain:${site.id}`, LIMITS.domainCheck);
  if (!limit.ok) return { error: "DNS changes take a few minutes to spread — try again shortly." };
  if (store.domainTaken(domain.hostname, site.id)) {
    return { error: "Another Ensemble page proved this domain first. Contact support if that isn't right." };
  }

  const result = await checkDomainOwnership(domain.hostname, domain.verifyToken);
  if (!result.ok) {
    revalidatePath("/dashboard/connect");
    return {
      error:
        result.reason === "no-record"
          ? "We couldn't find that TXT record yet. DNS changes can take a few minutes to spread, so try again shortly."
          : "We found a TXT record, but not the value above. Check it was copied whole, then try again.",
    };
  }

  store.markDomainVerified(site.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/connect");
  return { ok: true };
}

export async function removeCustomDomainAction(): Promise<void> {
  const { site } = await requireSite();
  store.deleteCustomDomain(site.id);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/connect");
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
      // Existing subscription: swap the price. Upgrades invoice immediately and
      // fail if the card does not clear (see changeSubscriptionPlan), so
      // reaching the line below means the higher plan is actually being paid
      // for. Downgrades keep the anchor and take effect at the next invoice.
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
  } else if (billingPreviewMode()) {
    // Preview / self-hosted mode, asked for explicitly. This branch used to be
    // reached whenever STRIPE_SECRET_KEY was merely absent — the shipped
    // default — so a plain POST here handed any signed-up account Enterprise,
    // unlocking the live relay, custom domains, chatrooms and newsletters for
    // free, and amplifying every other finding that a paid feature gates.
    store.updateSite(site.id, { plan: planId });
  } else {
    // Production, no Stripe key, no explicit opt-out. Refuse rather than give
    // the product away on a missing line of config.
    redirect("/dashboard/settings?billing=unavailable");
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/builder");
  revalidatePath(`/${site.slug}`);
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
  const plan = planFor(site);
  const config: Record<string, unknown> = {};
  if (plan.payments) {
    const stripeKey = str(fd, "stripeKey");
    // Publishable keys only. The field had no format check at all, so a
    // creator could paste a live SECRET key into a value that is rendered
    // back into the page — and sk_ in this field is a compromise, not a typo.
    if (stripeKey && !/^pk_(test|live)_[A-Za-z0-9]+$/.test(stripeKey)) {
      return { error: "That must be a Stripe publishable key — it starts with pk_test_ or pk_live_." };
    }
    config.stripeKey = stripeKey;
  }
  if (plan.calendar) config.calendlyUrl = str(fd, "calendlyUrl");
  // The creator's own email platform. Only known provider ids are stored, so a
  // tampered form can't make the forwarder fetch somewhere of its choosing.
  if (plan.newsletter) {
    const providerRaw = str(fd, "emailProvider");
    const provider = getEmailProvider(providerRaw) ? providerRaw : "";
    config.emailProvider = provider;
    if (!provider) {
      config.emailApiKey = "";
      config.emailListId = "";
    } else {
      // The form is never sent the saved key back, so blank means unchanged.
      const typed = str(fd, "emailApiKey");
      const clear = str(fd, "emailApiKeyClear") === "1";
      config.emailApiKey = clear ? "" : typed || ((site.config.emailApiKey as string | undefined) ?? "");
      config.emailListId = str(fd, "emailListId");
    }
  }
  // Not read here any more. The chatroom switch lives on its own page, and
  // an absent checkbox reads as "off", so leaving this in would have turned
  // the chatroom off on every unrelated save from this form.
  if (plan.newsletter) config.newsletterEnabled = fd.get("newsletterEnabled") === "on";
  // Patch, so a concurrent write (the live relay posting liveNow, say) is not
  // reverted by this form's pre-read snapshot.
  store.patchSiteConfig(site.id, config);
  revalidatePath("/dashboard/integrations");
  revalidatePath(`/${site.slug}`);
  return {};
}

/* ---------------- chatroom ---------------- */

export async function postChatMessage(_prev: FormState, fd: FormData): Promise<FormState> {
  const siteId = Number(str(fd, "siteId"));
  const site = store.getSiteById(siteId);
  if (!site) return { error: "Page not found." };
  // The badge is authenticated, never claimed: a visitor typing the
  // creator's name gets plain text, only the logged-in owner gets the mark.
  const user = await getCurrentUser();
  const isCreator = !!user && user.id === site.userId;
  if (!site.published && !isCreator) {
    // Drafts accept messages only from their owner (dashboard chatroom).
    return { error: "Page not found." };
  }
  const plan = planFor(site);
  if (!plan.chatroom || site.config.chatroomEnabled === false) return { error: "Chat is not enabled on this page." };

  const author = str(fd, "author").slice(0, 40) || (isCreator && user ? user.name.split(" ")[0] : "anon");
  const body = str(fd, "body").slice(0, 500);
  if (!body) return { error: "Write a message first." };

  // Throttled per visitor per page, so one script cannot bury a chatroom.
  const chatLimit = rateLimit(`chat:${await clientIp()}:${siteId}`, LIMITS.chat);
  if (!chatLimit.ok) return { error: "You're sending messages too quickly. Wait a moment, then try again." };

  store.addChatMessage(siteId, author, body, isCreator);
  revalidatePath(`/${site.slug}`);
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
  revalidatePath(`/${site.slug}`);
}

export async function toggleChatroom(): Promise<void> {
  const { site } = await requireSite();
  if (!planFor(site).chatroom) return;
  store.patchSiteConfig(site.id, {
    chatroomEnabled: site.config.chatroomEnabled === false,
  });
  revalidatePath("/dashboard/chatroom");
  revalidatePath("/dashboard/integrations");
  revalidatePath(`/${site.slug}`);
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

/**
 * Send a newsletter to everyone still subscribed.
 *
 * Sends from the platform's verified address with the creator's name on it
 * and their account email as reply-to, one personalised email per address —
 * each carries its own unsubscribe link. The broadcast is recorded only for
 * the recipients that actually went out, so the history never claims more
 * than happened.
 */
export async function sendNewsletterAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!planFor(site).newsletter) return { error: "Newsletters are an Enterprise feature." };
  if (!mailEnabled()) {
    return { error: "Email sending isn't switched on for this server yet — set RESEND_API_KEY and MAIL_FROM (see .env.example)." };
  }

  const subject = str(fd, "subject").slice(0, 150);
  const body = str(fd, "body").slice(0, 10_000);
  if (!subject || !body) return { error: "Give it a subject and something to say." };

  // Mail leaves under the creator's display name from the PLATFORM's
  // SPF/DKIM-aligned domain, so every complaint lands on a reputation shared
  // by every other creator here. A send limit is the cheapest bound on that.
  const sendLimit = rateLimit(`newsletter-send:${site.id}`, LIMITS.newsletterSend);
  if (!sendLimit.ok) {
    return { error: "You've sent several newsletters just now. Give it a few minutes before the next one." };
  }

  const leads = store.getActiveLeads(site.id);
  if (leads.length === 0) return { error: "Nobody to send to yet — the Newsletter section on your page collects subscribers." };
  if (leads.length > MAX_NEWSLETTER_RECIPIENTS) {
    return {
      error: `Your list is over ${MAX_NEWSLETTER_RECIPIENTS.toLocaleString()} addresses, which is past what this server sends in one go. Contact support and we'll raise it.`,
    };
  }

  const owner = store.getUserById(site.userId);
  if (!owner) return { error: "Account not found." };

  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const { sent, failed } = await sendNewsletter({
    fromName: owner.businessName,
    replyTo: owner.email,
    subject,
    body,
    recipients: leads.map((l) => ({ email: l.email, unsubUrl: `${base}/api/unsubscribe?t=${l.unsubToken}` })),
  });

  // Recorded whenever ANY mail went out, before deciding what to report. A
  // partial failure used to return an error with no broadcast written, so
  // "try again" re-sent to everyone who had already received it and then
  // recorded a second broadcast.
  if (sent > 0) store.recordNewsletterPost(site.id, subject, body, sent);
  revalidatePath("/dashboard/audience");

  if (sent === 0) return { error: "Nothing went out — the mail service rejected the send. Check the server's mail configuration." };
  return failed > 0
    ? {
        ok: true,
        message: `Sent to ${sent} subscriber${sent === 1 ? "" : "s"}. ${failed} didn't go through — this send is recorded, so don't resend to the whole list.`,
      }
    : { ok: true, message: `Sent to ${sent} subscriber${sent === 1 ? "" : "s"}.` };
}

/* ---------------- connect website ---------------- */

export async function regenerateEmbedTokenAction(): Promise<void> {
  const { site } = await requireSite();
  store.regenerateEmbedToken(site.id);
  revalidatePath("/dashboard/connect");
}

export interface CheckState extends FormState {
  check?: SnippetCheck & { url: string };
}

/**
 * "Check my website" — reads the creator's page and says, in one click, why
 * the snippet isn't working. This exists because the alternative was asking
 * non-technical users to open devtools and interpret console output.
 *
 * Unlike the content scan this replaced, a failed fetch is not fatal: we say
 * we couldn't look and fall back to the manual steps.
 */
export async function checkWebsiteAction(_prev: CheckState, fd: FormData): Promise<CheckState> {
  const { site } = await requireSite();
  const raw = str(fd, "url");
  if (!raw) return { error: "Enter your website's address first." };

  const checked = validateSiteUrl(raw);
  if ("error" in checked) return { error: checked.error };

  // This drives an outbound fetch to a host the caller chooses, from inside
  // the droplet. Even with the SSRF guard, unbounded is a free scanner.
  const limit = rateLimit(`site-check:${site.id}`, LIMITS.domainCheck);
  if (!limit.ok) return { error: "That's a lot of checks — give it a minute and try again." };

  const appOrigin = (process.env.APP_URL || "").replace(/\/$/, "");
  if (!appOrigin) {
    return { error: "This Ensemble server has no public address configured yet, so we can't check your site." };
  }

  let html: string;
  try {
    html = await fetchPageHtml(checked.url);
  } catch (e) {
    // Only OUR messages are echoed. A raw error here is the thing that made
    // the SSRF readable: "connect ECONNREFUSED 127.0.0.1:3000" and friends
    // turn a blind request into an oracle. Everything else gets one flat
    // sentence, and the real reason goes to the log.
    if (!(e instanceof UnsafeUrlError)) console.error(`Snippet check failed for ${checked.url.host}:`, e);
    return {
      check: {
        status: "unreachable",
        url: checked.url.href,
        detail: e instanceof UnsafeUrlError ? e.message : "we couldn't load that page",
      },
    };
  }

  return { check: { ...inspectSnippet(html, appOrigin, site.embedToken), url: checked.url.href } };
}

/**
 * Ask the snippet to re-read the page on its next load.
 *
 * Discovery is snippet-driven — the server never fetches the creator's site.
 * That replaced a URL scan which bot-protection firewalls blocked outright
 * and which saw only an empty shell on JavaScript-rendered platforms.
 * Existing edits survive: replaceSiteContent re-attaches them by selector.
 */
export async function resyncWebsite(): Promise<void> {
  const { site } = await requireSite();
  if (!store.getConnection(site.id)) return;
  store.setConnectionNeedsReport(site.id, true);
  revalidatePath("/dashboard/connect");
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
  const plan = planFor(site);
  if (!plan.social) return { error: "Social accounts aren't available on this plan." };
  const platform = getPlatform(str(fd, "platform"));
  if (!platform) return { error: "Unknown platform." };

  // Reconnecting a platform that is already on the list is an update, not a
  // new seat, so only genuinely new platforms count against the cap.
  const connected = store.getSocialAccounts(site.id);
  if (!connected.some((a) => a.platform === platform.id) && connected.length >= plan.maxSocialAccounts) {
    return {
      error: `${plan.name} connects ${plan.maxSocialAccounts} social accounts. Disconnect one, or upgrade in Settings to connect every platform.`,
    };
  }

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
  if (!planFor(site).social) return { error: "Posting is a Pro feature — upgrade in Settings." };
  const body = str(fd, "body").slice(0, 2000);
  if (!body) return { error: "Write something to post." };
  const mediaUrl = str(fd, "mediaUrl");
  if (mediaUrl && !/^https?:\/\//.test(mediaUrl)) return { error: "The media link must be a full http(s) URL." };

  // The composer has no per-platform picker any more — what's connected is the
  // selection. An explicit `platforms` list is still honoured (and still
  // filtered against connected accounts, since it arrives from the client),
  // so anything posting to a subset keeps working.
  const connected = store.getSocialAccounts(site.id).map((a) => a.platform);
  const requested = fd.getAll("platforms").map(String).filter((p) => connected.includes(p));
  const platforms = requested.length > 0 ? requested : connected;
  if (platforms.length === 0) return { error: "Connect a platform above before posting." };

  const postId = store.createSocialPost(site.id, body, mediaUrl, platforms);
  const summary = summarisePublish(await publishPost(site.id, postId));
  revalidatePath("/dashboard/integrations");
  // A partial failure is still a real failure for the platform that didn't get
  // the post, and the creator is the only one who can fix it (usually by
  // reconnecting). Saying so beats a green tick and a silent gap.
  return summary.ok ? { ok: true, message: summary.message } : { error: summary.message };
}

/**
 * Record a follower count for a platform on a date. Counts are typed in by
 * hand — most connections are handle-only, so there is no API to ask — and
 * the date is the day the number was true, which is often in the past.
 */
export async function addSocialStat(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!planFor(site).dailyAnalytics) return { error: "Growth tracking is a Pro feature — upgrade in Settings." };
  const platform = getPlatform(str(fd, "platform"));
  if (!platform) return { error: "Pick a platform." };
  // Only known metric ids are stored, so the breakdown can group on them
  // without guarding against whatever a tampered form sent.
  const metric = getMetric(str(fd, "metric"))?.id ?? DEFAULT_METRIC;
  const day = str(fd, "day");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return { error: "Pick the date the count was true." };
  const count = parseCount(str(fd, "count"));
  if (Number.isNaN(count)) return { error: "Enter the count as a number — 10000, 10,000, 10k and 1.2m all work." };
  const note = str(fd, "note").slice(0, 200);
  store.upsertSocialStat(site.id, platform.id, metric, day, count, note);
  revalidatePath("/dashboard/analytics");
  return { ok: true };
}

export async function removeSocialStat(fd: FormData): Promise<void> {
  const { site } = await requireSite();
  const id = Number(str(fd, "id"));
  if (id) store.deleteSocialStat(site.id, id);
  // /dashboard/analytics is where social stats render — its sibling addSocialStat
  // has always revalidated that one. Copy-paste drift, currently invisible only
  // because every route here is dynamic.
  revalidatePath("/dashboard/analytics");
}

/** Re-attempt delivery of a post's queued/failed targets. */
export async function retrySocialPost(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!planFor(site).social) return { error: "Posting is a Pro feature — upgrade in Settings." };
  const postId = Number(str(fd, "postId"));
  if (!postId) return { error: "Nothing to retry." };
  const summary = summarisePublish(await publishPost(site.id, postId));
  revalidatePath("/dashboard/integrations");
  return summary.ok ? { ok: true, message: summary.message } : { error: summary.message };
}

export async function saveLiveStreams(_prev: FormState, fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!planFor(site).live) return { error: "Live streams are an Enterprise feature — upgrade in Settings." };
  const rawTwitch = str(fd, "twitchChannel");
  const rawFacebook = str(fd, "facebookLiveUrl");
  const rawInstagram = str(fd, "instagramLiveUser");

  const twitchChannel = cleanTwitchChannel(rawTwitch);
  if (rawTwitch && !twitchChannel) return { error: "That doesn't look like a Twitch channel name." };
  const facebookLiveUrl = cleanFacebookLiveUrl(rawFacebook);
  if (rawFacebook && !facebookLiveUrl) return { error: "The Facebook Live link must be an https facebook.com video URL." };
  const instagramLiveUser = cleanInstagramUser(rawInstagram);
  if (rawInstagram && !instagramLiveUser) return { error: "That doesn't look like an Instagram username." };

  // The relay exists now, so the key fields are back and mean something:
  // each saved key is a destination the relay pushes the creator's one
  // stream to. Blank clears, same as the channel fields above.
  //
  // VALIDATED, not merely truncated. deploy/live-push.sh reads its destination
  // list LINE BY LINE, and jq prints an embedded newline as a real one — so a
  // key of "abc\nfile:/srv/ensemble/data/uploads/x.bin" added a second ffmpeg
  // output writing wherever the service user can write, which is the same disk
  // as every tenant's database. Every expansion in that script is correctly
  // quoted, so this was never shell injection; it was line injection into the
  // argument list, which was enough. tcp:// and http:// destinations turned it
  // into outbound SSRF and stream exfiltration.
  //
  // Real stream keys from Twitch, YouTube and Facebook are all within this
  // character set. The shell side is hardened too, so neither layer is the
  // only thing standing between a newline and an extra output.
  // The form never receives the saved keys back (they are password-grade and
  // a client component would ship them in the HTML), so a blank field means
  // "unchanged" and clearing one is an explicit checkbox.
  const streamKeys: Record<string, string> = {};
  for (const field of ["twitchStreamKey", "youtubeStreamKey", "facebookStreamKey"] as const) {
    if (str(fd, `${field}Clear`) === "1") {
      streamKeys[field] = "";
      continue;
    }
    const raw = str(fd, field);
    if (!raw) {
      streamKeys[field] = (site.config[field] as string | undefined) ?? "";
      continue;
    }
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(raw)) {
      return { error: "Stream keys can only contain letters, numbers, dashes and underscores." };
    }
    streamKeys[field] = raw;
  }

  store.patchSiteConfig(site.id, {
    twitchChannel,
    facebookLiveUrl,
    instagramLiveUser,
    ...streamKeys,
  });
  revalidatePath("/dashboard/integrations");
  revalidatePath(`/${site.slug}`);
  return { ok: true };
}

/** Flip everything live at once and announce it to every connected platform. */
/**
 * A fresh ingest key. The old one stops opening the relay the moment this
 * runs, which is the point — it's the recovery move for a leaked key.
 */
export async function regenerateIngestKeyAction(): Promise<void> {
  const { site } = await requireSite();
  if (!planFor(site).live) return;
  store.regenerateIngestKey(site.id);
  revalidatePath("/dashboard/integrations");
}

export async function goLive(_prev: FormState, _fd: FormData): Promise<FormState> {
  const { site } = await requireSite();
  if (!planFor(site).live) return { error: "Going live is an Enterprise feature — upgrade in Settings." };
  const c = site.config;
  const destinations: string[] = [];
  if (c.twitchChannel) destinations.push(`twitch.tv/${c.twitchChannel}`);
  if (c.facebookLiveUrl) destinations.push("Facebook Live");
  if (c.instagramLiveUser) destinations.push(`instagram.com/${c.instagramLiveUser}`);
  if (destinations.length === 0) {
    return { error: "Link at least one live platform below before going live." };
  }

  store.patchSiteConfig(site.id, { liveNow: true });

  // Auto-announce on every connected social account.
  const platforms = store.getSocialAccounts(site.id).map((a) => a.platform);
  if (platforms.length > 0) {
    const postId = store.createSocialPost(site.id, `I'm live right now — come watch: ${destinations.join(" · ")}`, "", platforms);
    await publishPost(site.id, postId);
  }

  revalidatePath("/dashboard/integrations");
  revalidatePath(`/${site.slug}`);
  return { ok: true };
}

export async function endLive(): Promise<void> {
  const { site } = await requireSite();
  store.patchSiteConfig(site.id, { liveNow: false });
  revalidatePath("/dashboard/integrations");
  revalidatePath(`/${site.slug}`);
}

/* ---------------- support ---------------- */

export async function createTicketAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const site = store.getSiteByUser(user.id);
  if (!site || !planFor(site).helpdesk) return { error: "Support isn't available on your plan." };
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

/**
 * Copy a new subscriber to the creator's own email platform, if they connected
 * one. Deliberately not allowed to fail a signup: forwardSubscriber swallows
 * its own errors, and this exists so both signup paths share one call.
 */
async function forwardLead(config: SiteConfig, email: string): Promise<void> {
  if (!config.emailProvider || !config.emailApiKey) return;
  await forwardSubscriber(config.emailProvider, config.emailApiKey, config.emailListId ?? "", email);
}

export async function subscribeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const siteId = Number(str(fd, "siteId"));
  const email = str(fd, "email").toLowerCase();
  const site = store.getSiteById(siteId);
  if (!site) return { error: "Page not found." };
  // Mirrors postChatMessage, which gets this right. siteId arrives from a
  // hidden form field, so without the draft check any site id could be
  // subscribed to; and both other layers honour newsletterEnabled at RENDER
  // only, so leads kept arriving on a form the creator believed was switched
  // off. A presentation-only off switch is not an off switch.
  const user = await getCurrentUser();
  const isCreator = !!user && user.id === site.userId;
  if (!site.published && !isCreator) return { error: "Page not found." };
  const plan = planFor(site);
  if (!plan.newsletter || site.config.newsletterEnabled === false) {
    return { error: "Newsletter is not enabled on this page." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  // Throttled per visitor across all pages. A real subscriber signs up once,
  // so this only ever bites a script filling the leads table.
  const signupLimit = rateLimit(`newsletter:${await clientIp()}`, LIMITS.newsletter);
  if (!signupLimit.ok) return { error: "Too many signups from this connection. Try again in a few minutes." };

  store.addLead(siteId, email);
  // Their list, not just ours. Awaited so a slow provider is visible in the
  // logs rather than silently dropped, but its result never reaches the
  // visitor: the signup already succeeded the moment addLead returned.
  await forwardLead(site.config, email);
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
