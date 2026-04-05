import { ColorSchemeScript } from "@mantine/core";
import ReactDOM from "react-dom/client";
import QuickNoteApp from "./QuickNoteApp";
import "@mantine/core/styles.css";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
ReactDOM.createRoot(rootElement).render(
  <>
    <ColorSchemeScript defaultColorScheme="light" />
    <QuickNoteApp />
  </>,
);
