/**
 * GlobeErrorBoundary.js
 * Catches WebGL/Three.js errors in Globe to prevent crash-triggered dev reload loops.
 * Renders a static gradient fallback when the Globe fails (e.g. WebGL blocked by extensions).
 */

import { Component } from 'react';

export default class GlobeErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err) {
    console.warn('[Atlasync] Globe failed to load (WebGL/extensions may be blocked):', err?.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#030b20] via-[#051230] to-[#030b20]"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.08) 0%, transparent 60%)',
          }}
        />
      );
    }
    return this.props.children;
  }
}
