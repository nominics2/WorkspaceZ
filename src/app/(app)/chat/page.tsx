"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  Send, 
  Search, 
  Plus, 
  ChevronLeft, 
  Hash, 
  MoreVertical, 
  Paperclip, 
  Smile,
  MessageSquare,
  CheckCheck,
  Loader2,
  AlertCircle,
  UserPlus,
  User,
  Check,
  Users,
  X,
  FileIcon,
  Download,
  Image as ImageIcon,
  ExternalLink,
  Files,
  ArrowDown,
  BellOff,
  Bell,
  MessageCircle,
  Minus,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuCheckboxItem, 
  DropdownMenuTrigger, 
  DropdownMenuItem 
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size_bytes: number;
  message_id: string;
  created_at: string;
  signed_url?: string;
}

interface Chat {
  id: string;
  name: string;
  type: string;
  workspace_id: string;
  last_message?: string;
  last_message_at?: string;
  created_at: string;
  // Resolved fields for UI
  display_name?: string;
  display_avatar?: string;
  display_avatar_preset?: string;
}

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
    avatar_preset: string;
  } | null;
  attachments?: Attachment[];
  // Transient field for global search context
  channel_display_name?: string;
}

interface WorkspaceMemberProfile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  avatar_preset: string;
  email: string;
  role?: string;
}

interface ChatUnreadCount {
  channel_id: string;
  unread_count: number;
  latest_message_at: string;
}

interface ChatMuteState {
  channel_id: string;
  is_muted: boolean;
  muted_until: string | null;
}

const BUBBLE_COLORS = [
  'ring-blue-500 bg-blue-500',
  'ring-indigo-500 bg-indigo-500',
  'ring-violet-500 bg-violet-500',
  'ring-purple-500 bg-purple-500',
  'ring-fuchsia-500 bg-fuchsia-500',
  'ring-pink-500 bg-pink-500',
  'ring-rose-500 bg-rose-500',
  'ring-orange-500 bg-orange-500',
  'ring-amber-500 bg-amber-500',
  'ring-emerald-500 bg-emerald-500',
  'ring-teal-500 bg-teal-500',
  'ring-cyan-500 bg-cyan-500',
  'ring-sky-500 bg-sky-500'
];

const getChannelBubbleColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BUBBLE_COLORS[Math.abs(hash) % BUBBLE_COLORS.length];
};

