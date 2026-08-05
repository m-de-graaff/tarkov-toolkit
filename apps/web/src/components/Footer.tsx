export function Footer() {
  return (
    <footer className="mt-5 border-t pt-2.5 text-[11px] text-muted-foreground">
      <p>
        Quest data ©{' '}
        <a className="text-primary/70 underline-offset-2 hover:underline" href="https://tarkov.dev">
          tarkov.dev
        </a>{' '}
        (CC BY) · Map SVGs ©{' '}
        <a
          className="text-primary/70 underline-offset-2 hover:underline"
          href="https://github.com/the-hideout/tarkov-dev-svg-maps"
        >
          the-hideout
        </a>{' '}
        contributors (MIT)
      </p>
    </footer>
  );
}
