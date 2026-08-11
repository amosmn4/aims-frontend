import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Default staleTime was 0 (React Query's own default) — every mount, window refocus, and
  // back-navigation was refetching, even for data that had loaded seconds earlier. 30s matches
  // the TTL already used for cached aggregates on the backend: navigating between pages you were
  // just on feels instant instead of re-hitting the network every time.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload a route's data on link hover/touchstart (TanStack Router's own "intent" preload),
    // so by the time a click lands the next page's data request is already in flight or done.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
