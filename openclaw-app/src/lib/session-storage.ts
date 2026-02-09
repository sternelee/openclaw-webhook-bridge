/**
 * Session storage utilities for caching chat sessions in localStorage.
 */

import type { ChatMessage } from '@/types';

export interface SessionMetadata {
  key: string;
  label: string | null;
  messageCount: number;
  updatedAt: number;
  createdAt: number;
}

export interface SessionData {
  metadata: SessionMetadata;
  messages: ChatMessage[];
}

const SESSIONS_LIST_KEY = 'openclaw-sessions-list';
const SESSION_PREFIX = 'openclaw-session-';
const MAX_SESSIONS = 50; // Keep last 50 sessions

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Get all session metadata from localStorage
 */
export function getSessionsList(): SessionMetadata[] {
  if (!isBrowser()) return [];
  
  try {
    const data = localStorage.getItem(SESSIONS_LIST_KEY);
    if (!data) {
      // Initialize with default session
      const defaultSession: SessionMetadata = {
        key: 'main',
        label: 'Default Session',
        messageCount: 0,
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };
      saveSessionsList([defaultSession]);
      return [defaultSession];
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('[SessionStorage] Failed to load sessions list:', error);
    return [];
  }
}

/**
 * Save session metadata list to localStorage
 */
export function saveSessionsList(sessions: SessionMetadata[]): void {
  if (!isBrowser()) return;
  
  try {
    // Sort by updatedAt descending
    const sorted = sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    // Keep only the most recent sessions
    const limited = sorted.slice(0, MAX_SESSIONS);
    localStorage.setItem(SESSIONS_LIST_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('[SessionStorage] Failed to save sessions list:', error);
  }
}

/**
 * Get session data (metadata + messages) from localStorage
 */
export function getSessionData(sessionKey: string): SessionData | null {
  if (!isBrowser()) return null;
  
  try {
    const data = localStorage.getItem(`${SESSION_PREFIX}${sessionKey}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error('[SessionStorage] Failed to load session data:', error);
    return null;
  }
}

/**
 * Save session data (metadata + messages) to localStorage
 */
export function saveSessionData(sessionKey: string, data: SessionData): void {
  if (!isBrowser()) return;
  
  try {
    localStorage.setItem(`${SESSION_PREFIX}${sessionKey}`, JSON.stringify(data));
    
    // Update sessions list
    const sessions = getSessionsList();
    const existingIndex = sessions.findIndex((s) => s.key === sessionKey);
    
    if (existingIndex >= 0) {
      sessions[existingIndex] = data.metadata;
    } else {
      sessions.push(data.metadata);
    }
    
    saveSessionsList(sessions);
  } catch (error) {
    console.error('[SessionStorage] Failed to save session data:', error);
  }
}

/**
 * Delete session data from localStorage
 */
export function deleteSessionData(sessionKey: string): void {
  if (!isBrowser()) return;
  
  try {
    localStorage.removeItem(`${SESSION_PREFIX}${sessionKey}`);
    
    // Remove from sessions list
    const sessions = getSessionsList();
    const filtered = sessions.filter((s) => s.key !== sessionKey);
    saveSessionsList(filtered);
  } catch (error) {
    console.error('[SessionStorage] Failed to delete session data:', error);
  }
}

/**
 * Update session metadata (messageCount, updatedAt)
 */
export function updateSessionMetadata(sessionKey: string, updates: Partial<Omit<SessionMetadata, 'key'>>): void {
  if (!isBrowser()) return;
  
  try {
    const sessions = getSessionsList();
    const index = sessions.findIndex((s) => s.key === sessionKey);
    
    if (index >= 0) {
      sessions[index] = { ...sessions[index], ...updates };
      saveSessionsList(sessions);
    }
  } catch (error) {
    console.error('[SessionStorage] Failed to update session metadata:', error);
  }
}

/**
 * Create a new session
 */
export function createNewSession(): SessionMetadata {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 7);
  const key = `session-${timestamp}-${random}`;
  
  const metadata: SessionMetadata = {
    key,
    label: null,
    messageCount: 0,
    updatedAt: timestamp,
    createdAt: timestamp,
  };
  
  const data: SessionData = {
    metadata,
    messages: [],
  };
  
  saveSessionData(key, data);
  return metadata;
}

/**
 * Clear old sessions (keep last N sessions)
 */
export function cleanupOldSessions(keepCount: number = MAX_SESSIONS): void {
  if (!isBrowser()) return;
  
  try {
    const sessions = getSessionsList();
    if (sessions.length <= keepCount) return;
    
    // Sort by updatedAt descending
    const sorted = sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    const toDelete = sorted.slice(keepCount);
    
    // Delete old sessions
    toDelete.forEach((session) => {
      localStorage.removeItem(`${SESSION_PREFIX}${session.key}`);
    });
    
    // Save updated list
    saveSessionsList(sorted.slice(0, keepCount));
  } catch (error) {
    console.error('[SessionStorage] Failed to cleanup old sessions:', error);
  }
}
