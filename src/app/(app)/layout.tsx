import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { WorkspaceProvider } from "@/components/providers/WorkspaceProvider";
import { GlobalSearch } from "@/components/dashboard/GlobalSearch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <SidebarNav />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0 z-20">
            <GlobalSearch />
            <div className="flex items-center gap-4">
               <div className="hidden md:block text-right">
                  <p className="text-xs font-bold leading-none mb-1">WorkspaceZ</p>
                  <p className="text-[10px] text-muted-foreground">Productivity Suite</p>
               </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
