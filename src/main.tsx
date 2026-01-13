import ReactDOM from "react-dom/client";
import { ColorSchemeScript } from "@mantine/core";
import "./i18n";
import App from "./App";
import "@mantine/core/styles.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <>
    <ColorSchemeScript defaultColorScheme="light" />
    <App />
  </>,
);
