export default function handler(req, res) {
  const redact = (v, head = 6) => (v ? `present:${String(v).slice(0, head)}...` : "MISSING");

  res.status(200).json({
    // Code / build info (helps spot preview vs local differences)
    branch: process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || "(unknown)",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || "(unknown)",
    nodeEnv: process.env.NODE_ENV,

    // Public client envs (safe to expose)
    NEXT_PUBLIC_SUPABASE_URL: redact(process.env.NEXT_PUBLIC_SUPABASE_URL, 30),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: redact(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 12),
    NEXT_PUBLIC_MAPBOX_TOKEN: redact(process.env.NEXT_PUBLIC_MAPBOX_TOKEN, 12),

    // Server-only check (don’t expose the value)
    GEOAPIFY_API_KEY: process.env.GEOAPIFY_API_KEY ? "present" : "MISSING",

    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID || "(none)",
    runtime: {
      vercel: !!process.env.VERCEL,
      region: process.env.VERCEL_REGION || process.env.FLY_REGION || process.env.AWS_REGION || "(local?)",
    },
    timestamp: new Date().toISOString(),
  });
}