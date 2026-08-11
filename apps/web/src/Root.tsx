import AOS from "aos";
import "aos/dist/aos.css";
import { useEffect } from "react";

import App from "./App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { AuthProvider } from "./auth/AuthProvider";

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
        <App />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export { Root };
