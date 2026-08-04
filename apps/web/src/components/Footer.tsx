import { snapshot } from '@raidplanner/data';

export function Footer() {
  const date = snapshot.generatedAt.slice(0, 10);
  return (
    <footer className="sidebar-footer">
      <p>
        Quest data © <a href="https://tarkov.dev">tarkov.dev</a> (CC BY) · Map SVGs ©{' '}
        <a href="https://github.com/the-hideout/tarkov-dev-svg-maps">the-hideout</a> contributors
        (MIT)
      </p>
      <p>
        Data snapshot: {date} — refresh with <code>pnpm snapshot</code>
      </p>
    </footer>
  );
}
