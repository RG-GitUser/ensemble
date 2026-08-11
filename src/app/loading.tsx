import { LoadingScreen } from "@/components/LoadingScreen";

/** App-wide fallback. Routes with their own loading.tsx (e.g. /dashboard)
    override this so their chrome stays on screen. */
export default function Loading() {
  return <LoadingScreen />;
}
