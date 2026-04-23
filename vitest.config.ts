import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";

// Matcha `vite.config.js` (sveltekit + tailwind) så komponent- och Svelte-sökvägar beter sig likt.
export default defineConfig({
  plugins: [sveltekit(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
  },
});
