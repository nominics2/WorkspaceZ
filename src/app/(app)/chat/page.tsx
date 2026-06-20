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
  Info,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  LogOut,
  Edit2,
  UserMinus,
  Shield,
  Trash2,
  Copy,
  CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/providers/WorkspaceProvider";
import { useFloatingChat, Chat } from "@/components/chat/FloatingChatProvider";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

/**
 * PRODUCTION TYPES
 */
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

interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  updated_at?: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
    avatar_preset: string;
  } | null;
  attachments?: Attachment[];
  channel_display_name?: string;
  is_deleted?: boolean;
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

interface ChatChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  role: 'admin' | 'member';
  created_at: string;
}

interface ChatMemberWithProfile extends ChatChannelMember {
  profiles: {
    full_name: string;
    avatar_url: string;
    avatar_preset: string;
    email: string;
    username: string;
  } | null;
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

export default function ChatPage() {
  const { activeWorkspace, userProfile, userRole } = useWorkspace();
  const { addBubble, refreshUnread, removeBubble } = useFloatingChat();
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

  // Message Editing State
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageInput, setEditMessageInput] = useState("");
  const [isEditingLoading, setIsEditingLoading] = useState(false);

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

  // Info & Group Management State
  const [isInfoSheetOpen, setIsInfoSheetOpen] = useState(false);
  const [infoMembers, setInfoMembers] = useState<ChatMemberWithProfile[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState("");
  const [isRenamingLoading, setIsRenamingLoading] = useState(false);
  const [isLeavingLoading, setIsLeavingLoading] = useState(false);
  const [isArchivingLoading, setIsArchivingLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteGroupOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ChatMemberWithProfile | null>(null);
  const [isRemovingLoading, setIsRemovingLoading] = useState(false);

  // Role Management State
  const [memberToUpdateRole, setMemberToUpdateRole] = useState<ChatMemberWithProfile | null>(null);
  const [newRoleTarget, setNewRoleTarget] = useState<'admin' | 'member' | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(false);

  // Add Members State
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [selectedMemberIdsToAdd, setSelectedMemberIdsToAdd] = useState<string[]>([]);
  const [isAddingMembersLoading, setIsAddingMembersLoading] = useState(false);
  const [addMembersSearchQuery, setAddMembersSearchQuery] = useState("");

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

  /**
   * UTILITIES
   */
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
    return scrollHeight - scrollTop <= clientHeight + 150;
  };

  const handleCopyMessage = (text: string) => {
    if (!text || text.trim().length === 0) return;
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Message copied" });
    }).catch((err) => {
      console.error("[Chat] Clipboard Error:", err);
      toast({ variant: "destructive", title: "Unable to copy message" });
    });
  };

  /**
   * DATA FETCHING
   */
  const fetchUnreadCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_chat_unread_counts");
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data as ChatUnreadCount[]).forEach(item => {
        counts[item.channel_id] = item.unread_count;
      });
      setUnreadCounts(counts);
      refreshUnread();
    } catch (err) {
      console.error("[Chat] Sync unreads failed:", serializeSupabaseError(err));
    }
  }, [supabase, refreshUnread]);

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
      refreshUnread();
    } catch (err) {
      console.error("[Chat] Sync mutes failed:", serializeSupabaseError(err));
    }
  }, [supabase, refreshUnread]);

  const markAsRead = useCallback(async (channelId: string) => {
    try {
      const { error } = await supabase.rpc("mark_chat_channel_read", { p_channel_id: channelId });
      if (error) throw error;
      
      setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
      refreshUnread();
    } catch (err) {
      console.error("[Chat] Mark read failed:", serializeSupabaseError(err));
    }
  }, [supabase, refreshUnread]);

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
        .select('id, workspace_id, sub_workspace_id, name, type, created_at, archived_at, archived_by')
        .in('workspace_id', workspaceIds)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (channelsError) throw channelsError;

      const channelIds = (channelsData || []).map(c => c.id);

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

      const formattedChats: Chat[] = (channelsData || []).map(channel => {
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
          display_avatar_preset: displayAvatarPreset,
          archived_at: channel.archived_at,
          archived_by: channel.archived_by
        };
      }).sort((a, b) => {
        const isAGeneral = a.name.toLowerCase() === 'general' && (activeWorkspace ? a.workspace_id === activeWorkspace.id : true);
        const isBGeneral = b.name.toLowerCase() === 'general' && (activeWorkspace ? b.workspace_id === activeWorkspace.id : true);
        if (isAGeneral) return -1;
        if (isBGeneral) return 1;
        
        const timeA = new Date(a.last_message_at || a.created_at || 0).getTime();
        const timeB = new Date(b.last_message_at || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setChats(formattedChats);
      
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
          .select('id, channel_id, workspace_id, sender_id, message, created_at, updated_at, is_deleted')
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
      
      setTimeout(() => {
        scrollToBottom("auto");
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
      console.error("[Chat] Sync Error:", serializeSupabaseError(err));
      toast({ variant: "destructive", title: "History Sync Failed", description: err.message });
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

          const enriched = (profileData || []).map(p => ({
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

      const { data: signedData } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrls(attachData.map(a => a.file_path), 3600);
      
      const enriched = attachData.map(a => {
        const signedInfo = signedData?.find(s => s.path === a.file_path);
        return { ...a, signed_url: signedInfo?.signedUrl };
      });

      setAllMedia(enriched);
    } catch (err: any) {
      console.error("[Chat] Gallery Error:", serializeSupabaseError(err));
      toast({ variant: "destructive", title: "Gallery Error", description: "Failed to load shared files." });
    } finally {
      setLoadingMedia(false);
    }
  }, [selectedChatId, supabase, toast]);

  const fetchInfoMembers = useCallback(async () => {
    const chat = chats.find(c => c.id === selectedChatId);
    if (!chat || chat.name.toLowerCase() === 'general') return;

    setLoadingInfo(true);
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('chat_channel_members')
        .select('*')
        .eq('channel_id', chat.id)
        .order('created_at', { ascending: true });

      if (memberError) throw memberError;
      if (!memberData || memberData.length === 0) {
        setInfoMembers([]);
        return;
      }

      const userIds = memberData.map(m => m.user_id);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, avatar_preset, email')
        .in('id', userIds);

      if (profileError) throw profileError;

      const enriched: ChatMemberWithProfile[] = memberData.map(m => ({
        ...m,
        profiles: profileData?.find(p => p.id === m.user_id) || null
      }));

      setInfoMembers(enriched);
    } catch (err: any) {
      console.error("[Chat] Info Load Failed:", serializeSupabaseError(err));
      toast({ variant: "destructive", title: "Roster Sync Failed", description: err.message });
    } finally {
      setLoadingInfo(false);
    }
  }, [selectedChatId, chats, supabase, toast]);

  /**
   * SEARCH LOGIC
   */
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
      console.error("[Chat] Context Search Error:", serializeSupabaseError(err));
    } finally {
      setIsSearching(false);
    }
  }, [selectedChatId, supabase]);

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
            channel_display_name: channel?.display_name || 'Archive'
          };
        });
        setGlobalSearchResults(enriched);
      } else {
        setGlobalSearchResults([]);
      }
    } catch (err: any) {
      console.error("[Chat] Universal Search Error:", serializeSupabaseError(err));
    } finally {
      setIsGlobalSearching(false);
    }
  }, [supabase, chats]);

  /**
   * MUTING ACTIONS
   */
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
      refreshUnread();
      toast({ title: "Notifications silenced" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Mute failed", description: err.message });
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
      refreshUnread();
      toast({ title: "Notifications restored" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Unmute failed", description: err.message });
    }
  };

  /**
   * GROUP MANAGEMENT ACTIONS
   */
  const handleRenameGroup = async () => {
    const text = newGroupNameInput.trim();
    if (!selectedChatId || !text || isRenamingLoading) return;
    if (text.length > 80) {
      toast({ variant: "destructive", title: "Name too long", description: "Maximum 80 characters allowed." });
      return;
    }

    setIsRenamingLoading(true);
    try {
      const { error } = await supabase.rpc("rename_group_chat", {
        p_channel_id: selectedChatId,
        p_name: text
      });

      if (error) throw error;

      toast({ title: "Group renamed" });
      setIsRenamingGroup(false);
      await fetchChats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Rename failed", description: err.message });
    } finally {
      setIsRenamingLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedChatId || isLeavingLoading) return;

    setIsLeavingLoading(true);
    try {
      const { error } = await supabase.rpc("leave_group_chat", {
        p_channel_id: selectedChatId
      });

      if (error) throw error;

      toast({ title: "You left the group" });
      setIsInfoSheetOpen(false);
      removeBubble(selectedChatId);
      setSelectedChatId(null);
      setShowConversation(false);
      await fetchChats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Exit failed", description: err.message });
    } finally {
      setIsLeavingLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedChatId || isArchivingLoading) return;

    setIsArchivingLoading(true);
    try {
      const { error } = await supabase.rpc("archive_group_chat", {
        p_channel_id: selectedChatId
      });

      if (error) throw error;

      toast({ title: "Group deleted" });
      setIsInfoSheetOpen(false);
      setIsDeleteGroupOpen(false);
      removeBubble(selectedChatId);
      setSelectedChatId(null);
      setShowConversation(false);
      await fetchChats();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Deletion failed", description: err.message });
    } finally {
      setIsArchivingLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedChatId || !memberToRemove || isRemovingLoading) return;

    setIsRemovingLoading(true);
    try {
      const { error } = await supabase.rpc("remove_group_chat_member", {
        p_channel_id: selectedChatId,
        p_member_user_id: memberToRemove.user_id,
      });

      if (error) throw error;

      toast({ title: "Member removed", description: `${memberToRemove.profiles?.full_name} has been disconnected from the group.` });
      setMemberToRemove(null);
      await fetchInfoMembers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Removal failed", description: err.message });
    } finally {
      setIsRemovingLoading(false);
    }
  };

  const handleUpdateMemberRole = async () => {
    if (!selectedChatId || !memberToUpdateRole || !newRoleTarget || isRoleLoading) return;

    setIsRoleLoading(true);
    try {
      const { error } = await supabase.rpc("set_group_chat_member_role", {
        p_channel_id: selectedChatId,
        p_member_user_id: memberToUpdateRole.user_id,
        p_role: newRoleTarget,
      });

      if (error) throw error;

      toast({ 
        title: newRoleTarget === 'admin' ? "Member Promoted" : "Member Demoted", 
        description: `${memberToUpdateRole.profiles?.full_name} is now a group ${newRoleTarget}.` 
      });
      setMemberToUpdateRole(null);
      setNewRoleTarget(null);
      await fetchInfoMembers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    } finally {
      setIsRoleLoading(false);
    }
  };

  const handleAddMembersToGroup = async () => {
    if (!selectedChatId || selectedMemberIdsToAdd.length === 0 || isAddingMembersLoading) return;

    setIsAddingMembersLoading(true);
    try {
      const { data, error } = await supabase.rpc("add_group_chat_members", {
        p_channel_id: selectedChatId,
        p_member_user_ids: selectedMemberIdsToAdd
      });

      if (error) throw error;

      const insertedCount = (data as number) || 0;
      if (insertedCount > 0) {
        toast({ title: "Group Roster Updated", description: `${insertedCount} new member${insertedCount === 1 ? '' : 's'} added successfully.` });
      } else {
        toast({ title: "Roster Unchanged", description: "Selected members were already in the group." });
      }

      setIsAddMembersOpen(false);
      setSelectedMemberIdsToAdd([]);
      setAddMembersSearchQuery("");
      await fetchInfoMembers();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Enrollment Failed", description: err.message });
    } finally {
      setIsAddingMembersLoading(false);
    }
  };

  /**
   * MESSAGE ACTIONS
   */
  const handleUpdateMessage = async () => {
    const text = editMessageInput.trim();
    if (!editingMessageId || !text || isEditingLoading) return;
    
    const original = messages.find(m => m.id === editingMessageId);
    if (original?.message === text) {
      setEditingMessageId(null);
      return;
    }

    setIsEditingLoading(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({
          message: text,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingMessageId)
        .eq('sender_id', userProfile?.id);

      if (error) throw error;

      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, message: text, updated_at: new Date().toISOString() } : m));
      setEditingMessageId(null);
      setEditMessageInput("");
      toast({ title: "Message updated" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Edit failed", description: err.message });
    } finally {
      setIsEditingLoading(false);
    }
  };

  /**
   * EFFECTS
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inChatSearchQuery) performInChatSearch(inChatSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [inChatSearchQuery, performInChatSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) performGlobalSearch(searchQuery);
      else setGlobalSearchResults([]);
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
      setSelectedFile(null);
      setIsSearchOpen(false);
      setInChatSearchQuery("");
      setInChatSearchResults([]);
      setIsRenamingGroup(false);
      setEditingMessageId(null);
    } else {
      setMessages([]);
    }
  }, [selectedChatId, fetchMessages, markAsRead]);

  /**
   * REALTIME SYNC
   */
  useEffect(() => {
    if (!selectedChatId) return;

    const channel = supabase
      .channel(`chat_messages:${selectedChatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const newMessage = payload.new as any;
          if (newMessage.channel_id !== selectedChatId && newMessage.sender_id !== userProfile?.id) {
            setUnreadCounts(prev => ({ ...prev, [newMessage.channel_id]: (prev[newMessage.channel_id] || 0) + 1 }));
            return;
          }

          if (newMessage.channel_id === selectedChatId) {
            const wasAtBottom = isAtBottom();
            setMessages((prev) => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, { ...newMessage, profiles: null, attachments: [] }];
            });

            if (wasAtBottom || newMessage.sender_id === userProfile?.id) {
              markAsRead(selectedChatId);
            }

            // Sync attachments after short delay
            setTimeout(() => fetchMessages(selectedChatId), 1000);

            try {
              const { data: profileData } = await supabase.from('profiles').select('id, full_name, avatar_url, avatar_preset').eq('id', newMessage.sender_id).single();
              setMessages((prev) => 
                prev.map(m => m.id === newMessage.id ? { ...m, profiles: profileData || null } : m)
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              );
              if (wasAtBottom || newMessage.sender_id === userProfile?.id) {
                setTimeout(() => scrollToBottom(), 100);
              }
            } catch (err) { console.error(err); }
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
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

    return () => { supabase.removeChannel(channel); };
  }, [selectedChatId, supabase, userProfile?.id, scrollToBottom, fetchMessages, markAsRead]);

  /**
   * HANDLERS
   */
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
      }
    } else {
      setPendingHighlightMessageId(msgId);
      handleSelectChat(channelId);
    }
    if (window.innerWidth < 768) setShowConversation(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum size is 5MB." });
      return;
    }
    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    const chatObj = chats.find(c => c.id === selectedChatId);
    if (!chatObj || !userProfile || (!text && !selectedFile) || isSending) return;

    setIsSending(true);
    let messageId: string | null = null;
    try {
      const { data: msgData, error: sendError } = await supabase
        .from('chat_messages')
        .insert({
          channel_id: chatObj.id,
          workspace_id: chatObj.workspace_id,
          sender_id: userProfile.id,
          message: text || "" 
        })
        .select('id')
        .single();

      if (sendError) throw sendError;
      messageId = msgData.id;

      if (selectedFile) {
        const safeName = sanitizeFileName(selectedFile.name);
        const storagePath = `${chatObj.workspace_id}/${chatObj.id}/${messageId}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(storagePath, selectedFile, { upsert: false, contentType: selectedFile.type });

        if (uploadError) {
          await supabase.from('chat_messages').delete().eq('id', messageId);
          throw uploadError;
        }

        const { error: attachError } = await supabase
          .from('chat_message_attachments')
          .insert({
            workspace_id: chatObj.workspace_id,
            channel_id: chatObj.id,
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
      await fetchMessages(chatObj.id);
      fetchUnreadCounts();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Transmission Failed", description: err.message });
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
        const { data, error } = await supabase.rpc("create_or_get_direct_chat", {
          p_workspace_id: activeWorkspace.id,
          p_other_user_id: selectedMemberId,
        });
        if (error) throw error;
        channelId = data;
      } else {
        const { data, error } = await supabase.rpc("create_group_chat", {
          p_workspace_id: activeWorkspace.id,
          p_name: groupName.trim(),
          p_member_user_ids: selectedMemberIds,
        });
        if (error) throw error;
        channelId = data;
      }

      setIsNewChatOpen(false);
      setSelectedMemberId(null);
      setSelectedMemberIds([]);
      setGroupName("");
      setMemberSearchQuery("");
      await fetchChats();
      if (channelId) handleSelectChat(channelId);
      toast({ title: chatMode === 'group' ? "Focus group created" : "Direct chat initialized" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Handshake Failed", description: err.message });
    } finally {
      setIsStartingChat(false);
    }
  };

  /**
   * RENDER HELPERS
   */
  const filteredChats = chats.filter(c => 
    c.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMembers = workspaceMembers.filter(m => 
    m.full_name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    m.username?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    m.email?.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const addableMembers = workspaceMembers.filter(m => {
    const isAlreadyMember = infoMembers.some(im => im.user_id === m.id);
    const matchesSearch = 
      m.full_name?.toLowerCase().includes(addMembersSearchQuery.toLowerCase()) ||
      m.username?.toLowerCase().includes(addMembersSearchQuery.toLowerCase()) ||
      m.email?.toLowerCase().includes(addMembersSearchQuery.toLowerCase());
    return !isAlreadyMember && matchesSearch;
  });

  const totalUnread = Object.keys(unreadCounts).reduce((acc, currId) => {
    const isMuted = muteStates[currId]?.is_muted && (!muteStates[currId].muted_until || new Date(muteStates[currId].muted_until!) > new Date());
    if (isMuted) return acc;
    return acc + (unreadCounts[currId] || 0);
  }, 0);

  const isCurrentChatMuted = selectedChatId ? 
    (muteStates[selectedChatId]?.is_muted && (!muteStates[selectedChatId]?.muted_until || new Date(muteStates[selectedChatId].muted_until!) > new Date())) 
    : false;

  const selectedChat = chats.find(c => c.id === selectedChatId);

  // Group Admin Check for Management UI
  const currentUserInGroup = infoMembers.find(m => m.user_id === userProfile?.id);
  const canUserManageRoster = currentUserInGroup?.role === 'admin' || userRole === 'superadmin' || userRole === 'admin' || userRole === 'manager';

  return (
    <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] flex overflow-hidden bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-[2rem] shadow-2xl animate-in fade-in duration-500 relative">
      <div className={cn("w-full md:w-[350px] border-r dark:border-slate-800 flex flex-col shrink-0 transition-all", showConversation ? "hidden md:flex" : "flex")}>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chat</h1>
              {totalUnread > 0 && <Badge className="bg-primary text-white text-[10px] h-5 rounded-full border-2 border-white dark:border-slate-900">{totalUnread > 99 ? "99+" : totalUnread}</Badge>}
            </div>
            <Button size="icon" variant="ghost" className="rounded-xl text-primary hover:bg-primary/5" aria-label="New Chat" onClick={() => { setIsNewChatOpen(true); fetchMembers(); }}>
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search everything..." className="pl-10 h-11 bg-slate-100 dark:bg-slate-800 border-none rounded-xl" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear Search" onClick={() => { setSearchQuery(""); setGlobalSearchResults([]); }}><X className="w-4 h-4 text-slate-400" /></button>}
          </div>
        </div>
        <ScrollArea className="flex-1 px-3">
          <div className="space-y-6 pb-6">
            {searchQuery.length >= 2 && (
              <div className="space-y-1 px-1">
                <div className="flex items-center justify-between px-2 mb-2">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Message Threads</p>
                   {isGlobalSearching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                </div>
                {globalSearchResults.map((res) => (
                  <button key={`global-${res.id}`} onClick={() => handleJumpToMessage(res.channel_id, res.id)} className="w-full text-left p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 flex gap-3">
                    <Avatar className="w-8 h-8 shrink-0"><AvatarImage src={res.profiles?.avatar_preset ? `/avatars/${res.profiles.avatar_preset}.png` : res.profiles?.avatar_url} /><AvatarFallback className="text-[10px]">{res.profiles?.full_name?.[0]}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between items-baseline mb-0.5"><p className="text-xs font-bold truncate">{res.channel_display_name}</p><span className="text-[9px] text-slate-400 shrink-0 ml-1">{new Date(res.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span></div>
                       <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed"><span className="font-bold text-slate-700 dark:text-slate-300 mr-1">{res.profiles?.full_name?.split(' ')[0]}:</span>{res.message}</p>
                    </div>
                  </button>
                ))}
                <Separator className="my-4 opacity-50" />
              </div>
            )}
            <div className="space-y-1">
              {loadingChats ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /><p className="text-xs font-medium">Synchronizing conversations...</p></div>
              ) : filteredChats.map((chat) => {
                  const isActive = selectedChatId === chat.id;
                  const unreadCount = unreadCounts[chat.id] || 0;
                  const isMuted = muteStates[chat.id]?.is_muted && (!muteStates[chat.id].muted_until || new Date(muteStates[chat.id].muted_until!) > new Date());
                  return (
                    <button key={chat.id} onClick={() => handleSelectChat(chat.id)} className={cn("w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all hover:bg-slate-50 dark:hover:bg-slate-800", isActive && "bg-primary/10")}>
                      <Avatar className="w-12 h-12 border-2 border-white dark:border-slate-800 shadow-sm shrink-0">
                        <AvatarImage src={chat.display_avatar_preset ? `/avatars/${chat.display_avatar_preset}.png` : chat.display_avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {chat.name.toLowerCase() === 'general' ? <Hash className="w-5 h-5" /> : chat.type === 'group' ? <Users className="w-5 h-5" /> : (chat.display_name?.[0] || 'C').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0"><p className={cn("font-bold text-sm truncate", isActive ? "text-primary" : "text-slate-900 dark:text-white")}>{chat.display_name}</p>{isMuted && <BellOff className="w-3 h-3 text-slate-400" />}</div>
                          {chat.last_message_at && <span className="text-[10px] text-slate-400 font-medium ml-2 shrink-0">{new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{chat.last_message || 'No activity yet'}</p>
                          {unreadCount > 0 && <Badge className={cn("h-5 min-w-[20px] px-1 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-slate-900 shrink-0", isMuted ? "bg-slate-400" : "bg-primary")}>{unreadCount > 99 ? "99+" : unreadCount}</Badge>}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </ScrollArea>
      </div>

      <div className={cn("flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-950/20 transition-all", !showConversation ? "hidden md:flex" : "flex")}>
        {selectedChat ? (
          <>
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center justify-between">
              {isSearchOpen ? (
                <div className="flex items-center gap-3 w-full"><Button variant="ghost" size="icon" aria-label="Close Search" onClick={() => { setIsSearchOpen(false); setInChatSearchQuery(""); setInChatSearchResults([]); }}><ChevronLeft className="w-5 h-5" /></Button><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Filter this thread..." className="pl-10 h-10 bg-slate-100 dark:bg-slate-800 border-none rounded-xl" value={inChatSearchQuery} onChange={(e) => setInChatSearchQuery(e.target.value)} autoFocus />{inChatSearchQuery && <button className="absolute right-3 top-1/2 -translate-y-1/2" aria-label="Clear Query" onClick={() => { setInChatSearchQuery(""); setInChatSearchResults([]); }}><X className="w-4 h-4 text-slate-400" /></button>}</div></div>
              ) : (
                <>
                  <div className="flex items-center gap-4 min-w-0"><Button variant="ghost" size="icon" aria-label="Back" className="md:hidden rounded-xl h-10 w-10" onClick={() => setShowConversation(false)}><ChevronLeft className="w-6 h-6" /></Button><Avatar className="w-10 h-10 cursor-pointer" onClick={() => { setIsInfoSheetOpen(true); fetchInfoMembers(); }}><AvatarImage src={selectedChat.display_avatar_preset ? `/avatars/${selectedChat.display_avatar_preset}.png` : selectedChat.display_avatar} /><AvatarFallback className="bg-primary/10 text-primary font-bold">{selectedChat.name.toLowerCase() === 'general' ? <Hash className="w-4 h-4" /> : selectedChat.type === 'group' ? <Users className="w-4 h-4" /> : (selectedChat.display_name?.[0] || 'C').toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><div className="flex items-center gap-2"><p className="font-bold text-sm md:text-base dark:text-white truncate">{selectedChat.display_name}</p>{isCurrentChatMuted && <BellOff className="w-3 h-3 text-slate-400" />}</div><p className="text-[10px] md:text-xs text-emerald-500 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />{selectedChat.name.toLowerCase() === 'general' ? 'Workspace Hub' : selectedChat.type === 'direct' ? 'Private Discussion' : 'Group Workspace'}{isCurrentChatMuted && <span className="text-slate-400 ml-1 font-bold">• Silenced</span>}</p></div></div>
                  <div className="flex items-center gap-1">
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Chat Info" className="rounded-xl text-slate-400" onClick={() => { setIsInfoSheetOpen(true); fetchInfoMembers(); }}><Info className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent>Conversation details</TooltipContent></Tooltip></TooltipProvider>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Detach" className="rounded-xl text-slate-400 hover:text-primary" onClick={() => addBubble(selectedChat)}><MessageCircle className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent>Open as floating window</TooltipContent></Tooltip></TooltipProvider>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Media & Files" className="rounded-xl text-slate-400" onClick={() => { setIsMediaSheetOpen(true); fetchMedia(); }}><Files className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent>Shared assets</TooltipContent></Tooltip></TooltipProvider>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" aria-label="Search" className="rounded-xl text-slate-400" onClick={() => setIsSearchOpen(true)}><Search className="w-5 h-5" /></Button></TooltipTrigger><TooltipContent>Search thread</TooltipContent></Tooltip></TooltipProvider>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="More Options" className="rounded-xl text-slate-400"><MoreVertical className="w-5 h-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56 dark:bg-slate-900 dark:border-slate-800"><DropdownMenuLabel className="dark:text-slate-100">Notification Settings</DropdownMenuLabel>{isCurrentChatMuted ? <DropdownMenuItem onClick={handleUnmute} className="gap-2 text-primary font-medium"><Bell className="w-4 h-4" /> Restore Alerts</DropdownMenuItem> : <><DropdownMenuItem onClick={() => handleMute('1h')}>Mute for 1 hour</DropdownMenuItem><DropdownMenuItem onClick={() => handleMute('8h')}>Mute for 8 hours</DropdownMenuItem><DropdownMenuItem onClick={() => handleMute('24h')}>Mute for 24 hours</DropdownMenuItem><DropdownMenuItem onClick={() => handleMute('forever')} className="text-rose-500">Mute Indefinitely</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu>
                  </div>
                </>
              )}
            </div>
            {isSearchOpen && inChatSearchQuery.length >= 2 && (
              <div className="absolute top-20 left-4 right-4 md:left-[350px] z-[40] pointer-events-none"><div className="max-w-xl mx-auto w-full pointer-events-auto bg-white dark:bg-slate-900 border dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden max-h-[60vh] flex flex-col"><div className="p-3 bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800 flex items-center justify-between"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Context Hits</span>{isSearching && <Loader2 className="w-3 h-3 animate-spin text-primary" />}</div><ScrollArea className="flex-1"><div className="p-1 space-y-1">{inChatSearchResults.map(res => (<button key={res.id} className="w-full text-left p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 flex gap-3 group" onClick={() => { const el = document.getElementById(`message-${res.id}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setHighlightedMessageId(res.id); setTimeout(() => setHighlightedMessageId(null), 3000); } }}><Avatar className="w-8 h-8"><AvatarImage src={res.profiles?.avatar_preset ? `/avatars/${res.profiles.avatar_preset}.png` : res.profiles?.avatar_url} /><AvatarFallback className="text-[10px]">{res.profiles?.full_name?.[0]}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="flex justify-between items-baseline mb-0.5"><p className="text-xs font-bold truncate group-hover:text-primary">{res.profiles?.full_name}</p><span className="text-[9px] text-slate-400 shrink-0 ml-2">{new Date(res.created_at).toLocaleDateString()}</span></div><p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{res.message}</p></div></button>))}</div></ScrollArea></div></div>
            )}
            <ScrollArea ref={scrollAreaRef} className="flex-1 px-4 md:px-8">
              <div className="py-8 space-y-6">
                {loadingMessages ? <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3"><Loader2 className="w-8 h-8 animate-spin" /><p className="text-sm font-medium">Synchronizing history...</p></div> : messages.length === 0 ? <p className="text-center text-sm text-slate-400 py-20 italic">No messages yet. Start the conversation!</p> : messages.map((msg) => {
                  const isMe = msg.sender_id === userProfile?.id;
                  const isHighlighted = highlightedMessageId === msg.id;
                  const isEditing = editingMessageId === msg.id;
                  const wasEdited = msg.updated_at && new Date(msg.updated_at).getTime() - new Date(msg.created_at).getTime() > 1000;

                  return (
                    <div key={msg.id} id={`message-${msg.id}`} className={cn("group flex gap-3 max-w-[85%] md:max-w-[70%] transition-all", isMe ? "ml-auto flex-row-reverse" : "mr-auto", isHighlighted && "scale-105")}>
                      {!isMe && <Avatar className="w-8 h-8 shrink-0 mt-1"><AvatarImage src={msg.profiles?.avatar_preset ? `/avatars/${msg.profiles.avatar_preset}.png` : msg.profiles?.avatar_url} /><AvatarFallback className="text-[10px]">{msg.profiles?.full_name?.[0]}</AvatarFallback></Avatar>}
                      <div className={cn("flex flex-col relative", isMe ? "items-end" : "items-start", isEditing && "w-full")}>
                        {!isMe && <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1">{msg.profiles?.full_name}</span>}
                        
                        {isEditing ? (
                          <div className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl border-2 border-primary/20 space-y-2">
                             <p className="text-[9px] font-bold text-primary uppercase tracking-widest px-1">Editing Message</p>
                             <Textarea 
                               value={editMessageInput}
                               onChange={e => setEditMessageInput(e.target.value)}
                               className="min-h-[80px] bg-white dark:bg-slate-950 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
                               autoFocus
                               onKeyDown={e => {
                                 if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleUpdateMessage(); }
                                 if (e.key === 'Escape') setEditingMessageId(null);
                               }}
                             />
                             <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold uppercase" onClick={() => setEditingMessageId(null)} disabled={isEditingLoading}>Cancel</Button>
                                <Button size="sm" className="h-7 text-[10px] font-bold uppercase" onClick={handleUpdateMessage} disabled={isEditingLoading || !editMessageInput.trim()}>
                                  {isEditingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save Changes'}
                                </Button>
                             </div>
                          </div>
                        ) : (
                          <div className={cn("px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed border-2 border-transparent transition-all relative", isMe ? "bg-primary text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border dark:border-slate-700", isHighlighted && "border-primary ring-4 ring-primary/20")}>
                            {msg.message}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="space-y-3 mt-4">
                                {msg.attachments.map(att => {
                                  const isImage = att.file_type?.startsWith('image/');
                                  return (
                                    <div key={att.id} className="max-w-xs">
                                      {isImage && att.signed_url ? <img src={att.signed_url} alt={att.file_name} className="w-full rounded-xl cursor-pointer" onClick={() => window.open(att.signed_url, '_blank')} /> : <div className="flex items-center gap-4 p-3 rounded-xl border dark:border-slate-800 bg-slate-50 dark:bg-slate-900"><FileIcon className="w-5 h-5" /><div className="flex-1 min-w-0"><p className="text-xs font-bold truncate">{att.file_name}</p><p className="text-[10px] opacity-60 uppercase">{formatBytes(att.file_size_bytes)}</p></div><Button variant="ghost" size="icon" aria-label="Download" className="h-8 w-8" onClick={() => window.open(att.signed_url, '_blank')}><Download className="w-4 h-4" /></Button></div>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div className={cn("flex items-center gap-1.5 mt-1.5 justify-end opacity-70 text-[9px] font-bold", isMe ? "text-white/80" : "text-slate-400")}>
                              {wasEdited && <span className="italic mr-1">(edited)</span>}
                              <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isMe && <CheckCheck className="w-3 h-3" />}
                            </div>

                            {/* Message Action Menu */}
                            {!isEditing && (
                              <div className={cn(
                                "absolute top-0 opacity-0 md:group-hover:opacity-100 transition-opacity",
                                isMe ? "-left-10" : "-right-10"
                              )}>
                                <DropdownMenu onOpenChange={(open) => !open && (typeof document !== 'undefined' ? document.body.style.pointerEvents = "" : null)}>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Message actions" className="h-8 w-8 rounded-full dark:text-slate-400 dark:hover:text-white">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align={isMe ? "end" : "start"} className="w-48 dark:bg-slate-900 dark:border-slate-800">
                                     <DropdownMenuItem 
                                       onClick={() => handleCopyMessage(msg.message)}
                                       disabled={!msg.message || msg.message.trim().length === 0}
                                       className="gap-2"
                                     >
                                       <Copy className="h-4 w-4" /> Copy Message
                                     </DropdownMenuItem>
                                     {isMe && msg.message && (
                                       <DropdownMenuItem 
                                         onClick={() => { setEditingMessageId(msg.id); setEditMessageInput(msg.message); }}
                                         className="gap-2"
                                       >
                                         <Edit2 className="h-4 w-4" /> Edit Message
                                       </DropdownMenuItem>
                                     )}
                                     <DropdownMenuSeparator className="dark:bg-slate-800" />
                                     <DropdownMenuItem disabled className="gap-2"><CheckSquare className="h-4 w-4" /> Create Task</DropdownMenuItem>
                                     <DropdownMenuItem disabled className="gap-2 text-rose-500"><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
              {selectedFile && <div className="mb-4 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border dark:border-slate-800">
                <div className="flex items-center gap-3 overflow-hidden"><div className="p-2 bg-primary/10 rounded-lg"><Paperclip className="w-4 h-4 text-primary" /></div><div className="min-w-0"><p className="text-sm font-bold truncate">{selectedFile.name}</p><p className="text-[10px] text-muted-foreground uppercase">{formatBytes(selectedFile.size)}</p></div></div><Button variant="ghost" size="icon" aria-label="Remove Attachment" onClick={() => setSelectedFile(null)}><X className="w-4 h-4" /></Button>
              </div>}
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-950 p-2 rounded-2xl border dark:border-slate-800 transition-all focus-within:ring-2 focus-within:ring-primary/20">
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                <Button variant="ghost" size="icon" aria-label="Attach File" className="text-slate-400 hover:text-primary rounded-xl shrink-0" onClick={() => fileInputRef.current?.click()} disabled={isSending}><Paperclip className="w-5 h-5" /></Button>
                <Input className="border-none shadow-none bg-transparent focus-visible:ring-0 text-base flex-1 dark:text-white" placeholder="Compose message..." value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
                <Button size="icon" aria-label="Send" onClick={handleSendMessage} className={cn("rounded-xl transition-all", (messageInput.trim() || selectedFile) && !isSending ? "bg-primary" : "bg-slate-300 dark:bg-slate-700")} disabled={(!messageInput.trim() && !selectedFile) || isSending}>{isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4"><MessageSquare className="w-12 h-12 text-primary/40" /><h2 className="text-xl font-bold">Workspace Messenger</h2><p className="text-sm text-slate-500 max-w-xs">Select or start a conversation to begin collaborating with your team.</p></div>
        )}
      </div>

      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 rounded-[2rem]">
          <div className="p-6 pb-0"><DialogHeader><DialogTitle className="text-2xl font-bold">New Thread</DialogTitle><DialogDescription>Start a secure conversation within the workspace.</DialogDescription></DialogHeader><Tabs value={chatMode} onValueChange={(v: any) => setChatMode(v)} className="mt-6"><TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900"><TabsTrigger value="direct">Direct Message</TabsTrigger><TabsTrigger value="group">Group Channel</TabsTrigger></TabsList><div className="mt-6 space-y-4">{chatMode === 'group' && <div className="space-y-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Channel Label</p><Input placeholder="Internal Project X..." value={groupName} onChange={(e) => setGroupName(e.target.value)} className="rounded-2xl" /></div>}<div className="space-y-2"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{chatMode === 'group' ? `Participants (${selectedMemberIds.length})` : 'Select Recipient'}</p><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><Input placeholder="Search roster..." className="pl-10 rounded-2xl" value={memberSearchQuery} onChange={(e) => setMemberSearchQuery(e.target.value)} /></div></div></div></Tabs></div>
          <div className="p-6"><ScrollArea className="h-64"><div className="space-y-2">{loadingMembers ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : filteredMembers.map((member) => { const isSelected = chatMode === 'group' ? selectedMemberIds.includes(member.id) : selectedMemberId === member.id; return (<button key={member.id} onClick={() => chatMode === 'group' ? (setSelectedMemberIds(prev => prev.includes(member.id) ? prev.filter(x => x !== member.id) : [...prev, member.id])) : setSelectedMemberId(member.id)} className={cn("w-full flex items-center gap-4 p-3 rounded-2xl transition-all", isSelected ? "bg-primary/10 ring-1 ring-primary/20 shadow-sm" : "hover:bg-slate-50 dark:hover:bg-slate-900")}><Avatar className="w-10 h-10"><AvatarImage src={member.avatar_preset ? `/avatars/${member.avatar_preset}.png` : member.avatar_url} /><AvatarFallback>{member.full_name[0]}</AvatarFallback></Avatar><div className="flex-1 min-w-0"><div className="flex items-center gap-1.5"><p className="font-bold text-sm truncate">{member.full_name}</p><Badge variant="outline" className="text-[8px] uppercase">{member.role}</Badge></div><p className="text-[10px] text-slate-500 truncate">@{member.username || member.email.split('@')[0]}</p></div>{isSelected && <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-md animate-in zoom-in"><Check className="w-3 h-3 text-white" /></div>}</button>); })}</div></ScrollArea></div>
          <DialogFooter className="p-6 pt-0 border-t dark:border-slate-800"><Button variant="ghost" className="flex-1 rounded-xl" onClick={() => setIsNewChatOpen(false)}>Cancel</Button><Button className="flex-1 rounded-xl shadow-lg" disabled={isStartingChat || (chatMode === 'direct' && !selectedMemberId) || (chatMode === 'group' && (!groupName.trim() || selectedMemberIds.length < 2))} onClick={handleStartChat}>{isStartingChat ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}{isStartingChat ? 'Initializing...' : chatMode === 'group' ? 'Launch Group' : 'Start Thread'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={isMediaSheetOpen} onOpenChange={setIsMediaSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col dark:bg-slate-950 overflow-hidden"><div className="p-6 pb-0"><SheetHeader><div className="flex items-center gap-2 mb-1"><Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] h-4">Asset Manager</Badge></div><SheetTitle className="text-2xl font-bold">Media & Files</SheetTitle><SheetDescription>All attachments shared in {selectedChat?.display_name}.</SheetDescription></SheetHeader><Tabs defaultValue="media" className="mt-8 flex-1 flex flex-col"><TabsList className="grid w-full grid-cols-2 bg-slate-100 dark:bg-slate-900/50 mb-6"><TabsTrigger value="media" className="gap-2"><ImageIcon className="w-3.5 h-3.5" /> Gallery</TabsTrigger><TabsTrigger value="files" className="gap-2"><FileIcon className="w-3.5 h-3.5" /> Documents</TabsTrigger></TabsList><ScrollArea className="flex-1 -mx-6 px-6"><TabsContent value="media" className="m-0 pb-8">{loadingMedia ? <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin" /></div> : allMedia.filter(m => m.file_type?.startsWith('image/')).length === 0 ? <p className="text-center text-sm text-slate-400 py-20">No images shared yet.</p> : <div className="grid grid-cols-2 gap-4">{allMedia.filter(m => m.file_type?.startsWith('image/')).map((item) => (<div key={item.id} className="group relative aspect-square rounded-2xl overflow-hidden border dark:border-slate-800 bg-slate-50 dark:bg-slate-900">{item.signed_url && <img src={item.signed_url} alt={item.file_name} className="w-full h-full object-cover" />}<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2"><Button size="icon" variant="secondary" aria-label="Download" className="h-8 w-8 rounded-full" onClick={() => window.open(item.signed_url, '_blank')}><Download className="w-3.5 h-3.5" /></Button></div></div>))}</div>}</TabsContent><TabsContent value="files" className="m-0 pb-8">{allMedia.filter(m => !m.file_type?.startsWith('image/')).length === 0 ? <p className="text-center text-sm text-slate-400 py-20">No files shared yet.</p> : allMedia.filter(m => !m.file_type?.startsWith('image/')).map((item) => (<div key={item.id} className="flex items-center gap-4 p-3 rounded-2xl border dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 transition-colors group"><div className="p-2.5 bg-primary/10 rounded-xl"><FileIcon className="w-5 h-5 text-primary" /></div><div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{item.file_name}</p><p className="text-[10px] text-muted-foreground uppercase">{formatBytes(item.file_size_bytes)}</p></div><Button size="icon" variant="ghost" aria-label="Download" onClick={() => window.open(item.signed_url, '_blank')}><Download className="w-4 h-4" /></Button></div>))}</TabsContent></ScrollArea></Tabs></div></SheetContent>
      </Sheet>

      <Sheet open={isInfoSheetOpen} onOpenChange={(open) => { setIsInfoSheetOpen(open); if (!open) { setIsRenamingGroup(false); } }}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col dark:bg-slate-950 overflow-hidden">
          <div className="p-8 pb-4">
            <SheetHeader className="items-center text-center">
              <Avatar className="w-20 h-20 mb-4 border-4 border-white dark:border-slate-800 shadow-xl">
                <AvatarImage src={selectedChat?.display_avatar_preset ? `/avatars/${selectedChat.display_avatar_preset}.png` : selectedChat?.display_avatar} />
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                  {selectedChat?.name.toLowerCase() === 'general' ? <Hash className="w-10 h-10" /> : selectedChat?.type === 'group' ? <Users className="w-10 h-10" /> : selectedChat?.display_name?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex items-center gap-2">
                {isRenamingGroup ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Input 
                      value={newGroupNameInput} 
                      onChange={e => setNewGroupNameInput(e.target.value)} 
                      className="h-9 w-48 text-sm"
                      autoFocus
                      maxLength={80}
                      disabled={isRenamingLoading}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRenameGroup(); if (e.key === 'Escape') setIsRenamingGroup(false); }}
                    />
                    <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleRenameGroup} disabled={isRenamingLoading || !newGroupNameInput.trim()}>
                      {isRenamingLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-4 h-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setIsRenamingGroup(false)} disabled={isRenamingLoading}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <SheetTitle className="text-2xl font-bold dark:text-white">{selectedChat?.display_name}</SheetTitle>
                    {selectedChat?.type === 'group' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => { setNewGroupNameInput(selectedChat.name); setIsRenamingGroup(true); }}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
              <SheetDescription className="text-sm font-medium text-emerald-500 uppercase tracking-widest mt-1">
                {selectedChat?.name.toLowerCase() === 'general' ? 'Workspace Channel' : selectedChat?.type === 'direct' ? 'Direct Message' : 'Group Workspace'}
              </SheetDescription>
            </SheetHeader>
          </div>

          <ScrollArea className="flex-1 px-8 pb-8">
             <div className="space-y-8 mt-4">
                {selectedChat?.name.toLowerCase() === 'general' ? (
                  <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed italic">
                      This is the primary workspace hub. Everyone in <strong>{activeWorkspace?.name}</strong> has automatic access to this conversation.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Participants</p>
                          <p className="text-xl font-bold dark:text-white">{infoMembers.length}</p>
                       </div>
                       <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-800">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Created</p>
                          <p className="text-xs font-bold dark:text-white">{new Date(selectedChat?.created_at || '').toLocaleDateString()}</p>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <Users className="w-3.5 h-3.5" /> Conversation Roster
                          </h4>
                          {loadingInfo && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                       </div>
                       
                       <div className="space-y-3">
                          {infoMembers.length === 0 && !loadingInfo ? (
                             <p className="text-xs text-center text-slate-400 py-4 italic">No participants detected.</p>
                          ) : infoMembers.map(member => (
                             <div key={member.id} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                   <Avatar className="w-9 h-9 border dark:border-slate-800">
                                      <AvatarImage src={member.profiles?.avatar_preset ? `/avatars/${member.profiles.avatar_preset}.png` : member.profiles?.avatar_url} />
                                      <AvatarFallback className="text-xs">{member.profiles?.full_name?.[0]}</AvatarFallback>
                                   </Avatar>
                                   <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                         <p className="text-sm font-bold truncate dark:text-slate-100">{member.profiles?.full_name}</p>
                                         {member.user_id === userProfile?.id && <Badge variant="secondary" className="text-[8px] h-3.5 px-1 py-0 opacity-60">You</Badge>}
                                      </div>
                                      <p className="text-[10px] text-slate-500 truncate">@{member.profiles?.username || member.profiles?.email.split('@')[0]}</p>
                                   </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={cn(
                                     "text-[8px] uppercase h-4 px-1.5",
                                     member.role === 'admin' ? "border-primary text-primary" : "text-slate-400"
                                  )}>
                                     {member.role}
                                  </Badge>
                                  {selectedChat?.type === 'group' && canUserManageRoster && member.user_id !== userProfile?.id && (
                                    <DropdownMenu onOpenChange={(open) => !open && (typeof document !== 'undefined' ? document.body.style.pointerEvents = "" : null)}>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <MoreVertical className="w-3.5 h-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48 dark:bg-slate-900 dark:border-slate-800">
                                        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-slate-500">Manage Member</DropdownMenuLabel>
                                        {member.role === 'member' ? (
                                          <DropdownMenuItem onClick={() => { setMemberToUpdateRole(member); setNewRoleTarget('admin'); }} className="gap-2">
                                            <ShieldCheck className="w-4 h-4 text-primary" /> Promote to Admin
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem onClick={() => { setMemberToUpdateRole(member); setNewRoleTarget('member'); }} className="gap-2">
                                            <ShieldAlert className="w-4 h-4 text-amber-500" /> Demote to Member
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator className="dark:bg-slate-800" />
                                        <DropdownMenuItem onClick={() => setMemberToRemove(member)} className="text-rose-500 gap-2 dark:hover:bg-rose-500/10">
                                          <UserMinus className="w-4 h-4" /> Remove from Group
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                             </div>
                          ))}
                       </div>
                    </div>
                  </>
                )}

                <div className="space-y-4 pt-4 border-t dark:border-slate-800">
                   <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Management</h4>
                   <div className="space-y-2">
                      {selectedChat?.type === 'group' ? (
                        <>
                          <Button variant="outline" className="w-full justify-start gap-3 rounded-xl border-slate-100 dark:border-slate-800" onClick={() => { setNewGroupNameInput(selectedChat.name); setIsRenamingGroup(true); }}>
                             <Edit2 className="w-4 h-4" /> Rename Group
                          </Button>
                          <Button variant="outline" className="w-full justify-start gap-3 rounded-xl border-slate-100 dark:border-slate-800" onClick={() => { setIsAddMembersOpen(true); fetchMembers(); }}>
                             <UserPlus className="w-4 h-4" /> Add Participants
                          </Button>
                          
                          <div className="pt-2 flex flex-col gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" className="w-full justify-start gap-3 rounded-xl text-rose-500 border-rose-50 dark:border-rose-900/20 hover:bg-rose-50 dark:hover:bg-rose-950/20">
                                   <LogOut className="w-4 h-4" /> Leave Group
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="dark:text-white">Leave Group?</AlertDialogTitle>
                                  <AlertDialogDescription className="dark:text-slate-400">
                                    Are you sure you want to leave <strong>{selectedChat.name}</strong>? You will no longer be able to see or send messages in this group.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleLeaveGroup} className="bg-rose-500 hover:bg-rose-600 text-white">
                                    {isLeavingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Leave Group
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>

                            {canUserManageRoster && (
                              <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteGroupOpen}>
                                <AlertDialogTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start gap-3 rounded-xl text-rose-600 border-rose-100 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-100 dark:hover:bg-rose-900/30">
                                     <Trash2 className="w-4 h-4" /> Delete Group
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="dark:text-white">Delete Group?</AlertDialogTitle>
                                    <AlertDialogDescription className="dark:text-slate-400">
                                      This will remove the group <strong>{selectedChat.name}</strong> from members’ chat lists. Message history and shared files will be preserved in the archive.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800">Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={handleDeleteGroup} 
                                      className="bg-rose-600 hover:bg-rose-700 text-white"
                                      disabled={isArchivingLoading}
                                    >
                                      {isArchivingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                      Confirm Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-[10px] text-muted-foreground italic px-1">Management actions are not available for this chat type.</p>
                      )}
                   </div>
                </div>
             </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Remove Member?</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              Are you sure you want to remove <strong>{memberToRemove?.profiles?.full_name}</strong> from this conversation? They will lose access to all message history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveMember} 
              className="bg-rose-500 hover:bg-rose-600 text-white"
              disabled={isRemovingLoading}
            >
              {isRemovingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!memberToUpdateRole} onOpenChange={(open) => !open && setMemberToUpdateRole(null)}>
        <AlertDialogContent className="dark:bg-slate-950 dark:border-slate-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">
              {newRoleTarget === 'admin' ? 'Promote to Admin?' : 'Demote to Member?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="dark:text-slate-400">
              {newRoleTarget === 'admin' 
                ? `Are you sure you want to make ${memberToUpdateRole?.profiles?.full_name} an administrator of this group?` 
                : `Are you sure you want to demote ${memberToUpdateRole?.profiles?.full_name} to a normal member?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-slate-900 dark:text-white dark:border-slate-800">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleUpdateMemberRole} 
              className={cn("bg-primary hover:bg-primary/90 text-white", newRoleTarget === 'member' && "bg-amber-600 hover:bg-amber-700")}
              disabled={isRoleLoading}
            >
              {isRoleLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirm Change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddMembersOpen} onOpenChange={setIsAddMembersOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden dark:bg-slate-950 rounded-[2rem]">
          <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Expand Roster</DialogTitle>
              <DialogDescription>Select active workspace members to enroll in this group.</DialogDescription>
            </DialogHeader>
            <div className="relative mt-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search roster..." 
                className="pl-10 rounded-2xl bg-slate-100 dark:bg-slate-900 border-none" 
                value={addMembersSearchQuery} 
                onChange={(e) => setAddMembersSearchQuery(e.target.value)} 
              />
            </div>
          </div>
          <div className="p-6">
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {loadingMembers ? (
                  <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : addableMembers.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-10 italic">No eligible members found.</p>
                ) : addableMembers.map((member) => {
                  const isSelected = selectedMemberIdsToAdd.includes(member.id);
                  return (
                    <button 
                      key={member.id} 
                      onClick={() => setSelectedMemberIdsToAdd(prev => prev.includes(member.id) ? prev.filter(x => x !== member.id) : [...prev, member.id])} 
                      className={cn("w-full flex items-center gap-4 p-3 rounded-2xl transition-all", isSelected ? "bg-primary/10 ring-1 ring-primary/20 shadow-sm" : "hover:bg-slate-50 dark:hover:bg-slate-900")}
                    >
                      <Avatar className="w-10 h-10"><AvatarImage src={member.avatar_preset ? `/avatars/${member.avatar_preset}.png` : member.avatar_url} /><AvatarFallback>{member.full_name[0]}</AvatarFallback></Avatar>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5"><p className="font-bold text-sm truncate">{member.full_name}</p><Badge variant="outline" className="text-[8px] uppercase">{member.role}</Badge></div>
                        <p className="text-[10px] text-slate-500 truncate">@{member.username || member.email.split('@')[0]}</p>
                      </div>
                      <Checkbox checked={isSelected} className="rounded-full" />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter className="p-6 pt-0 border-t dark:border-slate-800">
            <Button variant="ghost" className="flex-1 rounded-xl" onClick={() => { setIsAddMembersOpen(false); setSelectedMemberIdsToAdd([]); }}>Cancel</Button>
            <Button 
              className="flex-1 rounded-xl shadow-lg" 
              disabled={isAddingMembersLoading || selectedMemberIdsToAdd.length === 0} 
              onClick={handleAddMembersToGroup}
            >
              {isAddingMembersLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {isAddingMembersLoading ? 'Enrolling...' : `Add Selected (${selectedMemberIdsToAdd.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
