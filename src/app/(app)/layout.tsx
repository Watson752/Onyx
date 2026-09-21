import { Nav } from "@/components/nav";

// Every working screen (suppliers, request, price, approve, dispatch)
// sits under the site header. The landing scene at "/" lives outside
// this group so it can take the whole viewport without a nav bar.
export default function AppLayout({ children }: LayoutProps<"/"> ) {
  return (
    <>
      <Nav />
      <div className="pb-[env(safe-area-inset-bottom,0px)]">{children}</div>
    </>
  );
}
