import { ColorSchemeScript } from "@mantine/core";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./App";
import "@mantine/core/styles.css";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
ReactDOM.createRoot(rootElement).render(
  <>
    <ColorSchemeScript defaultColorScheme="light" />
    <App />
  </>,
);
