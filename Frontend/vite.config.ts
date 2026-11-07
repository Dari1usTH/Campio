import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
 plugins:[tanstackRouter({target:"react",autoCodeSplitting:true}),react(),tailwindcss()],
 resolve:{alias:{"@":path.resolve(import.meta.dirname,"./src")},dedupe:["react","react-dom","@tanstack/react-router"]},
 server:{host:"0.0.0.0",port:5173,proxy:{"/api":{target:process.env["API_PROXY_TARGET"]??"http://127.0.0.1:8080",changeOrigin:false},"/health":{target:process.env["API_PROXY_TARGET"]??"http://127.0.0.1:8080"}}},
 build:{outDir:"dist",sourcemap:false},
});
