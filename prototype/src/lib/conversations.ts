/**
 * BISVEDA — Client-side Conversation Persistence (src/lib/conversations.ts, P6.1)
 *
 * Persists chat sessions and message history in browser localStorage.
 */

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface StoredConversation extends ConversationMeta {
  messages: any[];
}

const STORAGE_KEY = "bisveda_conversations_v1";

function getStorageMap(): Record<string, StoredConversation> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Failed to read conversations from localStorage:", err);
    return {};
  }
}

function setStorageMap(map: Record<string, StoredConversation>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error("Failed to save conversations to localStorage:", err);
  }
}

export function listConversations(): ConversationMeta[] {
  const map = getStorageMap();
  const list = Object.values(map).map(({ id, title, createdAt, updatedAt, messageCount }) => ({
    id,
    title,
    createdAt,
    updatedAt,
    messageCount,
  }));

  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return list;
}

export function getConversation(id: string): StoredConversation | null {
  const map = getStorageMap();
  return map[id] || null;
}

export function saveConversation(id: string, messages: any[], customTitle?: string): void {
  if (!id) return;
  const map = getStorageMap();
  const existing = map[id];
  const now = Date.now();

  let title = customTitle || existing?.title;
  if (!title) {
    const firstUserMsg = messages.find((m) => m.role === "user");
    title = firstUserMsg?.content?.slice(0, 36) || "New Conversation";
    if (firstUserMsg && firstUserMsg.content?.length > 36) title += "…";
  }

  map[id] = {
    id,
    title: title || "Conversation",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    messageCount: messages.length,
    messages,
  };

  setStorageMap(map);
}

export function deleteConversation(id: string): void {
  const map = getStorageMap();
  if (map[id]) {
    delete map[id];
    setStorageMap(map);
  }
}

export function renameConversation(id: string, title: string): void {
  const map = getStorageMap();
  if (map[id]) {
    map[id].title = title.trim();
    map[id].updatedAt = Date.now();
    setStorageMap(map);
  }
}
