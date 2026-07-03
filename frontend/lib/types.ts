export type Role = "owner" | "editor" | "viewer" | null;

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface Tree {
  id: number;
  name: string;
  owner: number;
  is_public_link_enabled: boolean;
  created_at: string;
  my_role: Role;
  member_count: number;
}

export interface Person {
  id: number;
  tree: number;
  name: string;
  gender: string;
  birth_date: string | null;
  death_date: string | null;
  is_living: boolean;
  photo: string | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  _private_redacted?: boolean;
}

export type RelationshipType = "parent_child" | "spouse";

export interface Relationship {
  id: number;
  tree: number;
  type: RelationshipType;
  person_a: number;
  person_b: number;
  start_date: string | null;
  end_date: string | null;
  is_biological: boolean;
}

export interface Relatives {
  parents: Person[];
  children: Person[];
  spouses: Person[];
  siblings_full: Person[];
  siblings_half: Person[];
  grandparents: Person[];
}

export interface ChangeLogEntry {
  id: number;
  person: number;
  changed_by: number | null;
  changed_by_username: string | null;
  changed_at: string;
  diff: Record<string, [unknown, unknown]>;
}

export interface Membership {
  id: number;
  user: number;
  username: string;
  email: string;
  role: Role;
}

export interface MediaItem {
  id: number;
  person: number;
  image: string;
  caption: string;
  event_date: string | null;
  created_at: string;
}

export interface ShareLink {
  id: number;
  token: string;
  root_person: number | null;
  root_person_name: string | null;
  include_ancestors: boolean;
  scope: "branch" | "whole_tree";
  created_at: string;
}

export interface PublicPerson extends Person {
  media: MediaItem[];
}

export interface PublicShare {
  tree: { id: number; name: string };
  scope: "branch" | "whole_tree";
  root_person: number | null;
  people: PublicPerson[];
  relationships: Relationship[];
}
