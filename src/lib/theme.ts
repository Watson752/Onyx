// Shared by the server layout's pre-paint script and the client toggle, so
// it must live outside the "use client" module: a value imported from a
// client module reaches the server as a client reference, not a string.
export const THEME_STORAGE_KEY = "onyx-theme";
