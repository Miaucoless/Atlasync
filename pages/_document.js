/**
 * _document.js
 * Custom HTML document for Next.js.
 * Adds meta tags, the Mapbox GL CSS, and Google Fonts preconnect.
 */

import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Charset & viewport are added by Next.js automatically */}

        {/* App meta */}
        <meta name="description" content="Atlasync — Plan, explore, and sync your travels with a cinematic 3D interface." />
        <meta name="theme-color" content="#050810" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Open Graph */}
        <meta property="og:title"       content="Atlasync — Cinematic Travel Planning" />
        <meta property="og:description" content="Plan your trips with a stunning 3D globe, AI assistance, and offline-first itineraries." />
        <meta property="og:type"        content="website" />

        {/* Mapbox GL CSS — must be loaded globally */}
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css"
          rel="stylesheet"
        />

        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://api.mapbox.com" />
        <link rel="preconnect" href="https://events.mapbox.com" />

        {/* Favicon (SVG globe) */}
        <link
          rel="icon"
          type="image/svg+xml"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='%23050810' stroke='%233B82F6' stroke-width='2'/><ellipse cx='16' cy='16' rx='7' ry='14' fill='none' stroke='%2306B6D4' stroke-width='1.5'/><line x1='2' y1='16' x2='30' y2='16' stroke='%233B82F6' stroke-width='1.5'/></svg>"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
