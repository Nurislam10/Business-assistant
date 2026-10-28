-- PostgreSQL direction for production MVP
CREATE TABLE users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text UNIQUE,
  role text NOT NULL CHECK (role IN ('OWNER','MANAGER','MEMBER')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  owner_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'NEW',
  priority text NOT NULL DEFAULT 'MEDIUM',
  assignee_id uuid REFERENCES users(id),
  project_id uuid REFERENCES projects(id),
  due_at timestamptz,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE decisions (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  context text,
  status text NOT NULL DEFAULT 'OPEN',
  owner_id uuid REFERENCES users(id),
  project_id uuid REFERENCES projects(id),
  due_at timestamptz,
  decision_text text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE internal_comments (
  id uuid PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  author_id uuid REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inbox_threads (
  id uuid PRIMARY KEY,
  channel text NOT NULL,
  external_thread_id text NOT NULL,
  display_name text,
  assigned_to uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel, external_thread_id)
);

CREATE TABLE external_messages (
  id uuid PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES inbox_threads(id),
  external_message_id text NOT NULL UNIQUE,
  direction text NOT NULL CHECK (direction IN ('INBOUND','OUTBOUND')),
  message_type text NOT NULL,
  body text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
