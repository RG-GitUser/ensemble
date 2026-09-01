import { getPlatform } from "@/lib/social";
import { DEFAULT_FRAME, getFrame } from "@/lib/theme";
import type { SiteConfig, SocialAccount } from "@/lib/types";

/**
 * The storefront layout's pinned profile column.
 *
 * Everything here is optional except the portrait. A creator who uploads only
 * an image still gets a panel that reads correctly: the name falls back to
 * their business name, and the icon row to whatever accounts they already
 * connected on the Socials tab, so the panel is populated before they have
 * typed anything into it.
 *
 * Rendered on the server alongside the sections, so it inherits the page's
 * fonts, palette and colour mode without carrying any of its own.
 */
export function ProfilePanel({
  name,
  config,
  accounts,
  variant = "panel",
}: {
  name: string;
  config: SiteConfig;
  accounts: SocialAccount[];
  /**
   * "panel" is the storefront's pinned column. "header" is the same content
   * centred above the page, which is how every other layout shows it: those
   * arrange sections down or across the page and have no side column to pin
   * anything to.
   */
  variant?: "panel" | "header";
}) {
  const frame = getFrame(config.profileFrame)?.id ?? DEFAULT_FRAME;
  const links = accounts
    .map((a) => ({ account: a, platform: getPlatform(a.platform) }))
    .filter((l): l is { account: SocialAccount; platform: NonNullable<ReturnType<typeof getPlatform>> } => !!l.platform);

  return (
    <aside className={variant === "header" ? "site-profile site-profile-header" : "site-profile"}>
      {config.profileImage && (
        <div className={`site-portrait site-frame-${frame}`}>
          {/* A plain img, not next/image: this URL is a creator upload served
              from our own route, and the panel is one fixed size, so there is
              nothing for the optimiser to decide. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={config.profileImage} alt={name} />
        </div>
      )}
      <h2 className="site-profile-name">{name}</h2>
      {config.profileHandle && <p className="site-profile-handle">{config.profileHandle}</p>}
      {config.profileLocation && <p className="site-profile-where">{config.profileLocation}</p>}
      {links.length > 0 && (
        <div className="site-profile-links">
          {links.map(({ account, platform }) => (
            <a
              key={account.id}
              href={platform.profileUrl(account.handle)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={platform.name}
              title={platform.name}
            >
              <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden>
                <path d={platform.iconPath} fill="currentColor" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </aside>
  );
}
