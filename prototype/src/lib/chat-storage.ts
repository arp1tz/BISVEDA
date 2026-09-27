// BISVEDA V8 — Chat & Session Storage Engine
// Provides browser-local persistence for anonymous visitors
// and account-synced saved chat dossiers for logged-in users.

import type { ChatMessage } from "@/lib/types";
import type { UserProfile } from "@/components/auth/LoginModal";

export interface SavedChatSession {
  id: string;
  title: string;
  userId?: string | null;
  userName?: string;
  userRole?: "manufacturer" | "consumer" | "employee";
  createdAt: string;
  updatedAt: string;
  query: string;
  messages: ChatMessage[];
  dossierSummary?: string;
  primaryStandard?: string;
  starred?: boolean;
}

const ACTIVE_SESSION_KEY = "bisveda_active_session";
const SAVED_CHATS_KEY = "bisveda_saved_chats";
const USER_PROFILE_KEY = "bisveda_user_profile";

/**
 * Persists the current in-flight conversation immediately to local browser storage.
 * Ensures anonymous users do not lose their immediate responses on refresh.
 */
export function saveActiveSession(
  messages: ChatMessage[],
  query: string,
  dossier?: any
): void {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      messages,
      query,
      dossier,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to save active session to localStorage:", err);
  }
}

/**
 * Loads the active conversation from local browser storage.
 */
export function loadActiveSession(): {
  messages: ChatMessage[];
  query: string;
  dossier?: any;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load active session from localStorage:", err);
    return null;
  }
}

/**
 * Clears the active conversation from local storage.
 */
export function clearActiveSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch (err) {
    console.error("Failed to clear active session:", err);
  }
}

/**
 * Retrieves all saved chat sessions.
 * If userId is provided, returns chats saved for that user + any unassigned local chats.
 */
export function getSavedChatSessions(userId?: string | null): SavedChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_CHATS_KEY);
    if (!raw) return [];
    const all: SavedChatSession[] = JSON.parse(raw);
    if (!Array.isArray(all)) return [];

    if (!userId) {
      // For anonymous users, return all sessions saved locally on this browser
      return all;
    }

    // For logged-in users, return their sessions plus any local unassigned sessions
    return all.filter((s) => s.userId === userId || !s.userId);
  } catch (err) {
    console.error("Failed to get saved chat sessions:", err);
    return [];
  }
}

/**
 * Saves a conversation to the saved chats library.
 */
