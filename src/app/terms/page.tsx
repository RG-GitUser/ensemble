import type { Metadata } from "next";
import { DocSection, DocShell } from "@/components/DocShell";

export const metadata: Metadata = {
  title: "Terms — Ensemble",
  description: "The rules of using Ensemble, in plain language.",
};

export default function TermsPage() {
  return (
    <DocShell>
      <h1 className="text-3xl font-bold tracking-tight">Terms of service</h1>
      <p className="mt-2 text-sm text-mist">Last updated August 2026.</p>

      <DocSection title="What Ensemble is">
        <p>
          Ensemble gives creators a hosted page, a dashboard, and tools that connect to their own accounts on other
          platforms. By creating an account you agree to these terms. If you don&apos;t agree, don&apos;t use the
          service.
        </p>
      </DocSection>

      <DocSection title="Your account">
        <p>
          You&apos;re responsible for what happens under your login. Keep your password to yourself, and tell us if
          you think someone else has it. You must be legally able to enter this agreement where you live.
        </p>
      </DocSection>

      <DocSection title="Your content stays yours">
        <p>
          Everything you put on your page belongs to you. You give us permission to store and serve it, because
          hosting a page is impossible otherwise. We claim nothing beyond that, and we never take a percentage of
          anything you sell.
        </p>
        <p>
          You may only publish what you have the right to publish. No stolen work, no impersonation, nothing
          illegal, and nothing designed to harm the people who visit your page.
        </p>
      </DocSection>

      <DocSection title="Connected platforms">
        <p>
          Social connections, publishing and live streaming operate on your own accounts, with credentials you
          provide, and each platform&apos;s own rules keep applying. Only connect accounts and stream keys that are
          yours. If a platform suspends you for what you posted through Ensemble, that is between you and the
          platform.
        </p>
      </DocSection>

      <DocSection title="Billing">
        <p>
          Plans are billed monthly through Stripe. You can change plan or cancel whenever you like, and switching
          plans never deletes your content. Features above your plan&apos;s limit simply come off the live page until
          you upgrade again. Prices can change with notice ahead of your next billing cycle.
        </p>
      </DocSection>

      <DocSection title="Our brand">
        <p>
          The Ensemble name, wordmark and look are ours. Don&apos;t present your page or product as being Ensemble
          itself, and don&apos;t use the brand in a way that suggests we made or endorsed something we didn&apos;t.
        </p>
      </DocSection>

      <DocSection title="What we promise, honestly">
        <p>
          We work to keep the service fast and available, and we take backups seriously. Even so, the service is
          provided as it is, without a guarantee of uninterrupted uptime. To the extent the law allows, our
          liability is limited to what you paid us in the three months before the problem.
        </p>
      </DocSection>

      <DocSection title="Ending things">
        <p>
          You can delete your account whenever you want, as described on the{" "}
          <a href="/privacy" className="text-brand hover:underline">privacy page</a>. We can suspend accounts that
          break these terms, and where possible we&apos;ll warn you first and say why.
        </p>
      </DocSection>

      <DocSection title="Contact">
        <p>
          Questions about these terms go to{" "}
          <a href="mailto:rileyg0035@gmail.com" className="text-brand hover:underline">rileyg0035@gmail.com</a>.
        </p>
      </DocSection>
    </DocShell>
  );
}
