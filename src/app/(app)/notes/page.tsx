"use client";

import { useState } from "react";
import { Plus, Search, StickyNote, MoreVertical, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MOCK_NOTES = [
  { id: "n1", title: "Meeting Notes: UX Research", content: "Discussed the new onboarding flow. Users found the workspace choice confusing...", date: "Jun 20, 2024", type: "workspace", link: "Dashboard v2" },
  { id: "n2", title: "Ideas for Sprint 4", content: "1. Add dark mode\n2. Integrate Slack\n3. Better report export", date: "Jun 21, 2024", type: "personal", link: null },
  { id: "n3", title: "API Endpoint Specs", content: "Auth/Register: POST /api/v1/auth/register. Requires: email, password, name...", date: "Jun 22, 2024", type: "workspace", link: "PWA Service Worker" },
];

export default function NotesPage() {
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notes</h1>
          <p className="text-muted-foreground">Keep your thoughts and project details organized</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="flex items-center gap-2">
            New Personal Note
          </Button>
          <Button className="flex items-center gap-2 shadow-lg shadow-primary/20">
            <Plus className="w-5 h-5" /> New Workspace Note
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            className="pl-10 border-none shadow-none focus-visible:ring-0" 
            placeholder="Search notes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {MOCK_NOTES.map((note) => (
          <Card key={note.id} className="border-none shadow-sm hover:shadow-md transition-all group relative">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="p-2 bg-primary/5 rounded-lg">
                <StickyNote className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={note.type === 'workspace' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                  {note.type}
                </Badge>
                <button className="text-muted-foreground hover:text-foreground">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="font-bold text-lg mb-2 line-clamp-1">{note.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-4 min-h-[5rem]">
                {note.content}
              </p>
            </CardContent>
            <CardFooter className="flex flex-col items-start gap-2 pt-0 border-t mt-4 pt-4">
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-bold text-muted-foreground">{note.date}</span>
                {note.link && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-primary">
                    <LinkIcon className="w-3 h-3" /> {note.link}
                  </div>
                )}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}