export function saveChatSession(session: {
  id?: string;
  title: string;
  query: string;
  messages: ChatMessage[];
  userId?: string | null;
  userName?: string;
  userRole?: "manufacturer" | "consumer" | "employee";
  dossierSummary?: string;
  primaryStandard?: string;
  starred?: boolean;
}): SavedChatSession {
  if (typeof window === "undefined") {
    return {
      id: session.id || `session-${Date.now()}`,
      title: session.title,
      query: session.query,
      messages: session.messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const raw = localStorage.getItem(SAVED_CHATS_KEY);
    const existing: SavedChatSession[] = raw ? JSON.parse(raw) : [];

    const now = new Date().toISOString();
    const sessionId = session.id || `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const existingIdx = existing.findIndex((s) => s.id === sessionId);

    const updatedRecord: SavedChatSession = {
      id: sessionId,
      title: session.title || session.query || "Compliance Analysis",
      query: session.query,
      messages: session.messages,
      userId: session.userId || null,
      userName: session.userName,
      userRole: session.userRole,
      createdAt: existingIdx >= 0 ? existing[existingIdx].createdAt : now,
      updatedAt: now,
      dossierSummary: session.dossierSummary,
      primaryStandard: session.primaryStandard,
      starred: session.starred ?? (existingIdx >= 0 ? existing[existingIdx].starred : false),
    };

    if (existingIdx >= 0) {
      existing[existingIdx] = updatedRecord;
    } else {
      existing.unshift(updatedRecord);
    }

    localStorage.setItem(SAVED_CHATS_KEY, JSON.stringify(existing));
    return updatedRecord;
  } catch (err) {
    console.error("Failed to save chat session:", err);
    return {
      id: session.id || `chat-${Date.now()}`,
      title: session.title,
      query: session.query,
      messages: session.messages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Renames a saved chat session.
 */
export function renameSavedChatSession(id: string, newTitle: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SAVED_CHATS_KEY);
    if (!raw) return;
    const existing: SavedChatSession[] = JSON.parse(raw);
    const item = existing.find((s) => s.id === id);
    if (item) {
      item.title = newTitle;
      item.updatedAt = new Date().toISOString();
      localStorage.setItem(SAVED_CHATS_KEY, JSON.stringify(existing));
    }
  } catch (err) {
    console.error("Failed to rename saved chat:", err);
  }
}

/**
 * Toggles the starred/bookmarked state of a saved chat session.
 */
export function toggleStarSavedChat(id: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(SAVED_CHATS_KEY);
    if (!raw) return false;
    const existing: SavedChatSession[] = JSON.parse(raw);
    const item = existing.find((s) => s.id === id);
    if (item) {
      item.starred = !item.starred;
      item.updatedAt = new Date().toISOString();
      localStorage.setItem(SAVED_CHATS_KEY, JSON.stringify(existing));
      return !!item.starred;
    }
  } catch (err) {
    console.error("Failed to toggle star:", err);
  }
  return false;
}

/**
 * Deletes a saved chat session by ID.
 */
export function deleteSavedChatSession(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SAVED_CHATS_KEY);
    if (!raw) return;
    const existing: SavedChatSession[] = JSON.parse(raw);
    const filtered = existing.filter((s) => s.id !== id);
    localStorage.setItem(SAVED_CHATS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error("Failed to delete saved chat session:", err);
  }
}

/**
 * Exports a chat session as GitHub-flavored Markdown dossier.
 */
export function exportChatAsMarkdown(session: SavedChatSession): string {
  let md = `# BISVEDA Regulatory Research Dossier\n\n`;
  md += `**Query:** ${session.query}\n`;
  md += `**Title:** ${session.title}\n`;
  md += `**Date:** ${new Date(session.createdAt).toLocaleString("en-IN")}\n`;
  if (session.primaryStandard) {
    md += `**Governing Standard:** ${session.primaryStandard}\n`;
  }
  if (session.userName) {
    md += `**Researcher:** ${session.userName} (${session.userRole || "User"})\n`;
  }
  md += `\n---\n\n## Conversation Transcript\n\n`;

  for (const msg of session.messages) {
    const roleTitle = msg.role === "user" ? "### 👤 User Inquiry" : "### 🏛️ BISVEDA Sovereign Assistant";
    md += `${roleTitle}\n*${new Date(msg.timestamp).toLocaleTimeString("en-IN")}*\n\n${msg.content}\n\n`;

    if (msg.dossier?.regulatory) {
      md += `> **Regulatory Status:** ${msg.dossier.regulatory.qco_status?.toUpperCase() || "VOLUNTARY"} | Ministry: ${msg.dossier.regulatory.ministry || "Government of India"}\n\n`;
    }
  }

  md += `\n---\n*Generated by BISVEDA V8 — Bureau of Indian Standards AI Intelligence Engine*\n`;
  return md;
}

/**
 * Exports a chat session as JSON.
 */
export function exportChatAsJson(session: SavedChatSession): string {
  return JSON.stringify(session, null, 2);
}

/**
 * Persists the logged-in user profile in localStorage.
 */
export function saveStoredUser(user: UserProfile | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_PROFILE_KEY);
    }
  } catch (err) {
    console.error("Failed to save user profile:", err);
  }
}

/**
 * Retrieves the stored user profile if any.
 */
export function loadStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load user profile:", err);
    return null;
  }
}