export default function ChatPage() {
  const { activeWorkspace, userProfile } = useWorkspace();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [muteStates, setMuteStates] = useState<Record<string, { is_muted: boolean, muted_until: string | null }>>({});
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Floating Bubbles State
  const [floatingBubbles, setFloatingBubbles] = useState<Chat[]>([]);
  const [expandedBubbleId, setExpandedBubbleId] = useState<string | null>(null);

  // Search in Chat state (Contextual)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState("");
  const [inChatSearchResults, setInChatSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Global Message Search state (Sidebar)
  const [globalSearchResults, setGlobalSearchResults] = useState<Message[]>([]);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);
  const [pendingJumpMessageId, setPendingHighlightMessageId] = useState<string | null>(null);

  // Attachment State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Gallery State
  const [isMediaSheetOpen, setIsMediaSheetOpen] = useState(false);
  const [allMedia, setAllMedia] = useState<Attachment[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // New Chat Modal State
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [chatMode, setChatMode] = useState<"direct" | "group">("direct");
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberProfile[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const { toast } = useToast();

  const serializeSupabaseError = (error: any) => {
    if (!error) return null;
    return {
      message: error.message || "Unknown error",
      details: error.details,
      hint: error.hint,
      code: error.code
    };
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const sanitizeFileName = (name: string) => {
    const timestamp = Date.now();
    const cleanName = name.replace(/[^\w\d.-]/g, '_');
    return `${timestamp}-${cleanName}`;
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const isAtBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!viewport) return true;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    // Buffer of 150px to account for small gaps
    return scrollHeight - scrollTop <= clientHeight + 150;
  };

  const fetchUnreadCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_chat_unread_counts");
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data as ChatUnreadCount[]).forEach(item => {
        counts[item.channel_id] = item.unread_count;
      });
      setUnreadCounts(counts);
    } catch (err) {
      console.error("[Chat] Error fetching unread counts:", serializeSupabaseError(err));
    }
  }, [supabase]);

  const fetchMuteStates = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_chat_mute_states");
      if (error) throw error;

      const mutes: Record<string, { is_muted: boolean, muted_until: string | null }> = {};
      (data as ChatMuteState[]).forEach(item => {
        mutes[item.channel_id] = { 
          is_muted: item.is_muted, 
          muted_until: item.muted_until 
        };
      });
      setMuteStates(mutes);
    } catch (err) {
      console.error("[Chat] Error fetching mute states:", serializeSupabaseError(err));
    }
  }, [supabase]);

  const markAsRead = useCallback(async (channelId: string) => {
    try {
      const { error } = await supabase.rpc("mark_chat_channel_read", { p_channel_id: channelId });
      if (error) throw error;
      
      setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
    } catch (err) {
      console.error("[Chat] Error marking channel as read:", serializeSupabaseError(err));
    }
  }, [supabase]);

  const fetchChats = useCallback(async () => {
    if (!userProfile) return;
    
    setLoadingChats(true);
    setError(null);
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', userProfile.id)
        .eq('status', 'active');

      if (memberError) throw memberError;
      if (!memberData || memberData.length === 0) {
        setChats([]);
        return;
      }

      const workspaceIds = memberData.map(m => m.workspace_id);
      
      const { data: channelsData, error: channelsError } = await supabase
        .from('chat_channels')
        .select('id, workspace_id, sub_workspace_id, name, type, created_at')
        .in('workspace_id', workspaceIds)
        .order('created_at', { ascending: false });

      if (channelsError) throw channelsError;
      if (!channelsData || channelsData.length === 0) {
        setChats([]);
        return;
      }

      const channelIds = channelsData.map(c => c.id);

      const [messagesRes, participantsRes] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('id, channel_id, message, created_at')
          .in('channel_id', channelIds)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('chat_channel_members')
          .select('channel_id, user_id, profiles(full_name, avatar_url, avatar_preset)')
          .in('channel_id', channelIds),
        fetchUnreadCounts(),
        fetchMuteStates()
      ]);

      const lastMessages = messagesRes.data || [];
      const participants = participantsRes.data || [];

      const formattedChats: Chat[] = channelsData.map(channel => {
        const lastMsg = lastMessages.find(m => m.channel_id === channel.id);
        
        let displayName = channel.name;
        let displayAvatar = null;
        let displayAvatarPreset = null;

        if (channel.type === 'direct') {
          const otherMember = (participants as any[]).find(
            p => p.channel_id === channel.id && p.user_id !== userProfile.id
          );
          if (otherMember?.profiles) {
            displayName = otherMember.profiles.full_name;
            displayAvatar = otherMember.profiles.avatar_url;
            displayAvatarPreset = otherMember.profiles.avatar_preset;
          }
        }

        return {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          workspace_id: channel.workspace_id,
          last_message: lastMsg?.message,
          last_message_at: lastMsg?.created_at,
          created_at: channel.created_at,
          display_name: displayName,
          display_avatar: displayAvatar,
          display_avatar_preset: displayAvatarPreset
        };
      }).sort((a, b) => {
        // Pin General to top
        const isAGeneral = a.name.toLowerCase() === 'general' && (activeWorkspace ? a.workspace_id === activeWorkspace.id : true);
        const isBGeneral = b.name.toLowerCase() === 'general' && (activeWorkspace ? b.workspace_id === activeWorkspace.id : true);
        if (isAGeneral) return -1;
        if (isBGeneral) return 1;
        
        const timeA = new Date(a.last_message_at || a.created_at || 0).getTime();
        const timeB = new Date(b.last_message_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setChats(formattedChats);
      
      // Auto-select first chat if none selected and not on mobile
      if (!selectedChatId && formattedChats.length > 0 && !showConversation) {
        setSelectedChatId(formattedChats[0].id);
      }
    } catch (err: any) {
      console.error("[Chat] Load Error:", serializeSupabaseError(err));
      setError(err.message || "An unexpected error occurred while loading chats.");
    } finally {
      setLoadingChats(false);
    }
  }, [userProfile, supabase, activeWorkspace, selectedChatId, showConversation, fetchUnreadCounts, fetchMuteStates]);

  const fetchMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true);
    try {
      const [msgDataRes, attachDataRes] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('id, channel_id, workspace_id, sender_id, message, created_at, is_deleted')
          .eq('channel_id', channelId)
          .eq('is_deleted', false)
          .order('created_at', { ascending: true }),
        supabase
          .from('chat_message_attachments')
          .select('*')
          .eq('channel_id', channelId)
      ]);

      if (msgDataRes.error) throw msgDataRes.error;
      const msgData = msgDataRes.data || [];
      const attachData = attachDataRes.data || [];

      if (!msgData || msgData.length === 0) {
        setMessages([]);
        return;
      }

      // Generate signed URLs for all attachments in bulk
      let enrichedAttachments: Attachment[] = [...attachData];
      if (attachData.length > 0) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('chat-attachments')
          .createSignedUrls(attachData.map(a => a.file_path), 3600);
        
        if (!signedError && signedData) {
          enrichedAttachments = attachData.map(a => {
            const signedInfo = signedData.find(s => s.path === a.file_path);
            return { ...a, signed_url: signedInfo?.signedUrl };
          });
        }
      }

      const senderIds = Array.from(new Set(msgData.map(m => m.sender_id)));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_preset')
        .in('id', senderIds);

      const enrichedMessages: Message[] = msgData.map(m => ({
        ...m,
        profiles: profilesData?.find(p => p.id === m.sender_id) || null,
        attachments: enrichedAttachments.filter(a => a.message_id === m.id)
      }));

      setMessages(enrichedMessages);
      
      // Auto-scroll logic with a small delay for DOM layout
      setTimeout(() => {
        scrollToBottom("auto");
        // If we have a pending highlight from a global search jump
        if (pendingJumpMessageId) {
          const element = document.getElementById(`message-${pendingJumpMessageId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMessageId(pendingJumpMessageId);
            setTimeout(() => setHighlightedMessageId(null), 3000);
          }
          setPendingHighlightMessageId(null);
        }
      }, 100);
    } catch (err: any) {
      console.error("[Chat] Message Load Error:", serializeSupabaseError(err));
      toast({ variant: "destructive", title: "Sync Error", description: err.message });
    } finally {
      setLoadingMessages(false);
    }
  }, [supabase, toast, scrollToBottom, pendingJumpMessageId]);

  const fetchMembers = useCallback(async () => {
    if (!activeWorkspace || !userProfile) return;
    setLoadingMembers(true);
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('workspace_members')
        .select('user_id, role, status')
        .eq('workspace_id', activeWorkspace.id)
        .eq('status', 'active');

      if (memberError) throw memberError;

      if (memberData && memberData.length > 0) {
        const uids = memberData.map(m => m.user_id).filter(id => id !== userProfile.id);
        
        if (uids.length > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, avatar_preset, email')
            .in('id', uids);

          if (profileError) throw profileError;

          const enriched = profileData.map(p => ({
            ...p,
            role: memberData.find(m => m.user_id === p.id)?.role
          }));
          setWorkspaceMembers(enriched);
        } else {
          setWorkspaceMembers([]);
        }
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "Unable to load workspace roster." });
    } finally {
      setLoadingMembers(false);
    }
  }, [activeWorkspace, userProfile, supabase, toast]);

  const fetchMedia = useCallback(async () => {
    if (!selectedChatId) return;
    setLoadingMedia(true);
    try {
      const { data: attachData, error: attachError } = await supabase
        .from('chat_message_attachments')
        .select('*')
        .eq('channel_id', selectedChatId)
        .order('created_at', { ascending: false });

      if (attachError) throw attachError;
      if (!attachData || attachData.length === 0) {
        setAllMedia([]);
        return;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrls(attachData.map(a => a.file_path), 3600);
      
      const enriched = attachData.map(a => {
        const signedInfo = signedData?.find(s => s.path === a.file_path);
        return { ...a, signed_url: signedInfo?.signedUrl };
      });

      setAllMedia(enriched);
    } catch (err: any) {
      console.error("[Chat] Media Load Error:", serializeSupabaseError(err));
      toast({ variant: "destructive", title: "Media Error", description: "Failed to load channel attachments." });
    } finally {
      setLoadingMedia(false);
    }
  }, [selectedChatId, supabase, toast]);

  const performInChatSearch = useCallback(async (query: string) => {
    if (!selectedChatId || query.length < 2) {
      setInChatSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, channel_id, workspace_id, sender_id, message, created_at')
        .eq('channel_id', selectedChatId)
        .eq('is_deleted', false)
        .ilike('message', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        const senderIds = Array.from(new Set(data.map(m => m.sender_id)));
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, avatar_preset')
          .in('id', senderIds);

        const enriched = data.map(m => ({
          ...m,
          profiles: profilesData?.find(p => p.id === m.sender_id) || null
        }));
        setInChatSearchResults(enriched);
      } else {
        setInChatSearchResults([]);
      }
    } catch (err: any) {
      console.error("[Chat] In-chat Search Error:", serializeSupabaseError(err));
      toast({ variant: "destructive", title: "Search Error", description: err.message });
    } finally {
      setIsSearching(false);
    }
  }, [selectedChatId, supabase, toast]);

  const performGlobalSearch = useCallback(async (query: string) => {
    if (query.length < 2 || chats.length === 0) {
      setGlobalSearchResults([]);
      return;
    }

    setIsGlobalSearching(true);
    try {
      const channelIds = chats.map(c => c.id);

      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, channel_id, workspace_id, sender_id, message, created_at')
        .in('channel_id', channelIds)
        .eq('is_deleted', false)
        .ilike('message', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data && data.length > 0) {
        const senderIds = Array.from(new Set(data.map(m => m.sender_id)));
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, avatar_preset')
          .in('id', senderIds);

        const enriched = data.map(m => {
          const channel = chats.find(c => c.id === m.channel_id);
          return {
            ...m,
            profiles: profilesData?.find(p => p.id === m.sender_id) || null,
            channel_display_name: channel?.display_name || 'Archived Channel'
          };
        });
        setGlobalSearchResults(enriched);
      } else {
        setGlobalSearchResults([]);
      }
    } catch (err: any) {
      console.error("[Chat] Global Search Error:", serializeSupabaseError(err));
      toast({ variant: "destructive", title: "Search Failed", description: err.message });
    } finally {
      setIsGlobalSearching(false);
    }
  }, [supabase, chats, toast]);

  const handleMute = async (duration: '1h' | '8h' | '24h' | 'forever') => {
    if (!selectedChatId) return;

    let mutedUntil: string | null = null;
    const now = new Date();

    if (duration === '1h') {
      mutedUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (duration === '8h') {
      mutedUntil = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString();
    } else if (duration === '24h') {
      mutedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }

    try {
      const { error } = await supabase.rpc("mute_chat_channel", {
        p_channel_id: selectedChatId,
        p_muted_until: mutedUntil,
      });

      if (error) throw error;

      setMuteStates(prev => ({
        ...prev,
        [selectedChatId]: { is_muted: true, muted_until: mutedUntil }
      }));
      toast({ title: "Chat muted", description: duration === 'forever' ? "Notifications silenced indefinitely." : `Notifications silenced until ${new Date(mutedUntil!).toLocaleString()}` });
    } catch (err: any) {
      console.error("[Chat] Mute Error:", serializeSupabaseError(err));
      toast({ variant: "destructive", title: "Unable to mute chat", description: err.message });
    }
  };

  const handleUnmute = async () => {
    if (!selectedChatId) return;

    try {
      const { error } = await supabase.rpc("unmute_chat_channel", {
        p_channel_id: selectedChatId
      });

      if (error) throw error;

      setMuteStates(prev => ({
        ...prev,
        [selectedChatId]: { is_muted: false, muted_until: null }
      }));
      toast({ title: "Chat unmuted", description: "Notifications restored." });
    } catch (err: any) {
      console.error("[Chat] Unmute Error:", serializeSupabaseError(err));
      toast({ variant: "destructive", title: "Unable to unmute chat", description: err.message });
    }
  };

  const handleToggleFloating = (chat: Chat) => {
    if (!floatingBubbles.some(b => b.id === chat.id)) {
      setFloatingBubbles(prev => [...prev, chat]);
    }
    setExpandedBubbleId(chat.id);
  };

  const handleRemoveFloating = (chatId: string) => {
    setFloatingBubbles(prev => prev.filter(b => b.id !== chatId));
    if (expandedBubbleId === chatId) setExpandedBubbleId(null);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inChatSearchQuery) {
        performInChatSearch(inChatSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [inChatSearchQuery, performInChatSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        performGlobalSearch(searchQuery);
      } else {
        setGlobalSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performGlobalSearch]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  useEffect(() => {
    if (selectedChatId) {
      fetchMessages(selectedChatId);
      markAsRead(selectedChatId);
      setSelectedFile(null); // Clear file on channel change
      setIsSearchOpen(false); // Close contextual search on channel change
      setInChatSearchQuery("");
      setInChatSearchResults([]);
    } else {
      setMessages([]);
    }
  }, [selectedChatId, fetchMessages, markAsRead]);

  useEffect(() => {
    if (!selectedChatId) return;

    const channel = supabase
      .channel(`chat_messages:${selectedChatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Handle unread logic for OTHER channels
          if (newMessage.channel_id !== selectedChatId && newMessage.sender_id !== userProfile?.id) {
            setUnreadCounts(prev => ({
              ...prev,
              [newMessage.channel_id]: (prev[newMessage.channel_id] || 0) + 1
            }));
            return;
          }

          // Handle message for CURRENT channel
          if (newMessage.channel_id === selectedChatId) {
            const wasAtBottom = isAtBottom();

            setMessages((prev) => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, { ...newMessage, profiles: null, attachments: [] }];
            });

            // Mark as read if user is actively engaged
            if (wasAtBottom || newMessage.sender_id === userProfile?.id) {
              markAsRead(selectedChatId);
            }

            // Wait a brief moment to allow attachment insertion to complete, then refetch to get everything
            setTimeout(() => fetchMessages(selectedChatId), 1000);

            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url, avatar_preset')
                .eq('id', newMessage.sender_id)
                .single();
              
              setMessages((prev) => 
                prev.map(m => m.id === newMessage.id ? { ...m, profiles: profileData || null } : m)
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              );

              if (wasAtBottom || newMessage.sender_id === userProfile?.id) {
                setTimeout(() => scrollToBottom(), 100);
              }
            } catch (err) {
              console.error("Profile sync error:", err);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const updatedMessage = payload.new as any;
          if (updatedMessage.channel_id === selectedChatId) {
            if (updatedMessage.is_deleted) {
              setMessages((prev) => prev.filter(m => m.id !== updatedMessage.id));
            } else {
              setMessages((prev) => prev.map(m => m.id === updatedMessage.id ? { ...m, ...updatedMessage } : m));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChatId, supabase, userProfile?.id, scrollToBottom, fetchMessages, markAsRead]);

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    setShowConversation(true);
  };

  const handleJumpToMessage = (channelId: string, msgId: string) => {
    if (selectedChatId === channelId) {
      const element = document.getElementById(`message-${msgId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(msgId);
        setTimeout(() => setHighlightedMessageId(null), 3000);
      } else {
        toast({ title: "Message found", description: "Scrolling to location..." });
      }
    } else {
      setPendingHighlightMessageId(msgId);
      handleSelectChat(channelId);
    }

    if (window.innerWidth < 768) {
      setShowConversation(true);
    }
  };

  const handleInChatResultClick = (msgId: string) => {
    const found = messages.find(m => m.id === msgId);
    if (found) {
      const element = document.getElementById(`message-${msgId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(msgId);
        setTimeout(() => setHighlightedMessageId(null), 3000);
      }
    } else {
      toast({ title: "Message found", description: "Fetching historical context..." });
    }
    
    if (window.innerWidth < 768) {
      setIsSearchOpen(false);
    }
  };

  const selectedChat = chats.find(c => c.id === selectedChatId);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: "Maximum size is 5MB."
      });
      return;
    }

    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    if (!selectedChat || !userProfile || (!text && !selectedFile) || isSending) return;

    setIsSending(true);
    let messageId: string | null = null;
    try {
      const { data: msgData, error: sendError } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: selectedChat.id,
          workspace_id: selectedChat.workspace_id,
          sender_id: userProfile.id,
          message: text || "" 
        })
        .select('id')
        .single();

      if (sendError) throw sendError;
      messageId = msgData.id;

      if (selectedFile) {
        const safeName = sanitizeFileName(selectedFile.name);
        const storagePath = `${selectedChat.workspace_id}/${selectedChat.id}/${messageId}/${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(storagePath, selectedFile, {
            upsert: false,
            contentType: selectedFile.type
          });

        if (uploadError) {
          await supabase.from('chat_messages').delete().eq('id', messageId);
          throw uploadError;
        }

        const { error: attachError } = await supabase
          .from('chat_message_attachments')
          .insert({
            workspace_id: selectedChat.workspace_id,
            channel_id: selectedChat.id,
            message_id: messageId,
            uploaded_by: userProfile.id,
            file_name: selectedFile.name,
            file_path: storagePath,
            file_type: selectedFile.type || null,
            file_size_bytes: selectedFile.size
          });

        if (attachError) {
          await supabase.storage.from('chat-attachments').remove([storagePath]);
          await supabase.from('chat_messages').delete().eq('id', messageId);
          throw attachError;
        }
      }
      
      setMessageInput("");
      setSelectedFile(null);
      await fetchMessages(selectedChat.id);
      fetchUnreadCounts();
    } catch (err: any) {
      console.error("[Chat] Send Error:", serializeSupabaseError(err));
      toast({ 
        variant: "destructive", 
        title: "Send Failed", 
        description: err.message || "Message could not be delivered." 
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleStartChat = async () => {
    if (!activeWorkspace || isStartingChat) return;

    if (chatMode === 'direct' && !selectedMemberId) return;
    if (chatMode === 'group' && (!groupName.trim() || selectedMemberIds.length < 2)) return;

    setIsStartingChat(true);
    try {
      let channelId: string | null = null;

      if (chatMode === 'direct') {
        const { data, error: rpcError } = await supabase.rpc("create_or_get_direct_chat", {
          p_workspace_id: activeWorkspace.id,
          p_other_user_id: selectedMemberId,
        });
        if (rpcError) throw rpcError;
        channelId = data;
      } else {
        const { data, error: rpcError } = await supabase.rpc("create_group_chat", {
          p_workspace_id: activeWorkspace.id,
          p_name: groupName.trim(),
          p_member_user_ids: selectedMemberIds,
        });
        if (rpcError) throw rpcError;
        channelId = data;
      }

      setIsNewChatOpen(false);
      setSelectedMemberId(null);
      setSelectedMemberIds([]);
      setGroupName("");
      setMemberSearchQuery("");
      
      await fetchChats();
      
      if (channelId) {
        handleSelectChat(channelId);
      }
      
      toast({ title: chatMode === 'group' ? "Group created!" : "Chat started!" });
    } catch (err: any) {
      console.error("[Chat] Start Error:", serializeSupabaseError(err));
      toast({ 
        variant: "destructive", 
        title: "Unable to start conversation", 
        description: err.message || "Something went wrong." 
      });
    } finally {
      setIsStartingChat(false);
    }
  };

  const toggleMemberSelection = (id: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredChats = chats.filter(c => 
    c.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMembers = workspaceMembers.filter(m => 
    m.full_name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    m.username?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const mediaItems = allMedia.filter(m => m.file_type?.startsWith('image/'));
  const fileItems = allMedia.filter(m => !m.file_type?.startsWith('image/'));

  // Calculate total unread, excluding muted channels
  const totalUnread = Object.keys(unreadCounts).reduce((acc, currId) => {
    const isMuted = muteStates[currId]?.is_muted && (!muteStates[currId].muted_until || new Date(muteStates[currId].muted_until!) > new Date());
    if (isMuted) return acc;
    return acc + (unreadCounts[currId] || 0);
  }, 0);

  const isCurrentChatMuted = selectedChatId ? 
    (muteStates[selectedChatId]?.is_muted && (!muteStates[selectedChatId]?.muted_until || new Date(muteStates[selectedChatId].muted_until!) > new Date())) 
    : false;

  return (
    <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] flex overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] shadow-2xl animate-in fade-in duration-500 relative">
      
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-[350px] border-r dark:border-slate-800 flex flex-col shrink-0 transition-all",
        showConversation ? "hidden md:flex" : "flex"
      )}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chat</h1>
              {totalUnread > 0 && (
                <Badge className="bg-primary text-white text-[10px] h-5 rounded-full border-2 border-white dark:border-slate-900">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </Badge>
              )}
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="rounded-xl text-primary hover:bg-primary/5"
              onClick={() => { setIsNewChatOpen(true); fetchMembers(); }}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search chats and messages" 
              className="pl-10 h-11 bg-slate-100 dark:bg-slate-800 border-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                className="absolute right-3 top-1/2 -translate-y-1/2"
                onClick={() => { setSearchQuery(""); setGlobalSearchResults([]); }}
              >
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 px-3">
          <div className="space-y-6 pb-6">
            {/* Global Search Message Results */}
            {searchQuery.length >= 2 && (
              <div className="space-y-1 px-1">
                <div className="flex items-center justify-between px-2 mb-2">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Message Results</p>
                   {isGlobalSearching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                </div>
                {globalSearchResults.length === 0 && !isGlobalSearching ? (
                  <p className="text-[10px] text-center text-slate-400 py-4 italic">No matching messages found</p>
                ) : (
                  globalSearchResults.map((res) => (
                    <button
                      key={`global-${res.id}`}
                      onClick={() => handleJumpToMessage(res.channel_id, res.id)}
                      className="w-full text-left p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group flex gap-3"
                    >
                      <Avatar className="w-8 h-8 shrink-0 border dark:border-slate-800">
                        <AvatarImage src={res.profiles?.avatar_preset ? `/avatars/${res.profiles.avatar_preset}.png` : res.profiles?.avatar_url} />
                        <AvatarFallback className="text-[10px] font-bold bg-primary/5 text-primary">{res.profiles?.full_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-baseline mb-0.5">
                           <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{res.channel_display_name}</p>
                           <span className="text-[9px] text-slate-400 shrink-0 ml-1">{new Date(res.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                         </div>
                         <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed">
                           <span className="font-bold text-slate-700 dark:text-slate-300 mr-1">{res.profiles?.full_name?.split(' ')[0]}:</span>
                           {res.message}
                         </p>
                      </div>
                    </button>
                  ))
                )}
                <Separator className="my-4 opacity-50" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Channels</p>
              </div>
            )}

            {/* Chat Channels List */}
            <div className="space-y-1">
              {loadingChats ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <p className="text-xs font-medium">Syncing channels...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-rose-500 gap-2">
                  <AlertCircle className="w-8 h-8 opacity-50" />
                  <p className="text-sm font-bold">Failed to load</p>
                  <Button variant="outline" size="sm" onClick={fetchChats} className="mt-4 h-8 text-[10px] uppercase font-bold tracking-wider">Retry</Button>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                  <p className="text-sm font-medium">No channels found</p>
                </div>
              ) : (
                filteredChats.map((chat) => {
                  const isActive = selectedChatId === chat.id;
                  const unreadCount = unreadCounts[chat.id] || 0;
                  const isMuted = muteStates[chat.id]?.is_muted && (!muteStates[chat.id].muted_until || new Date(muteStates[chat.id].muted_until!) > new Date());
                  const avatarSrc = chat.display_avatar_preset ? `/avatars/${chat.display_avatar_preset}.png` : chat.display_avatar;

                  return (
                    <button
                      key={chat.id}
                      onClick={() => handleSelectChat(chat.id)}
                      className={cn(
                        "w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all group hover:bg-slate-50 dark:hover:bg-slate-800/50 relative",
                        isActive ? "bg-primary/10 dark:bg-primary/10" : ""
                      )}
                    >
                      <Avatar className="w-12 h-12 border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                        {avatarSrc ? (
                          <AvatarImage src={avatarSrc} />
                        ) : (
                          <AvatarFallback className={cn(
                            "bg-primary/10 text-primary font-bold",
                            isActive ? "bg-primary text-white" : ""
                          )}>
                            {chat.name.toLowerCase() === 'general' ? <Hash className="w-5 h-5" /> : 
                             chat.type === 'group' ? <Users className="w-5 h-5" /> :
                             (chat.display_name?.[0] || 'C').toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={cn(
                              "font-bold text-sm truncate",
                              isActive ? "text-primary" : "text-slate-900 dark:text-white"
                            )}>{chat.display_name}</p>
                            {isMuted && <BellOff className="w-3 h-3 text-slate-400 shrink-0" />}
                          </div>
                          {chat.last_message_at && (
                            <span className="text-[10px] text-slate-400 font-medium ml-2 shrink-0">
                              {new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {chat.last_message || (
                              chat.name.toLowerCase() === 'general' ? 'Workspace Channel' : 
                              chat.type === 'direct' ? 'Direct Message' : 
                              chat.type === 'group' ? 'Group Chat' : 'Channel'
                            )}
                          </p>
                          {unreadCount > 0 && (
                            <Badge className={cn(
                              "h-5 min-w-[20px] px-1 text-white text-[10px] font-bold rounded-full animate-in zoom-in border-2 border-white dark:border-slate-900 shrink-0",
                              isMuted ? "bg-slate-400 opacity-70" : "bg-primary"
                            )}>
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Conversation Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-950/20 transition-all",
        !showConversation ? "hidden md:flex" : "flex"
      )}>
        {selectedChat ? (
          <>
            {/* Header */}
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center justify-between">
              {isSearchOpen ? (
                <div className="flex items-center gap-3 w-full animate-in slide-in-from-top-2 duration-300">
                   <Button variant="ghost" size="icon" className="shrink-0" onClick={() => { setIsSearchOpen(false); setInChatSearchQuery(""); setInChatSearchResults([]); }}>
                     <ChevronLeft className="w-5 h-5" />
                   </Button>
                   <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="Search in this chat..."
                        className="pl-10 h-10 bg-slate-100 dark:bg-slate-800 border-none rounded-xl"
                        value={inChatSearchQuery}
                        onChange={(e) => setInChatSearchQuery(e.target.value)}
                        autoFocus
                      />
                      {inChatSearchQuery && (
                        <button 
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          onClick={() => { setInChatSearchQuery(""); setInChatSearchResults([]); }}
                        >
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      )}
                   </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4 min-w-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="md:hidden rounded-xl h-10 w-10" 
                      onClick={() => setShowConversation(false)}
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <Avatar className="w-10 h-10 border-2 border-white dark:border-slate-800 shadow-sm">
                      {selectedChat.display_avatar_preset || selectedChat.display_avatar ? (
                        <AvatarImage src={selectedChat.display_avatar_preset ? `/avatars/${selectedChat.display_avatar_preset}.png` : selectedChat.display_avatar} />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {selectedChat.name.toLowerCase() === 'general' ? <Hash className="w-4 h-4" /> : 
                           selectedChat.type === 'group' ? <Users className="w-4 h-4" /> :
                           (selectedChat.display_name?.[0] || 'C').toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm md:text-base dark:text-white truncate">{selectedChat.display_name}</p>
                        {isCurrentChatMuted && <BellOff className="w-3 h-3 text-slate-400" />}
                      </div>
                      <p className="text-[10px] md:text-xs text-emerald-500 font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        {selectedChat.name.toLowerCase() === 'general' ? 'Workspace Channel' : 
                         selectedChat.type === 'direct' ? 'Direct Message' : 
                         selectedChat.type === 'group' ? 'Group Chat' : 'Channel'}
                        {isCurrentChatMuted && (
                          <span className="text-slate-400 ml-1 font-bold">• Muted</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-xl text-slate-400 hover:text-primary"
                            onClick={() => handleToggleFloating(selectedChat)}
                          >
                            <MessageCircle className="w-5 h-5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open as floating bubble</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button variant="ghost" size="icon" className="rounded-xl text-slate-400" onClick={() => { setIsMediaSheetOpen(true); fetchMedia(); }}>
                      <Files className="w-5 h-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl text-slate-400" onClick={() => setIsSearchOpen(true)}>
                      <Search className="w-5 h-5" />
                    </Button>
                    <DropdownMenu onOpenChange={(open) => !open && (typeof document !== 'undefined' && (document.body.style.pointerEvents = ""))}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-xl text-slate-400"><MoreVertical className="w-5 h-5" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56 dark:bg-slate-900 dark:border-slate-800">
                        <DropdownMenuLabel className="dark:text-slate-100">Notifications</DropdownMenuLabel>
                        {isCurrentChatMuted ? (
                          <DropdownMenuItem onClick={handleUnmute} className="gap-2 text-primary font-medium">
                            <Bell className="w-4 h-4" /> Unmute Chat
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => handleMute('1h')} className="gap-2">Mute for 1 hour</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMute('8h')} className="gap-2">Mute for 8 hours</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMute('24h')} className="gap-2">Mute for 24 hours</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleMute('forever')} className="gap-2 text-rose-500">Mute Forever</DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator className="dark:bg-slate-800" />
                        <DropdownMenuItem className="gap-2">Channel Settings</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              )}
            </div>

            {/* Contextual In-Chat Search Results Overlay */}
            {isSearchOpen && inChatSearchQuery.length >= 2 && (
              <div className="absolute top-20 left-4 right-4 md:left-[350px] z-[40] pointer-events-none">
                 <div className="max-w-xl mx-auto w-full pointer-events-auto bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden max-h-[60vh] flex flex-col animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 flex items-center justify-between">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Search Results</span>
                       {isSearching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                    </div>
                    <ScrollArea className="flex-1">
                       <div className="p-1 space-y-1">
                          {inChatSearchResults.length === 0 && !isSearching ? (
                            <div className="p-8 text-center opacity-50">
                              <p className="text-sm font-medium">No messages found</p>
                            </div>
                          ) : (
                            inChatSearchResults.map(res => (
                              <button 
                                key={res.id} 
                                className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex gap-3 group"
                                onClick={() => handleInChatResultClick(res.id)}
                              >
                                 <Avatar className="w-8 h-8 shrink-0">
                                   <AvatarImage src={res.profiles?.avatar_preset ? `/avatars/${res.profiles.avatar_preset}.png` : res.profiles?.avatar_url} />
                                   <AvatarFallback className="text-[10px] bg-primary/5 text-primary font-bold">{res.profiles?.full_name?.[0]}</AvatarFallback>
                                 </Avatar>
                                 <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                      <p className="text-xs font-bold truncate group-hover:text-primary transition-colors">{res.profiles?.full_name}</p>
                                      <span className="text-[9px] text-slate-400 shrink-0 ml-2">{new Date(res.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{res.message}</p>
                                 </div>
                              </button>
                            ))
                          )}
                       </div>
                    </ScrollArea>
                 </div>
              </div>
            )}

            {/* Messages Area */}
            <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 md:px-8">
              <div className="py-8 space-y-6">
                {loadingMessages ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm font-medium">History is loading...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                    <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
                    <p className="font-bold text-lg">No messages here yet</p>
                    <p className="text-sm">Be the first to say hello!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender_id === userProfile?.id;
                    const avatarSrc = msg.profiles?.avatar_preset ? `/avatars/${msg.profiles.avatar_preset}.png` : msg.profiles?.avatar_url;
                    const isHighlighted = highlightedMessageId === msg.id;
                    
                    return (
                      <div 
                        key={msg.id} 
                        id={`message-${msg.id}`}
                        className={cn(
                          "flex gap-3 max-w-[85%] md:max-w-[70%] transition-all duration-1000",
                          isMe ? "ml-auto flex-row-reverse" : "mr-auto",
                          isHighlighted && "scale-105"
                        )}
                      >
                        {!isMe && (
                          <Avatar className="w-8 h-8 shrink-0 shadow-sm mt-1">
                            <AvatarImage src={avatarSrc} />
                            <AvatarFallback className="text-[10px] bg-slate-100 font-bold">{msg.profiles?.full_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                          {!isMe && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1 ml-1">{msg.profiles?.full_name}</span>}
                          <div className={cn(
                            "px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed relative group border-2 border-transparent transition-all",
                            isMe 
                              ? "bg-primary text-white rounded-tr-none" 
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700",
                            isHighlighted && (isMe ? "border-white ring-4 ring-primary/20" : "border-primary ring-4 ring-primary/20 shadow-xl")
                          )}>
                            {msg.message}
                            
                            {/* Attachments Section */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className={cn("space-y-3", msg.message ? "mt-4" : "")}>
                                {msg.attachments.map(att => {
                                  const isImage = att.file_type?.startsWith('image/');
                                  
                                  return (
                                    <div key={att.id} className="max-w-xs">
                                      {isImage && att.signed_url ? (
                                        <div className="relative group/image overflow-hidden rounded-xl border border-black/5 dark:border-white/5 bg-slate-100 dark:bg-slate-900">
                                          <img 
                                            src={att.signed_url} 
                                            alt={att.file_name}
                                            className="w-full h-auto max-h-[300px] object-cover hover:scale-105 transition-transform duration-500 cursor-pointer"
                                            onClick={() => window.open(att.signed_url, '_blank')}
                                          />
                                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                             <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full" onClick={() => window.open(att.signed_url, '_blank')}>
                                               <ExternalLink className="w-5 h-5" />
                                             </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className={cn(
                                          "flex items-center gap-4 p-3 rounded-xl border transition-colors",
                                          isMe 
                                            ? "bg-white/10 border-white/20 hover:bg-white/20" 
                                            : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800"
                                        )}>
                                          <div className={cn(
                                            "p-2.5 rounded-lg shrink-0",
                                            isMe ? "bg-white/10" : "bg-primary/5"
                                          )}>
                                            {isImage ? <ImageIcon className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold truncate leading-tight">{att.file_name}</p>
                                            <p className="text-[10px] opacity-60 mt-0.5 font-bold uppercase tracking-widest">{formatBytes(att.file_size_bytes)}</p>
                                          </div>
                                          {att.signed_url && (
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-8 w-8 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                                              onClick={() => window.open(att.signed_url, '_blank')}
                                            >
                                              <Download className="w-4 h-4" />
                                            </Button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className={cn(
                              "flex items-center gap-1.5 mt-1.5 justify-end opacity-70 text-[9px] font-bold",
                              isMe ? "text-white/80" : "text-slate-400"
                            )}>
                              <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isMe && <CheckCheck className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
              {/* Attachment Preview Bar */}
              {selectedFile && (
                <div className="mb-4 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Paperclip className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate dark:text-slate-100">{selectedFile.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{formatBytes(selectedFile.size)}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  onChange={handleFileSelect}
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-slate-400 hover:text-primary rounded-xl shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending || !selectedChatId}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <Input 
                  className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base flex-1 dark:text-white" 
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  disabled={loadingMessages || isSending}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary rounded-xl shrink-0 hidden sm:flex">
                  <Smile className="w-5 h-5" />
                </Button>
                <Button 
                  size="icon" 
                  onClick={handleSendMessage}
                  className={cn(
                    "rounded-xl shadow-lg transition-all active:scale-95 shrink-0",
                    (messageInput.trim() || selectedFile) && !loadingMessages && !isSending ? "bg-primary" : "bg-slate-300 dark:bg-slate-700 cursor-not-allowed"
                  )}
                  disabled={(!messageInput.trim() && !selectedFile) || loadingMessages || isSending}
                >
                  {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mb-2">
              <MessageSquare className="w-10 h-10 text-primary/40" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Workspace Messenger</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1">
                Select a conversation to start collaborating with your team members.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bubbles Stack */}
      <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-50 pointer-events-none">
        {floatingBubbles.map((chat) => {
          const isExpanded = expandedBubbleId === chat.id;
          const unreadCount = unreadCounts[chat.id] || 0;
          const isMuted = muteStates[chat.id]?.is_muted && (!muteStates[chat.id].muted_until || new Date(muteStates[chat.id].muted_until!) > new Date());
          const bubbleColor = getChannelBubbleColor(chat.id);
          const avatarSrc = chat.display_avatar_preset ? `/avatars/${chat.display_avatar_preset}.png` : chat.display_avatar;

          return (
            <div key={`floating-${chat.id}`} className="flex flex-col items-end gap-3 pointer-events-auto">
              {isExpanded && (
                <FloatingChatWindow 
                  chat={chat} 
                  onMinimize={() => setExpandedBubbleId(null)}
                  onClose={() => handleRemoveFloating(chat.id)}
                  muteState={muteStates[chat.id]}
                />
              )}
              {!isExpanded && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setExpandedBubbleId(chat.id)}
                        className={cn(
                          "w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group relative ring-2 ring-offset-2 dark:ring-offset-slate-900",
                          bubbleColor.split(' ')[0]
                        )}
                      >
                        <Avatar className="w-full h-full border-none">
                          <AvatarImage src={avatarSrc} />
                          <AvatarFallback className={cn("text-white font-bold", bubbleColor.split(' ')[1])}>
                            {chat.name.toLowerCase() === 'general' ? <Hash className="w-6 h-6" /> : 
                             chat.type === 'group' ? <Users className="w-6 h-6" /> :
                             (chat.display_name?.[0] || 'C').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        {unreadCount > 0 && (
                          <Badge className={cn(
                            "absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px] font-bold border-2 border-white dark:border-slate-900 rounded-full",
                            isMuted ? "bg-slate-400" : "bg-primary"
                          )}>
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </Badge>
                        )}
                        
                        {isMuted && (
                          <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-1 shadow-sm">
                            <BellOff className="w-3 h-3 text-slate-400" />
                          </div>
                        )}

                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-full pr-4 pointer-events-none">
                          <Badge variant="secondary" className="whitespace-nowrap bg-white dark:bg-slate-800 shadow-xl border dark:border-slate-700 py-1 px-3 text-xs font-bold">
                            {chat.display_name}
                          </Badge>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">{chat.display_name}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        })}
      </div>

      {/* New Chat Modal */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 dark:border-slate-800 rounded-[2rem]">
          <div className="p-6 pb-0">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] h-4">Messenger</Badge>
              </div>
              <DialogTitle className="text-2xl font-bold dark:text-slate-100">New Chat</DialogTitle>
              <DialogDescription className="dark:text-slate-400">Start a conversation with your team.</DialogDescription>
            </DialogHeader>

            <Tabs value={chatMode} onValueChange={(v: any) => setChatMode(v)} className="mt-6">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900">
                <TabsTrigger value="direct">Direct Message</TabsTrigger>
                <TabsTrigger value="group">Group Chat</TabsTrigger>
              </TabsList>

              <div className="mt-6 space-y-4">
                {chatMode === 'group' && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Group Details</p>
                    <Input 
                      placeholder="Enter group name..." 
                      className="h-11 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus-visible:ring-2 focus-visible:ring-primary/20"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>
                )}
                
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                    {chatMode === 'group' ? `Select Members (${selectedMemberIds.length})` : 'Select Member'}
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      placeholder="Search members" 
                      className="pl-10 h-11 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus-visible:ring-2 focus-visible:ring-primary/20"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </Tabs>
          </div>

          <div className="p-6">
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {loadingMembers ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p className="text-xs font-medium">Loading workspace roster...</p>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-10 opacity-50">
                    <UserPlus className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">No members found</p>
                  </div>
                ) : (
                  filteredMembers.map((member) => {
                    const isSelected = chatMode === 'group' 
                      ? selectedMemberIds.includes(member.id) 
                      : selectedMemberId === member.id;

                    return (
                      <button
                        key={member.id}
                        onClick={() => chatMode === 'group' ? toggleMemberSelection(member.id) : setSelectedMemberId(member.id)}
                        className={cn(
                          "w-full flex items-center gap-4 p-3 rounded-2xl transition-all group text-left relative",
                          isSelected 
                            ? "bg-primary/10 ring-1 ring-primary/20 shadow-sm" 
                            : "hover:bg-slate-50 dark:hover:bg-slate-900"
                        )}
                      >
                        <Avatar className="w-10 h-10 border dark:border-slate-800 shrink-0">
                          <AvatarImage src={member.avatar_preset ? `/avatars/${member.avatar_preset}.png` : member.avatar_url} />
                          <AvatarFallback className="bg-primary/5 text-primary font-bold">{member.full_name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-sm truncate dark:text-slate-100">{member.full_name}</p>
                            <Badge variant="outline" className="text-[8px] py-0 h-3.5 uppercase dark:border-slate-800 dark:text-slate-500">{member.role}</Badge>
                          </div>
                          <p className="text-[10px] text-slate-500 truncate italic">@{member.username || member.email.split('@')[0]}</p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="p-6 pt-0 bg-slate-50 dark:bg-slate-900/40 border-t dark:border-slate-800">
            <div className="flex w-full gap-3">
              <Button 
                variant="ghost" 
                className="flex-1 rounded-xl h-11 dark:text-slate-300"
                onClick={() => setIsNewChatOpen(false)}
                disabled={isStartingChat}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1 rounded-xl h-11 shadow-lg shadow-primary/20"
                disabled={
                  isStartingChat || 
                  (chatMode === 'direct' && !selectedMemberId) || 
                  (chatMode === 'group' && (!groupName.trim() || selectedMemberIds.length < 2))
                }
                onClick={handleStartChat}
              >
                {isStartingChat ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {isStartingChat ? 'Creating...' : chatMode === 'group' ? 'Create Group' : 'Start Chat'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media & Files Gallery Sheet */}
      <Sheet open={isMediaSheetOpen} onOpenChange={setIsMediaSheetOpen}>
        <SheetContent className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col dark:bg-slate-950 dark:border-slate-800 overflow-hidden">
          <div className="p-6 pb-0">
            <SheetHeader>
              <div className="flex items-center gap-2 mb-1">
                 <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] h-4">Storage</Badge>
              </div>
              <SheetTitle className="text-2xl font-bold dark:text-slate-100">Media & Files</SheetTitle>
              <SheetDescription className="dark:text-slate-400">
                Shared assets in {selectedChat?.display_name}.
              </SheetDescription>
            </SheetHeader>

            <Tabs defaultValue="media" className="mt-8 flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900/50 mb-6">
                <TabsTrigger value="media" className="gap-2">
                   <ImageIcon className="w-3.5 h-3.5" /> Media
                </TabsTrigger>
                <TabsTrigger value="files" className="gap-2">
                   <FileIcon className="w-3.5 h-3.5" /> Files
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <TabsContent value="media" className="m-0 pb-8">
                  {loadingMedia ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-sm font-medium">Scanning gallery...</p>
                    </div>
                  ) : mediaItems.length === 0 ? (
                    <div className="text-center py-20 opacity-50 space-y-3">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto">
                         <ImageIcon className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-medium">No media shared yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {mediaItems.map((item) => (
                        <div key={item.id} className="group relative aspect-square rounded-2xl overflow-hidden border dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                          {item.signed_url ? (
                            <img 
                              src={item.signed_url} 
                              alt={item.file_name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-rose-500">
                              <AlertCircle className="w-6 h-6 opacity-30" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4 text-center">
                             <p className="text-white text-[10px] font-bold line-clamp-2 leading-tight">{item.file_name}</p>
                             <div className="flex gap-2 mt-1">
                                <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => window.open(item.signed_url, '_blank')}>
                                   <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => window.open(item.signed_url, '_blank')}>
                                   <Download className="w-3.5 h-3.5" />
                                </Button>
                             </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="files" className="m-0 pb-8">
                  {loadingMedia ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-sm font-medium">Listing documents...</p>
                    </div>
                  ) : fileItems.length === 0 ? (
                    <div className="text-center py-20 opacity-50 space-y-3">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto">
                         <FileIcon className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-medium">No files shared yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fileItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-3 rounded-2xl border dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group">
                           <div className="p-2.5 bg-primary/10 rounded-xl">
                              <FileIcon className="w-5 h-5 text-primary" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate dark:text-slate-100">{item.file_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                 <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{formatBytes(item.file_size_bytes)}</span>
                                 <Separator orientation="vertical" className="h-2 dark:bg-slate-800" />
                                 <span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span>
                              </div>
                           </div>
                           <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full group-hover:text-primary" onClick={() => window.open(item.signed_url, '_blank')}>
                              <Download className="w-4 h-4" />
                           </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FloatingChatWindow({ 
  chat, 
  onMinimize, 
  onClose,
  muteState
}: { 
  chat: Chat; 
  onMinimize: () => void; 
  onClose: () => void;
  muteState?: { is_muted: boolean; muted_until: string | null };
}) {
  const { userProfile } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const supabase = createClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, channel_id, workspace_id, sender_id, message, created_at, is_deleted')
        .eq('channel_id', chat.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      const senderIds = Array.from(new Set(data?.map(m => m.sender_id) || []));
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, avatar_preset')
        .in('id', senderIds);

      const enriched = (data || []).map(m => ({
        ...m,
        profiles: profilesData?.find(p => p.id === m.sender_id) || null
      }));

      setMessages(enriched);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
    } catch (err) {
      console.error("[Floating Chat] Load Error:", err);
    } finally {
      setLoading(false);
    }
  }, [chat.id, supabase]);

  const markRead = useCallback(async () => {
    try {
      await supabase.rpc("mark_chat_channel_read", { p_channel_id: chat.id });
    } catch (err) {
      console.error("[Floating Chat] Read Error:", err);
    }
  }, [chat.id, supabase]);

  useEffect(() => {
    fetchMessages();
    markRead();
  }, [fetchMessages, markRead]);

  useEffect(() => {
    const channel = supabase
      .channel(`floating_chat:${chat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${chat.id}` }, async (payload) => {
        const newMessage = payload.new as any;
        
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, { ...newMessage, profiles: null }];
        });

        markRead();

        try {
          const { data: profile } = await supabase.from('profiles').select('id, full_name, avatar_url, avatar_preset').eq('id', newMessage.sender_id).single();
          setMessages(prev => prev.map(m => m.id === newMessage.id ? { ...m, profiles: profile } : m));
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (err) { console.error(err); }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chat.id, supabase, markRead]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending || !userProfile) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        channel_id: chat.id,
        workspace_id: chat.workspace_id,
        sender_id: userProfile.id,
        message: text
      });
      if (error) throw error;
      setInput("");
      fetchMessages();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  const isMuted = muteState?.is_muted && (!muteState.muted_until || new Date(muteState.muted_until) > new Date());

  return (
    <div className="w-[calc(100vw-2rem)] sm:w-[350px] h-[450px] sm:h-[500px] bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 pointer-events-auto">
      {/* Header */}
      <div className="p-4 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="w-8 h-8">
            <AvatarImage src={chat.display_avatar_preset ? `/avatars/${chat.display_avatar_preset}.png` : chat.display_avatar} />
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
              {chat.name[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate dark:text-white flex items-center gap-1.5">
              {chat.display_name}
              {isMuted && <BellOff className="w-3 h-3 text-slate-400" />}
            </p>
            <p className="text-[10px] text-emerald-500 font-medium">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onMinimize}>
            <Minus className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-rose-500" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4 bg-slate-50/30 dark:bg-slate-950/10">
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : messages.length === 0 ? (
            <p className="text-[10px] text-center text-slate-400 py-10">No messages yet</p>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === userProfile?.id;
              return (
                <div key={msg.id} className={cn("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "items-start")}>
                  {!isMe && <span className="text-[9px] font-bold text-slate-400 mb-1 ml-1">{msg.profiles?.full_name}</span>}
                  <div className={cn(
                    "px-3 py-2 rounded-xl text-xs shadow-sm",
                    isMe ? "bg-primary text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700"
                  )}>
                    {msg.message}
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-1.5 rounded-xl border dark:border-slate-800">
          <Input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Aa"
            className="border-none shadow-none focus-visible:ring-0 h-8 text-xs bg-transparent dark:text-white"
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || isSending} className="h-7 w-7 rounded-lg shrink-0">
            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
