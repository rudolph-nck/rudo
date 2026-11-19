// If a page throws while drawing, show what happened (and a way to copy it) instead of a blank screen.
import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    const details = `Core Work Hub error\n${new Date().toString()}\n${location.hash}\n${e.message}\n${e.stack ?? ''}`;
    return (
      <div className="gate">
        <div className="gate-card" role="alert">
          <div className="brand"><span className="brand-mark" aria-hidden>CW</span>Core Work Hub</div>
          <h1>Something went wrong on this page</h1>
          <p style={{ margin: 0 }}>Your work is saved. Copy the details below and send them to Nick, then reload.</p>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', background: 'var(--surface-2)', padding: 10, borderRadius: 8, margin: 0 }}>{e.message}</pre>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => void navigator.clipboard?.writeText(details)}>Copy details</button>
            <button className="btn" onClick={() => { location.hash = '#/overview'; location.reload(); }}>Go to Overview</button>
            <button className="btn primary" onClick={() => location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}
