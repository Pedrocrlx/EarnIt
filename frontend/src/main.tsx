import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <head>
      <link rel="icon" type="image/x-icon" href="/favicon.ico"></link>
    </head>
    <App />
  </StrictMode>,
);
