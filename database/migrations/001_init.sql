-- IGMG Mescid app: basisschema fase 1.
-- Alle technische tijdstempels zijn UTC (timestamptz). Roostertijden zijn lokale kloktijden
-- in de tijdzone van de moskee, met een expliciete dagverschuiving.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
  is_demo     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE regions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id),
  name             text NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE mosques (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id),
  region_id        uuid,
  -- Slug is een wijzigbaar presentatieveld; de interne ID blijft stabiel.
  slug             text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  name             text NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
  city             text NOT NULL CHECK (length(city) BETWEEN 1 AND 120),
  address          text NOT NULL DEFAULT '' CHECK (length(address) <= 300),
  postal_code      text NOT NULL DEFAULT '' CHECK (length(postal_code) <= 20),
  timezone         text NOT NULL,
  is_demo          boolean NOT NULL DEFAULT false,
  -- Alleen 'public' moskeeën zijn zichtbaar voor bezoekers.
  visibility       text NOT NULL DEFAULT 'hidden' CHECK (visibility IN ('hidden', 'public', 'archived')),
  version          integer NOT NULL DEFAULT 1,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  -- Een regio moet bij dezelfde organisatie horen (geen verwijzing over organisaties heen).
  FOREIGN KEY (organization_id, region_id) REFERENCES regions (organization_id, id)
);
CREATE INDEX mosques_org_idx ON mosques (organization_id);
CREATE INDEX mosques_search_idx ON mosques (lower(name), lower(city));

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE CHECK (email = lower(email) AND position('@' in email) > 1),
  display_name   text NOT NULL,
  password_hash  text NOT NULL,
  disabled_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Rollen met een afgebakende scope. Rechten worden altijd server-side gecontroleerd.
CREATE TABLE role_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('platform_admin', 'org_admin', 'region_admin', 'mosque_admin', 'editor', 'publisher')),
  scope_type   text NOT NULL CHECK (scope_type IN ('platform', 'organization', 'region', 'mosque')),
  scope_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK ((scope_type = 'platform') = (scope_id IS NULL)),
  CHECK (
    (role = 'platform_admin' AND scope_type = 'platform') OR
    (role = 'org_admin' AND scope_type = 'organization') OR
    (role = 'region_admin' AND scope_type = 'region') OR
    (role IN ('mosque_admin', 'editor', 'publisher') AND scope_type IN ('organization', 'region', 'mosque'))
  ),
  UNIQUE NULLS NOT DISTINCT (user_id, role, scope_type, scope_id)
);
CREATE INDEX role_assignments_user_idx ON role_assignments (user_id);

CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Alleen de hash van het sessietoken wordt bewaard.
  token_hash   bytea NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

CREATE TABLE login_attempts (
  id          bigserial PRIMARY KEY,
  email       text NOT NULL,
  success     boolean NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_at_idx ON login_attempts (email, at);

-- Waar de tijden vandaan komen (handmatig, Diyanet, later CSV).
CREATE TABLE prayer_sources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id   uuid NOT NULL REFERENCES mosques(id),
  kind        text NOT NULL CHECK (kind IN ('manual', 'diyanet', 'csv')),
  label       text NOT NULL,
  -- Bijvoorbeeld de Diyanet-plaats-ID. Nooit inloggegevens.
  reference   text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mosque_id, id)
);

-- Een roosterversie is concept, gepubliceerd, vervangen of verworpen.
-- Opslaan is niet hetzelfde als publiceren.
CREATE TABLE schedule_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosque_id      uuid NOT NULL REFERENCES mosques(id),
  source_id      uuid NOT NULL,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'superseded', 'discarded')),
  from_date      date NOT NULL,
  to_date        date NOT NULL,
  note           text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  published_by   uuid REFERENCES users(id),
  published_at   timestamptz,
  -- Volgnummer van publicatie: hogere nummers winnen bij overlappende periodes.
  publish_seq    bigint,
  version        integer NOT NULL DEFAULT 1,
  CHECK (from_date <= to_date AND to_date - from_date <= 400),
  CHECK ((status IN ('published', 'superseded')) = (published_at IS NOT NULL)),
  -- De bron moet bij dezelfde moskee horen.
  FOREIGN KEY (mosque_id, source_id) REFERENCES prayer_sources (mosque_id, id),
  UNIQUE (mosque_id, id)
);
CREATE INDEX schedule_versions_mosque_idx ON schedule_versions (mosque_id, status);
CREATE SEQUENCE publish_seq;

CREATE TABLE prayer_days (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id     uuid NOT NULL REFERENCES schedule_versions(id) ON DELETE CASCADE,
  date           date NOT NULL,
  -- Alle velden: lokale "HH:MM" plus dagverschuiving 0/1. Imsak en iqama zijn optioneel.
  times          jsonb NOT NULL,
  UNIQUE (version_id, date)
);

CREATE TABLE audit_events (
  id               bigserial PRIMARY KEY,
  at               timestamptz NOT NULL DEFAULT now(),
  actor_user_id    uuid REFERENCES users(id),
  action           text NOT NULL,
  entity_type      text NOT NULL,
  entity_id        text,
  organization_id  uuid REFERENCES organizations(id),
  mosque_id        uuid REFERENCES mosques(id),
  -- Nooit wachtwoorden, tokens of andere geheimen opslaan.
  details          jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_events_org_idx ON audit_events (organization_id, at DESC);
