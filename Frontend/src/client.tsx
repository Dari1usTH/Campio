import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { initializeSession } from "./services/auth";
import { themeInitScript } from "./hooks/use-theme";
import "./styles.css";

const themeScript=document.createElement("script");themeScript.textContent=themeInitScript;document.head.appendChild(themeScript);themeScript.remove();
const router=getRouter();
void initializeSession();
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><RouterProvider router={router}/></React.StrictMode>);
declare module "@tanstack/react-router" {interface Register {router:typeof router;}}
