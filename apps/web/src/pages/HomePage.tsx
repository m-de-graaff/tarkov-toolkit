import { Button } from '@/components/ui/button';
import { snapshot } from '@raidplanner/data';
import { Camera, ListChecks, Map as MapIcon, Route } from 'lucide-react';
import { Link } from 'react-router-dom';

function ToolCard({
  to,
  title,
  description,
  soon,
}: {
  to?: string;
  title: string;
  description: string;
  soon?: boolean;
}) {
  const body = (
    <div
      className={
        'flex h-full flex-col gap-1.5 rounded-lg border bg-card p-4 transition-colors' +
        (soon ? ' opacity-60' : ' hover:border-primary/60')
      }
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {soon && (
          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Coming soon
          </span>
        )}
      </div>
      <p className="text-[13px] text-muted-foreground">{description}</p>
    </div>
  );
  return to && !soon ? (
    <Link to={to} className="rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

function Step({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Camera;
  title: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Icon aria-hidden="true" className="size-5 text-primary" />
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-[13px] text-muted-foreground">{text}</p>
    </div>
  );
}

export function HomePage() {
  const renderable = snapshot.maps.filter((m) => m.calibration).length;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-12 px-6 py-14">
        <section className="flex flex-col items-start gap-4">
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight">
            Plan your raids. Track your quests. Know where you are.
          </h1>
          <p className="max-w-xl text-[15px] text-muted-foreground">
            A free toolkit for Escape from Tarkov. Pick a map, see exactly the quests you have
            open, and get the best route drawn for you, live-updated from nothing more than an
            in-game screenshot.
          </p>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link to="/planner">Open the raid planner</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/progress">Set up your progress</Link>
            </Button>
          </div>
        </section>

        <section aria-label="Tools" className="grid gap-3 sm:grid-cols-2">
          <ToolCard
            to="/planner"
            title="Raid Planner"
            description={`${renderable} maps with exact quest objective markers and optimized routes from your spawn or live position.`}
          />
          <ToolCard
            to="/progress"
            title="Quest Progress"
            description={`Tick off what you've finished across ${snapshot.tasks.length} quests - the planner always shows what you can actually do.`}
          />
          <ToolCard
            to="/hideout"
            title="Hideout"
            description="Track station levels; upgrade requirements feed your keep-list."
          />
          <ToolCard
            to="/items"
            title="Items to keep"
            description="One list of everything your open quests and next upgrades consume."
          />
          <ToolCard
            to="/ammo"
            title="Ammo Chart"
            description={`${snapshot.ammo.length} rounds with pen tiers, damage, and velocity - offline.`}
          />
          <ToolCard
            to="/xp"
            title="Skill XP"
            description="The fastest sensible way to level each skill, with a live crafting cost table."
          />
          <ToolCard
            to="/market"
            title="Profit"
            description={`Trader resells, barter flips, and crafts ranked by profit - per PvP/PvE economy.`}
          />
        </section>

        <section aria-label="How live position works" className="flex flex-col gap-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Live position in three steps
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <Step
              icon={MapIcon}
              title="1 · Pick your map"
              text="Choose the map you're raiding and tick the quests you want to run."
            />
            <Step
              icon={Camera}
              title="2 · Press PrtScn in raid"
              text="Your position is encoded in the screenshot's filename - no overlay, no game hooks, nothing uploaded."
            />
            <Step
              icon={Route}
              title="3 · Follow the route"
              text="Your marker appears with your heading, and the quest route re-plans from where you stand."
            />
          </div>
        </section>

        <section className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-[13px] text-muted-foreground">
          <ListChecks aria-hidden="true" className="size-4 shrink-0 text-primary" />
          Everything runs in your browser and saves locally. No account needed.
        </section>
      </div>
    </div>
  );
}
