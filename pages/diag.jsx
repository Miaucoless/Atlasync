import dynamic from "next/dynamic";

const DiagClient = dynamic(() => import("../components/DiagClient"), {
  ssr: false, // <-- critical: render only on the client to avoid hydration mismatch
});

export default function DiagPage() {
  return <DiagClient />;
}
