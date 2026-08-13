import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Root } from "./Root";
import "./index.css";
import "./modules"; // Initialize module registry

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
