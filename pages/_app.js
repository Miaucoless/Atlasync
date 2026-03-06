/**
 * _app.js
 * Global Next.js app wrapper.
 * - Imports global CSS
 * - Wraps every page in the Layout component
 * - Initialises the offline cache
 */

import { useEffect } from 'react';
import Layout from '../components/Layout';
import { initCache, seedDemoData } from '../utils/offlineCache';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  // Initialise offline cache & seed demo data on first load
  useEffect(() => {
    initCache();
    seedDemoData();
  }, []);

  // Pages can opt out of the Layout or customise it via static properties
  const hideNav   = Component.hideNav   ?? false;
  const fullBleed = Component.fullBleed ?? false;

  return (
    <Layout hideNav={hideNav} fullBleed={fullBleed}>
      <Component {...pageProps} />
    </Layout>
  );
}
