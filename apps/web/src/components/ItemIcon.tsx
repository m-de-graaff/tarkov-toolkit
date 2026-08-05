import { useEffect, useState } from 'react';

// Hosted deployments (same flag the trimmed price feed uses) route icons
// through our edge-cached /api/icons so an assets.tarkov.dev outage doesn't
// break every item row; the raw CDN link is the fallback either way.
const HAS_API = /^(1|true)$/i.test(
  String((import.meta.env?.VITE_PRICES_TRIMMED as string | undefined) ?? ''),
);
const ID_RE = /^[0-9a-f]{24}$/i;

interface ItemIconProps {
  /** item id - enables the same-origin proxy source */
  itemId?: string;
  /** direct CDN link, used as the fallback (and the only source in dev) */
  iconLink?: string;
  className?: string;
  title?: string;
}

/**
 * An item's icon, always decorative (the item name is adjacent text
 * everywhere this renders). Tries the same-origin proxy, then the CDN link;
 * when every source fails it keeps a same-size placeholder so table rows
 * don't reflow while a CDN is flaky.
 */
export function ItemIcon({ itemId, iconLink, className, title }: ItemIconProps) {
  const sources: string[] = [];
  if (HAS_API && itemId && ID_RE.test(itemId)) sources.push(`/api/icons?id=${itemId}`);
  if (iconLink) sources.push(iconLink);

  const [failed, setFailed] = useState(0);
  const key = sources.join('|');
  useEffect(() => setFailed(0), [key]);

  if (sources.length === 0) return null;
  if (failed >= sources.length) {
    return <span aria-hidden="true" className={className} />;
  }
  return (
    <img
      src={sources[failed]}
      alt=""
      loading="lazy"
      {...(title ? { title } : {})}
      onError={() => setFailed((n) => n + 1)}
      className={className}
    />
  );
}
