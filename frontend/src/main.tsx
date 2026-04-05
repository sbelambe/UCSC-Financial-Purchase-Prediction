  // Entry point of the React application, rendering the main App component into the root DOM element
  import { createRoot } from "react-dom/client";
  import App from "./App";
  import "./index.css";

  createRoot(document.getElementById("root")!).render(<App />);
  