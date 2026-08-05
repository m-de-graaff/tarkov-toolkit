// Per-route SEO metadata for the SPA. Google renders JS, so keeping the
// title, description and canonical in sync per route is what gets the tool
// pages indexed individually.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const SITE_URL = 'https://tarkovtoolkit.vercel.app';
const SITE_NAME = 'Tarkov Toolkit';

interface RouteMeta {
  title: string;
  description: string;
}

const META: Record<string, RouteMeta> = {
  '/': {
    title: 'Tarkov Toolkit - Raid Planner, Quest Tracker & Profit Tools for Escape from Tarkov',
    description:
      'Free Escape from Tarkov toolkit: plan walkable raid routes on real maps, track quests and hideout progress, compare ammo, find profitable flea trades and level skills faster. No install needed.',
  },
  '/planner': {
    title: `Raid Planner - interactive EFT maps with quest routes | ${SITE_NAME}`,
    description:
      'Plan your Escape from Tarkov raids on interactive maps: pick your quests, get an optimized walkable route from spawn to extract that avoids water, walls and minefields, with floor-aware pathing.',
  },
  '/progress': {
    title: `Quest Tracker - all EFT quests with unlock logic | ${SITE_NAME}`,
    description:
      'Track every Escape from Tarkov quest across PvP and PvE profiles. Tick what you finished and instantly see which quests are open, locked or Kappa-required - synced across devices with a free account.',
  },
  '/hideout': {
    title: `Hideout Tracker - upgrade requirements and materials | ${SITE_NAME}`,
    description:
      'Plan Escape from Tarkov hideout upgrades: every station, level requirement and material, with a have/need inventory and ready-to-build indicators.',
  },
  '/items': {
    title: `Items to Keep - quest and hideout hand-ins | ${SITE_NAME}`,
    description:
      'Know which Escape from Tarkov items to keep: everything your open quests and next hideout upgrades need, found-in-raid flags included.',
  },
  '/ammo': {
    title: `Ammo Chart - damage, penetration and armor effectiveness | ${SITE_NAME}`,
    description:
      'Escape from Tarkov ammo chart with damage, penetration power and per-armor-class effectiveness for every round, sortable and searchable.',
  },
  '/market': {
    title: `Flea Market Profit - trader flips, barters and crafts | ${SITE_NAME}`,
    description:
      'Find profitable Escape from Tarkov trades with live flea prices: trader-to-flea flips, barter profit and craft profit per hour, for PvP and PvE economies.',
  },
  '/xp': {
    title: `XP & Skill Leveling Guides - proven per-raid routines | ${SITE_NAME}`,
    description:
      'Level Escape from Tarkov skills faster: researched per-raid routines for Metabolism, Strength, Endurance and 18 more skills, plus the best hideout crafts to run for Crafting XP.',
  },
};

function setMeta(selector: string, attr: string, value: string, create: () => HTMLElement) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/** Mount once under the router: keeps title/description/canonical per route. */
export function RouteMetaSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = META[pathname] ?? META['/'];
    document.title = meta.title;
    setMeta('meta[name="description"]', 'content', meta.description, () => {
      const m = document.createElement('meta');
      m.setAttribute('name', 'description');
      return m;
    });
    setMeta('link[rel="canonical"]', 'href', `${SITE_URL}${pathname === '/' ? '/' : pathname}`, () => {
      const l = document.createElement('link');
      l.setAttribute('rel', 'canonical');
      return l;
    });
    setMeta('meta[property="og:title"]', 'content', meta.title, () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:title');
      return m;
    });
    setMeta('meta[property="og:description"]', 'content', meta.description, () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:description');
      return m;
    });
    setMeta('meta[property="og:url"]', 'content', `${SITE_URL}${pathname}`, () => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:url');
      return m;
    });
  }, [pathname]);
  return null;
}
