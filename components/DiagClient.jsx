"use client";

import { useEffect, useState } from "react";

export default function DiagClient() {
  const [serverDiag, setServerDiag] = useState(null);

  useEffect(() => {
    fetch("/api/diag")
      .then((r) => r.json())
      .then(setServerDiag)
      .catch((err) => setServerDiag({ error: String(err) }));
  }, []);

  const client = {
    url: typeof window !== "undefined" ? window.location.href : "(no window)",
    userLang: typeof navigator !== "undefined" ? navigator.language : "(no navigator)",
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      ? "present:pk..." + process.env.NEXT_PUBLIC_MAPBOX_TOKEN.slice(10, 16)
      : "MISSING",
    build: {
      NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID || "(none)",
    },
  };

  return (
    <div style={{ padding: 16, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
      <h1>Diagnostics</h1>
      <h2>Client</h2>
      <pre>{JSON.stringify(client, null, 2)}</pre>
      <h2>Server</h2>
      <pre>{JSON.stringify(serverDiag, null, 2)}</pre>
      <p>Open this page on both environments (Claude desktop preview and localhost) and compare values.</p>
    </div>
  );
}