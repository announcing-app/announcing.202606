-- Migration number: 0000 	 2026-07-04
-- Global control layer (D1, primary in EU / weur).
--
-- Personal data is minimal by design: users carry only the immutable Google
-- subject and a user-chosen display name — no email, no legal name, no photo.
-- Membership rows are a dashboard index; the per-channel source of truth for
-- roles lives in the ChannelDO (apps/backend).

CREATE TABLE users (
	id TEXT PRIMARY KEY,
	google_sub TEXT NOT NULL UNIQUE,
	display_name TEXT NOT NULL,
	created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE sessions (
	-- sha256(token) — the raw bearer token never touches the database.
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	expires_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);

CREATE TABLE channels (
	-- The uniqueness point for {subdomain}.announcing.app.
	subdomain TEXT PRIMARY KEY,
	channel_id TEXT NOT NULL UNIQUE,
	region TEXT NOT NULL,
	owner_user_id TEXT NOT NULL REFERENCES users(id),
	created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE memberships (
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	channel_id TEXT NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
	created_at INTEGER NOT NULL,
	PRIMARY KEY (user_id, channel_id)
) STRICT;
CREATE INDEX memberships_channel_id ON memberships(channel_id);
