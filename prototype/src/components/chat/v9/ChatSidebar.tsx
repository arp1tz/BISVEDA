"use client";

import React from "react";
import Link from "next/link";
import { Plus, MessageSquare, BookOpen, FlaskConical, Award, PanelLeftClose, User } from "lucide-react";

export interface ChatSessionItem {
  id: string;
  title: string;
  timestamp: number;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  currentChatId?: string;
  recentChats: ChatSessionItem[];
  onSelectChat: (chatId: string) => void;
}

export function ChatSidebar({
  isOpen,
  onToggle,
  onNewChat,
  currentChatId,
  recentChats,
  onSelectChat,
}: ChatSidebarProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={onToggle}
        className="fixed inset-0 bg-black/20 z-40 md:hidden backdrop-blur-2xs"
      />

      {/* Sidebar Panel (240px) */}
      <aside className="fixed md:static inset-y-0 left-0 z-50 w-[240px] bg-[#F7F8FA] border-r border-[#E5E7EB] flex flex-col justify-between shrink-0 select-none shadow-md md:shadow-none">
        {/* Top: Header & + New Chat */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <Link href="/" className="flex items-center gap-1.5 font-bold text-sm text-[#0B2A4A]">
              <span className="text-[#E8710A] text-base font-black">◆</span>
              <span>BISVEDA</span>
            </Link>
            <button
              type="button"
              onClick={onToggle}
              className="p-1 text-[#64748B] hover:text-[#0F172A] rounded-md hover:bg-[#E5E7EB] transition-colors cursor-pointer"
              title="Close Sidebar"
              aria-label="Close Sidebar"
            >
              <PanelLeftClose className="h-4 w-4 pointer-events-none" />
            </button>
          </div>

          <button
            type="button"
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#0B2A4A] text-white hover:bg-[#081e36] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 pointer-events-none" />
            <span>New chat</span>
          </button>
        </div>

        {/* Middle: Chat History */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          <span className="px-2 text-[10px] font-bold text-[#64748B] uppercase tracking-wider block mb-1">
            Recent chats
          </span>
          {recentChats.length === 0 ? (
            <p className="px-2 py-3 text-xs text-[#64748B] italic">No recent chats</p>
          ) : (
            recentChats.map((chat) => {
              const isSelected = currentChatId === chat.id;
              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-white text-[#0B2A4A] font-semibold border border-[#E5E7EB] shadow-2xs"
                      : "text-[#0F172A] hover:bg-[#E5E7EB]/70"
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
                  <span className="truncate flex-1">{chat.title || "Untitled chat"}</span>
                </button>
              );
            })
          )}
        </div>

        {/* Bottom: Navigation Links & User Profile */}
        <div className="p-3 border-t border-[#E5E7EB] space-y-1 text-xs">
          <Link
            href="/standards"
            className="flex items-center gap-2 px-2 py-1.5 rounded text-[#0F172A] hover:bg-[#E5E7EB] transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#64748B]" />
            <span>Standards</span>
          </Link>
          <Link
            href="/labs"
            className="flex items-center gap-2 px-2 py-1.5 rounded text-[#0F172A] hover:bg-[#E5E7EB] transition-colors"
          >
            <FlaskConical className="h-3.5 w-3.5 text-[#64748B]" />
            <span>Labs</span>
          </Link>
          <Link
            href="/certification"
            className="flex items-center gap-2 px-2 py-1.5 rounded text-[#0F172A] hover:bg-[#E5E7EB] transition-colors"
          >
            <Award className="h-3.5 w-3.5 text-[#64748B]" />
            <span>Certification</span>
          </Link>

          <div className="pt-2 mt-2 border-t border-[#E5E7EB] flex items-center justify-between text-xs text-[#64748B] px-1">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[#0B2A4A]">
                <User className="h-3 w-3" />
              </div>
              <span className="font-medium text-[#0F172A]">Guest</span>
            </div>
            <Link href="/about" className="hover:text-[#0F172A] hover:underline">
              About
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
