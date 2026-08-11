import AOS from "aos";
import "aos/dist/aos.css";
import { useEffect } from "react";

import App from "./App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { AuthProvider } from "./auth/AuthProvider";

import { OrgProvider } from "./org/OrgProvider";

function Root() {
  useEffect(() => {
    AOS.init({
      duration: 700,
      easing: "ease-out-cubic",
      once: true,
      offset: 30,
    });
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <OrgProvider>
          <App />
        </OrgProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export { Root };
