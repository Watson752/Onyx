"use client";

import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark";

const THEME_EVENT = "onyx-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onStoreChange);
  window.addEventListener(THEME_EVENT, onStoreChange);
  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
}

// The data-theme attribute is the single source of truth for what is on
// screen: the pre-paint script writes it from storage, and toggle() writes
// it here. No attribute means no override, so the OS setting wins — which
// is exactly what the CSS media query does. Returns a primitive, so
// repeated reads stay referentially stable.
function getSnapshot(): Theme {
  const override = document.documentElement.getAttribute("data-theme");
  if (override === "light" || override === "dark") return override;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function getServerSnapshot(): null {
  return null;
}

export function ThemeToggle() {
  // null on the server and for the first client render, so hydration
  // matches; React re-reads immediately afterwards.
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Blocked storage: the theme still applies for this page view.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
      title={isDark ? "Day mode" : "Night mode"}
      className="flex size-11 items-center justify-center rounded-full border border-line text-espresso-soft hover:border-line-strong hover:text-terracotta"
    >
      {theme === null ? (
        <span className="size-5" />
      ) : isDark ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
        </svg>
      )}
    </button>
  );
}
