// Catches render/lifecycle errors below it so a single broken page can't
// white-screen the SPA. The nav stays outside this boundary; a route change
// (resetKey) or "Try again" re-attempts the children, "Reload page" is the
// escape hatch for errors that persist.
import { Button } from '@/components/ui/button';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/monitoring';

interface Props {
  children: ReactNode;
  /** any change (e.g. the pathname) clears a shown error and re-renders */
  resetKey?: string;
}

interface State {
  error: Error | null;
  lastResetKey?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, lastResetKey: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (state.lastResetKey !== props.resetKey) {
      return { error: null, lastResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('render error:', error, info.componentStack);
    reportError(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            This page hit an unexpected error. Your progress is stored on this device and is not
            affected.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => this.setState({ error: null })}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
