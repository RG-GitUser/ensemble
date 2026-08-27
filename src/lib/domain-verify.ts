import "server-only";
import { resolveTxt } from "node:dns/promises";
import { verifyRecord } from "./domains";

/**
 * Proving a creator owns the domain they typed.
 *
 * A TXT record rather than checking where the domain points, because the two
 * answer different questions. An A or CNAME record aimed at us proves DNS
 * resolves here; it does not prove the person who typed the name controls it.
 * Publishing a value we generated does, and it can be done before the domain
 * is pointed anywhere, so a creator can prove ownership without taking their
 * existing site down first.
 *
 * Kept apart from lib/domains.ts on purpose: that module is imported by the
 * proxy and has to stay free of Node built-ins.
 */

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "no-record" | "wrong-value"; found: string[] };

/** Look for our token in the domain's TXT records. */
export async function checkDomainOwnership(hostname: string, token: string): Promise<VerifyResult> {
  const { name, value } = verifyRecord(hostname, token);

  let records: string[][];
  try {
    records = await resolveTxt(name);
  } catch {
    // ENODATA and ENOTFOUND both mean the same thing to a creator: the record
    // is not there yet. DNS propagation is the usual cause, so this is a
    // "try again shortly", never a hard failure.
    return { ok: false, reason: "no-record", found: [] };
  }

  // A single TXT record arrives as an array of strings that has to be joined:
  // anything over 255 characters is split at the protocol level.
  const found = records.map((chunks) => chunks.join("").trim());
  if (found.length === 0) return { ok: false, reason: "no-record", found };
  return found.includes(value) ? { ok: true } : { ok: false, reason: "wrong-value", found };
}
