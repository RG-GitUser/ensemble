import "server-only";

import * as store from "./db";
import { publishPost, summarisePublish } from "./publish";
import { deliverNewsletter } from "./newsletter";

/**
 * The due-work runner.
 *
 * Called by cron through /api/cron/run-due, because a request-driven Next
 * server has nothing of its own that wakes up. The alternatives were both
 * worse: an in-process timer dies silently on every deploy and restart, and
 * publishing on the next dashboard visit turns "scheduled for 09:00" into
 * "whenever somebody next looks", which is not a promise worth making.
 *
 * Two rules hold everything together:
 *
 *   Claim before doing. Every row is taken with a single UPDATE that flips it
 *   to 'sending', so two overlapping passes cannot both act on it. A fan-out
 *   to five platforms, or a send to five thousand addresses, can easily
 *   outlast the minute until the next cron tick, so overlap is the expected
 *   case rather than bad luck.
 *
 *   Never throw past a single item. One creator's dead OAuth token must not
 *   stop every other creator's queue, so each item is caught on its own and
 *   recorded. The run reports what happened; it does not fail.
 */

/** Bounds one pass, so a backlog drains over several ticks rather than in one long request. */
const POSTS_PER_RUN = 25;
const NEWSLETTERS_PER_RUN = 5;

export interface RunSummary {
  /** Posts whose targets were attempted this pass. */
  posts: number;
  /** Newsletters attempted this pass. */
  newsletters: number;
  /** One line per item, for the cron log. Never contains a secret or an address. */
  detail: string[];
}

export async function runDueWork(now = new Date()): Promise<RunSummary> {
  const nowIso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const detail: string[] = [];

  const posts = store.claimDueSocialPosts(nowIso, POSTS_PER_RUN);
  for (const { id: postId, siteId } of posts) {
    try {
      const summary = summarisePublish(await publishPost(siteId, postId));
      detail.push(`post ${postId}: ${summary.message}`);
    } catch (err) {
      // The row is still marked delivered below: its per-target rows carry the
      // real outcome, and leaving it 'sending' would have a later pass retry a
      // post that may already be on somebody's timeline.
      detail.push(`post ${postId}: ${err instanceof Error ? err.message : "failed"}`);
    } finally {
      store.finishSocialPost(postId);
    }
  }

  const newsletters = store.claimDueNewsletters(nowIso, NEWSLETTERS_PER_RUN);
  for (const n of newsletters) {
    try {
      const site = store.getSiteById(n.siteId);
      if (!site) {
        store.finishScheduledNewsletter(n.id, "failed", "The site this belonged to is gone.");
        detail.push(`newsletter ${n.id}: site missing`);
        continue;
      }
      // deliverNewsletter re-checks the plan, the mail configuration and the
      // list at send time. A newsletter can sit queued for weeks, and any of
      // the three can be gone by the time it runs.
      const result = await deliverNewsletter(site, n.subject, n.body);
      store.finishScheduledNewsletter(n.id, result.ok ? "sent" : "failed", result.message);
      detail.push(`newsletter ${n.id}: ${result.message}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "failed";
      store.finishScheduledNewsletter(n.id, "failed", message);
      detail.push(`newsletter ${n.id}: ${message}`);
    }
  }

  return { posts: posts.length, newsletters: newsletters.length, detail };
}
