import type { Metadata } from "next";

import { CozyBrew } from "./cozy-brew";

export const metadata: Metadata = {
  title: "Onyx Cafe",
  description: "Step inside Onyx — cafe supply sourcing.",
};

// The landing scene. Tapping the table (or "Step inside") dives the
// camera into the coffee cup and hands off to /suppliers.
export default function Home() {
  return <CozyBrew />;
}
