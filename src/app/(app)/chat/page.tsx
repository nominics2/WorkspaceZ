"use client";

import { useState } from "react";
import { 
  Send, 
  Smile, 
  Paperclip, 
  MoreVertical, 
  CheckSquare, 
  Plus,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

const MOCK_MESSAGES = [
  { id: "m1", user: "Alex Johnson", text: "Hey team, we need to finalize the project specs by Friday.", time: "10:30 AM", isMe: true },
  { id: "m2", user: "Sarah Miller", text: "I'm on it. I'll have the draft ready by tomorrow afternoon.", time: "10:35 AM", isMe: false },
  { id: "m3", user: "Sarah Miller", text: "Wait, actually could someone help me with the API documentation part?", time: "10:36 AM", isMe: false },
];

export default function ChatPage() {
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState("");
  const { toast } = useToast();

  const handleSend = () => {
    if (!input.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      user: "Alex Johnson",
      text: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true
    };
    setMessages([...messages, newMessage]);
    setInput("");
  };

  const handleCreateTaskFromMessage = (text: string) => {
    toast({
      title: "Task Created",
      description: `Task created from message: "${text.substring(0, 30)}..."`,
    });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workspace Chat</h1>
          <p className="text-muted-foreground">Collaborate with your team members</p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col border-none shadow-xl overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-bold">#</span>
            </div>
            <div>
              <p className="font-bold">General Channel</p>
              <p className="text-xs text-muted-foreground">12 members online</p>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-6 bg-slate-50/50">
          <div className="space-y-6">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.isMe ? "flex-row-reverse" : ""}`}>
                <Avatar className="w-10 h-10">
                  <AvatarFallback>{msg.user[0]}</AvatarFallback>
                </Avatar>
                <div className={`max-w-[70%] group ${msg.isMe ? "items-end" : "items-start"}`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-bold">{msg.user}</span>
                    <span className="text-[10px] text-muted-foreground">{msg.time}</span>
                  </div>
                  <div className="relative">
                    <div className={`p-4 rounded-2xl shadow-sm ${msg.isMe ? "bg-primary text-white rounded-tr-none" : "bg-white text-foreground rounded-tl-none border"}`}>
                      {msg.text}
                    </div>
                    {/* Floating Message Action */}
                    <div className={`absolute top-0 -right-12 opacity-0 group-hover:opacity-100 transition-opacity`}>
                       <Button 
                         variant="secondary" 
                         size="icon" 
                         className="h-8 w-8 rounded-full shadow-md"
                         onClick={() => handleCreateTaskFromMessage(msg.text)}
                         title="Create task from message"
                       >
                         <CheckSquare className="w-4 h-4" />
                       </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="p-4 bg-white border-t">
          <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-xl">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
              <Paperclip className="w-5 h-5" />
            </Button>
            <Input 
              className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base" 
              placeholder="Type your message..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
              <Smile className="w-5 h-5" />
            </Button>
            <Button size="icon" className="rounded-lg shadow-lg shadow-primary/20" onClick={handleSend}>
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}