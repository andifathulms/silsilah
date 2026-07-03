"use client";

import { getToken } from "./auth";
import type {
  ChangeLogEntry,
  Invitation,
  InvitePreview,
  LifeEvent,
  MediaItem,
  Membership,
  Person,
  PublicShare,
  Relationship,
  Relatives,
  ShareLink,
  Tree,
  User,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

/** The server serves media at the site root (e.g. /media/...), not under
 * /api — resolve a returned relative image path against the API origin. */
export function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  const origin = API_BASE.replace(/\/api\/?$/, "");
  return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** Public share endpoint lives at the API origin but outside /trees. */
export function fetchPublicShare(token: string): Promise<PublicShare> {
  return fetch(`${API_BASE}/share/${token}/`).then(async (res) => {
    if (!res.ok) throw new Error(`Share not found (${res.status})`);
    return res.json();
  });
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Token ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      (data && (data.detail || JSON.stringify(data))) ||
      `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

function unwrap<T>(data: Paginated<T> | T[]): T[] {
  if (Array.isArray(data)) return data;
  return data.results;
}

// --- Auth -----------------------------------------------------------------
export const api = {
  register: (body: {
    username: string;
    email: string;
    password: string;
  }) =>
    request<{ token: string; user: User }>("/auth/register/", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { username: string; password: string }) =>
    request<{ token: string; user: User }>("/auth/login/", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  me: () => request<User>("/auth/me/"),

  logout: () => request<void>("/auth/logout/", { method: "POST" }),

  // --- Trees --------------------------------------------------------------
  listTrees: () =>
    request<Paginated<Tree> | Tree[]>("/trees/").then(unwrap),

  getTree: (treeId: number) => request<Tree>(`/trees/${treeId}/`),

  createTree: (name: string) =>
    request<Tree>("/trees/", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  updateTree: (treeId: number, body: Partial<Tree>) =>
    request<Tree>(`/trees/${treeId}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteTree: (treeId: number) =>
    request<void>(`/trees/${treeId}/`, { method: "DELETE" }),

  listMembers: (treeId: number) =>
    request<Membership[]>(`/trees/${treeId}/members/`),

  invite: (treeId: number, email: string, role: "editor" | "viewer") =>
    request<Membership>(`/trees/${treeId}/invite/`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),

  // --- Invite links -------------------------------------------------------
  listInvitations: (treeId: number) =>
    request<Invitation[]>(`/trees/${treeId}/invitations/`),

  createInvitation: (treeId: number, role: "editor" | "viewer") =>
    request<Invitation>(`/trees/${treeId}/invitations/`, {
      method: "POST",
      body: JSON.stringify({ role }),
    }),

  deleteInvitation: (treeId: number, id: number) =>
    request<void>(`/trees/${treeId}/invitations/${id}/`, { method: "DELETE" }),

  previewInvitation: (token: string) =>
    request<InvitePreview>(`/invitations/${token}/`),

  acceptInvitation: (token: string) =>
    request<{ tree: number; role: string }>(`/invitations/${token}/accept/`, {
      method: "POST",
    }),

  // --- People -------------------------------------------------------------
  listPeople: (treeId: number, includeArchived = false) =>
    request<Paginated<Person> | Person[]>(
      `/trees/${treeId}/people/${includeArchived ? "?include_archived=1" : ""}`
    ).then(unwrap),

  getPerson: (treeId: number, personId: number) =>
    request<Person>(`/trees/${treeId}/people/${personId}/`),

  createPerson: (treeId: number, body: Partial<Person>) =>
    request<Person>(`/trees/${treeId}/people/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updatePerson: (treeId: number, personId: number, body: Partial<Person>) =>
    request<Person>(`/trees/${treeId}/people/${personId}/`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  archivePerson: (treeId: number, personId: number) =>
    request<Person>(`/trees/${treeId}/people/${personId}/archive/`, {
      method: "POST",
    }),

  getRelatives: (treeId: number, personId: number) =>
    request<Relatives>(`/trees/${treeId}/people/${personId}/relatives/`),

  getChangelog: (treeId: number, personId: number) =>
    request<ChangeLogEntry[]>(
      `/trees/${treeId}/people/${personId}/changelog/`
    ),

  getRelationship: (treeId: number, personId: number, otherId: number) =>
    request<{ label: string; sentence: string; other_name: string }>(
      `/trees/${treeId}/people/${personId}/relationship-to/${otherId}/`
    ),

  // --- Relationships ------------------------------------------------------
  listRelationships: (treeId: number) =>
    request<Paginated<Relationship> | Relationship[]>(
      `/trees/${treeId}/relationships/`
    ).then(unwrap),

  createRelationship: (treeId: number, body: Partial<Relationship>) =>
    request<Relationship>(`/trees/${treeId}/relationships/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteRelationship: (treeId: number, relId: number) =>
    request<void>(`/trees/${treeId}/relationships/${relId}/`, {
      method: "DELETE",
    }),

  // --- Media (per-person / life-event photos) -----------------------------
  listMedia: (treeId: number, personId: number) =>
    request<Paginated<MediaItem> | MediaItem[]>(
      `/trees/${treeId}/people/${personId}/media/`
    ).then(unwrap),

  uploadMedia: (
    treeId: number,
    personId: number,
    file: File,
    caption: string,
    eventDate: string
  ) => {
    const form = new FormData();
    form.append("image", file);
    if (caption) form.append("caption", caption);
    if (eventDate) form.append("event_date", eventDate);
    return request<MediaItem>(`/trees/${treeId}/people/${personId}/media/`, {
      method: "POST",
      body: form,
    });
  },

  deleteMedia: (treeId: number, personId: number, mediaId: number) =>
    request<void>(`/trees/${treeId}/people/${personId}/media/${mediaId}/`, {
      method: "DELETE",
    }),

  // --- Life events (timeline) ---------------------------------------------
  listEvents: (treeId: number, personId: number) =>
    request<Paginated<LifeEvent> | LifeEvent[]>(
      `/trees/${treeId}/people/${personId}/events/`
    ).then(unwrap),

  createEvent: (treeId: number, personId: number, body: Partial<LifeEvent>) =>
    request<LifeEvent>(`/trees/${treeId}/people/${personId}/events/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteEvent: (treeId: number, personId: number, eventId: number) =>
    request<void>(`/trees/${treeId}/people/${personId}/events/${eventId}/`, {
      method: "DELETE",
    }),

  // --- Share links --------------------------------------------------------
  listShareLinks: (treeId: number) =>
    request<Paginated<ShareLink> | ShareLink[]>(
      `/trees/${treeId}/share-links/`
    ).then(unwrap),

  createShareLink: (
    treeId: number,
    body: { root_person?: number | null; include_ancestors?: boolean }
  ) =>
    request<ShareLink>(`/trees/${treeId}/share-links/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteShareLink: (treeId: number, id: number) =>
    request<void>(`/trees/${treeId}/share-links/${id}/`, {
      method: "DELETE",
    }),
};
