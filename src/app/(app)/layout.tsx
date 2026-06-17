
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </main>
      </div>
    </WorkspaceProvider>
  );
}
