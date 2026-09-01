/*
 * Not server-only: the registry below is plain data with no secrets in it, and
 * the Integrations form needs it on the client to label each provider's fields.
 * forwardSubscriber takes the credential as an argument rather than reading it
 * from anywhere, so nothing here can leak a key by being bundled.
 */

/**
 * Creator-owned email platforms.
 *
 * Ensemble is the glue, not the mailing list. Someone who already runs their
 * audience on Mailchimp or Kit should not be asked to move it here, so a
 * signup on their page is written to their own provider as well as to our
 * leads table. The local copy is what Audience and the CSV export read, and
 * it is what survives a provider outage or a rotated key, so forwarding is
 * additive and never the only record.
 *
 * Adding a provider means an entry here and a case in `forwardSubscriber`.
 * Nothing else in the app needs to know which one a creator picked.
 */

export interface EmailProviderDef {
  id: string;
  name: string;
  /** The credential the creator pastes, and where they find it. */
  keyLabel: string;
  keyHint: string;
  /** Second field, for providers that need a list, form or publication id. */
  listLabel?: string;
  listHint?: string;
  docsUrl: string;
}

export const EMAIL_PROVIDERS: EmailProviderDef[] = [
  {
    id: "mailchimp",
    name: "Mailchimp",
    keyLabel: "API key",
    keyHint: "Account → Extras → API keys. It ends in a datacentre suffix like -us21.",
    listLabel: "Audience ID",
    listHint: "Audience → Settings → Audience name and defaults.",
    docsUrl: "https://mailchimp.com/help/about-api-keys/",
  },
  {
    id: "kit",
    name: "Kit (ConvertKit)",
    keyLabel: "API key",
    keyHint: "Settings → Developer → API key.",
    listLabel: "Form ID",
    listHint: "The number at the end of the form's URL.",
    docsUrl: "https://developers.kit.com/",
  },
  {
    id: "beehiiv",
    name: "beehiiv",
    keyLabel: "API key",
    keyHint: "Settings → Integrations → API keys.",
    listLabel: "Publication ID",
    listHint: "Starts with pub_.",
    docsUrl: "https://developers.beehiiv.com/",
  },
  {
    id: "mailerlite",
    name: "MailerLite",
    keyLabel: "API key",
    keyHint: "Integrations → MailerLite API.",
    listLabel: "Group ID",
    listHint: "Optional. Leave blank to add without a group.",
    docsUrl: "https://developers.mailerlite.com/",
  },
  {
    id: "buttondown",
    name: "Buttondown",
    keyLabel: "API key",
    keyHint: "Settings → Programming → API key.",
    docsUrl: "https://docs.buttondown.email/api-reference",
  },
];

export function getEmailProvider(id: string | undefined | null): EmailProviderDef | null {
  if (!id) return null;
  return EMAIL_PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Configured enough to try. The list id is only required where the API needs one. */
export function emailProviderReady(provider: string, key: string, list: string): boolean {
  const def = getEmailProvider(provider);
  if (!def || !key) return false;
  return def.listLabel && def.id !== "mailerlite" ? !!list : true;
}

/**
 * Push one address to the creator's provider.
 *
 * Never throws. A signup is already recorded locally by the time this runs,
 * and a visitor who typed their email correctly should not see an error
 * because someone's API key expired. Failures are logged for the operator and
 * swallowed for the visitor. The timeout matters as much as the catch: without
 * it a provider that hangs would hold the signup request open behind it.
 */
export async function forwardSubscriber(
  provider: string,
  key: string,
  list: string,
  email: string
): Promise<boolean> {
  if (!emailProviderReady(provider, key, list)) return false;

  try {
    const signal = AbortSignal.timeout(5000);
    let res: Response;

    switch (provider) {
      case "mailchimp": {
        // The datacentre is the suffix on the key itself, so the endpoint is
        // derived rather than asked for a second time.
        const dc = key.split("-")[1];
        if (!dc) return false;
        res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${encodeURIComponent(list)}/members`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email_address: email, status: "subscribed" }),
          signal,
        });
        break;
      }
      case "kit": {
        res = await fetch(`https://api.convertkit.com/v3/forms/${encodeURIComponent(list)}/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: key, email }),
          signal,
        });
        break;
      }
      case "beehiiv": {
        res = await fetch(`https://api.beehiiv.com/v2/publications/${encodeURIComponent(list)}/subscriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email, reactivate_existing: false }),
          signal,
        });
        break;
      }
      case "mailerlite": {
        res = await fetch("https://connect.mailerlite.com/api/subscribers", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify(list ? { email, groups: [list] } : { email }),
          signal,
        });
        break;
      }
      case "buttondown": {
        res = await fetch("https://api.buttondown.email/v1/subscribers", {
          method: "POST",
          headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          signal,
        });
        break;
      }
      default:
        return false;
    }

    if (!res.ok) {
      // A duplicate is the common "failure" here and is not worth shouting
      // about: the address is on their list, which is the outcome we wanted.
      if (res.status !== 400 && res.status !== 409 && res.status !== 422) {
        console.error(`Email forward to ${provider} failed: ${res.status}`);
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Email forward to ${provider} threw:`, err);
    return false;
  }
}
