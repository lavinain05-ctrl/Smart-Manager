import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./index.css";

import { Toaster } from "react-hot-toast";

import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import DataProviders from "./components/common/DataProviders";

createRoot(document.getElementById("root")).render(
  <StrictMode>

    <ThemeProvider>

      <AuthProvider>

        <DataProviders>

          <Toaster
            position="top-right"
            reverseOrder={false}
          />

          <App />

        </DataProviders>

      </AuthProvider>

    </ThemeProvider>

  </StrictMode>
);