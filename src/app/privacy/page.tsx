import type { Metadata } from "next";
import { DocSection, DocShell } from "@/components/DocShell";

export const metadata: Metadata = {
  title: "Privacy — Ensemble",
  description: "What Ensemble stores, why, and how to have it removed.",
};

/**
 * Written to be read, and to pass platform app reviews, which check that a
 * privacy page exists, loads, and offers a real data-deletion path. Keep the
 * contact address in sync with the help desk address used in the dashboard.
 */
export default function PrivacyPage() {
  return (
    <DocShell>
      <h1 className="text-3xl font-bold tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-mist">Last updated August 2026.</p>

      <DocSection title="The short version">
        <p>
          Ensemble stores what it needs to run your page and nothing it doesn&apos;t. We don&apos;t sell data, we
          don&apos;t run ads, and we don&apos;t track anyone across the web. When you want your data gone, you ask and
          we delete it.
        </p>
      </DocSection>

      <DocSection title="What we store about creators">
        <p>
          Your account holds your name, email address, business name and a hashed password. We never store the
          password itself.
        </p>
        <p>
          Your page content, design choices, uploaded images and section text are stored so we can serve your page.
          They belong to you.
        </p>
        <p>
          If you connect social accounts, we store the handle for each platform. Where a platform connection can
          publish for real, we also store the credential that makes it work, such as an access token, an app
          password, or a webhook address. These are used only to publish what you tell us to publish and are never
          shown on any public page.
        </p>
        <p>
          If you use live streaming, we store the stream keys you paste in. They are used only to forward your
          stream to the platforms you chose.
        </p>
        <p>
          Billing runs through Stripe. Your card details go to Stripe directly and never touch our servers. We keep
          the Stripe identifiers needed to know your subscription is active.
        </p>
      </DocSection>

      <DocSection title="What we store about visitors to creator pages">
        <p>
          Page views are counted by day, along with the referring website when the browser sends one. We do not
          store visitor IP addresses in analytics, we do not set tracking cookies on public pages, and we cannot
          follow a visitor from one website to another.
        </p>
        <p>
          If a visitor signs up to a creator&apos;s newsletter, we store that email address on the creator&apos;s
          behalf and show it only to that creator. Messages posted in a creator&apos;s chatroom are stored with the
          name the visitor typed.
        </p>
      </DocSection>

      <DocSection title="Cookies">
        <p>
          The dashboard uses one cookie, which keeps you logged in. Public creator pages set none. Your light or
          dark preference is kept in your own browser and never sent to us.
        </p>
      </DocSection>

      <DocSection title="Who we share data with">
        <p>
          Stripe processes payments. Social platforms receive the posts and streams you explicitly send them. Nobody
          else receives your data, and nothing is shared for advertising.
        </p>
      </DocSection>

      <DocSection title="Deleting your data">
        <p>
          Email{" "}
          <a href="mailto:rileyg0035@gmail.com" className="text-brand hover:underline">
            rileyg0035@gmail.com
          </a>{" "}
          from your account address and ask. We delete your account, your page, your connected credentials and your
          collected subscriber emails. Disconnecting a social account in the dashboard deletes its stored credential
          immediately, and you can also revoke Ensemble&apos;s access from the platform&apos;s own settings at any
          time.
        </p>
      </DocSection>

      <DocSection title="Changes">
        <p>
          If this policy changes in a way that matters, the date at the top changes with it and creators are told in
          the dashboard. Questions go to the same address above.
        </p>
      </DocSection>
    </DocShell>
  );
}
