// Every real app route (canonical, no trailing slash). Shared by the root-page
// deep-link recovery and UrlTidy (QA bug T16-2) so both agree on what counts as
// a genuine sub-route of this static export.
export const APP_ROUTES = new Set<string>([
  "/dashboard",
  "/tasks",
  "/calendar",
  "/goals",
  "/assessments",
  "/habits",
  "/finances",
  "/analytics",
  "/reviews",
  "/settings",
  "/login",
  "/register",
  "/onboarding",
])
