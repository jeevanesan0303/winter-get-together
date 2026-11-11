
import { lazy, Suspense } from "react";

import App from "./App";

const AdminApp = lazy(() => import("./admin/AdminApp"));

export default function Root() {
  const pathname = window.location.pathname;

  const isAdminRoute =
    pathname === "/admin" ||
    pathname === "/admin/" ||
    pathname.startsWith("/admin/");

  if (isAdminRoute) {
    return (
      <Suspense
        fallback={
          <div
            style={{
              minHeight: "100vh",
              display: "grid",
              placeItems: "center",
              background: "#091c43",
              color: "#ffffff",
            }}
          >
            Loading Admin Dashboard...
          </div>
        }
      >
        <AdminApp />
      </Suspense>
    );
  }

  return <App />;
}
