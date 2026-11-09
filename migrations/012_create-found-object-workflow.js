/** Modelo I04. La aplicación adopta estas tablas en I05–I08. */
export const up = (pgm) =>
  pgm.sql(`
CREATE TABLE found_objects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id bigint NOT NULL REFERENCES users(id),
  category text NOT NULL CHECK (btrim(category) <> ''),
  object_type text NOT NULL CHECK (btrim(object_type) <> ''),
  university text NOT NULL CHECK (btrim(university) <> ''),
  campus text NOT NULL CHECK (btrim(campus) <> ''),
  general_area text NOT NULL CHECK (btrim(general_area) <> ''),
  found_from date NOT NULL,
  found_until date NOT NULL CHECK (found_until >= found_from),
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available','reserved','returned','withdrawn')),
  withdrawal_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, author_id),
  CHECK (status <> 'withdrawn' OR
    (withdrawal_reason IS NOT NULL AND btrim(withdrawal_reason) <> ''))
);
CREATE INDEX found_objects_search_idx ON found_objects(status, category, university, campus);
CREATE INDEX found_objects_author_idx ON found_objects(author_id, created_at DESC);

CREATE TABLE found_object_private (
  object_id bigint PRIMARY KEY REFERENCES found_objects(id),
  distinguishing_details text NOT NULL CHECK (btrim(distinguishing_details) <> ''),
  exact_location text,
  deposit_location text,
  photo_key uuid
);
CREATE TABLE found_object_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  object_id bigint NOT NULL REFERENCES found_objects(id),
  version integer NOT NULL CHECK (version > 0),
  public_data jsonb NOT NULL CHECK (jsonb_typeof(public_data) = 'object'),
  private_data jsonb NOT NULL CHECK (jsonb_typeof(private_data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(object_id, version)
);

CREATE TABLE claims (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  object_id bigint NOT NULL,
  author_id bigint NOT NULL,
  claimant_id bigint NOT NULL REFERENCES users(id),
  description text NOT NULL CHECK (btrim(description) <> ''),
  distinguishing_details text NOT NULL CHECK (btrim(distinguishing_details) <> ''),
  lost_location text NOT NULL CHECK (btrim(lost_location) <> ''),
  date_unknown boolean NOT NULL,
  lost_from date,
  lost_until date,
  additional_information text,
  previous_claim_id bigint,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('pending','waiting','accepted','completed','rejected','cancelled','closed_withdrawn','closed_delivered')),
  decision_reason text,
  author_confirmed_at timestamptz,
  claimant_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(object_id,author_id) REFERENCES found_objects(id,author_id),
  UNIQUE(id,object_id,claimant_id),
  UNIQUE(id,object_id),
  FOREIGN KEY(previous_claim_id,object_id,claimant_id) REFERENCES claims(id,object_id,claimant_id),
  CHECK (author_id <> claimant_id),
  CHECK ((date_unknown AND lost_from IS NULL AND lost_until IS NULL) OR
    (NOT date_unknown AND lost_from IS NOT NULL AND lost_until IS NOT NULL AND lost_until >= lost_from)),
  CHECK (previous_claim_id IS NULL OR (previous_claim_id <> id AND
    additional_information IS NOT NULL AND btrim(additional_information) <> '')),
  CHECK (status NOT IN ('rejected','cancelled') OR
    (decision_reason IS NOT NULL AND btrim(decision_reason) <> '')),
  CHECK ((status = 'completed' AND author_confirmed_at IS NOT NULL AND claimant_confirmed_at IS NOT NULL)
    OR (status = 'accepted' AND (author_confirmed_at IS NULL OR claimant_confirmed_at IS NULL))
    OR (status NOT IN ('completed','accepted') AND author_confirmed_at IS NULL AND claimant_confirmed_at IS NULL))
);
CREATE UNIQUE INDEX claims_one_active_per_person ON claims(object_id,claimant_id)
  WHERE status IN ('pending','waiting','accepted');
CREATE UNIQUE INDEX claims_one_recipient ON claims(object_id) WHERE status IN ('accepted','completed');
CREATE INDEX claims_person_idx ON claims(claimant_id,created_at DESC);
CREATE INDEX claims_object_idx ON claims(object_id,status);

CREATE TABLE claim_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id bigint NOT NULL REFERENCES claims(id),
  storage_key uuid NOT NULL UNIQUE,
  original_name text NOT NULL CHECK (btrim(original_name) <> ''),
  mime_type text NOT NULL CHECK (btrim(mime_type) <> ''),
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_evidence_claim_idx ON claim_evidence(claim_id);
CREATE TABLE claim_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id bigint NOT NULL REFERENCES claims(id),
  sender_id bigint NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (btrim(body) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX claim_messages_claim_idx ON claim_messages(claim_id,id);
CREATE TABLE claim_message_files (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id bigint NOT NULL REFERENCES claim_messages(id),
  storage_key uuid NOT NULL UNIQUE,
  original_name text NOT NULL CHECK (btrim(original_name) <> ''),
  mime_type text NOT NULL CHECK (btrim(mime_type) <> ''),
  byte_size bigint NOT NULL CHECK (byte_size > 0)
);
CREATE INDEX claim_message_files_message_idx ON claim_message_files(message_id);
CREATE TABLE claim_incidents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  claim_id bigint NOT NULL REFERENCES claims(id),
  opened_by bigint NOT NULL REFERENCES users(id),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  author_agreed_at timestamptz,
  claimant_agreed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (resolved_at IS NULL OR (author_agreed_at IS NOT NULL AND claimant_agreed_at IS NOT NULL))
);
CREATE INDEX claim_incidents_claim_idx ON claim_incidents(claim_id);
CREATE TABLE activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  object_id bigint NOT NULL REFERENCES found_objects(id),
  claim_id bigint,
  actor_id bigint NOT NULL REFERENCES users(id),
  action text NOT NULL CHECK (btrim(action) <> ''),
  details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(claim_id,object_id) REFERENCES claims(id,object_id)
);
CREATE INDEX activity_events_object_idx ON activity_events(object_id,id);
CREATE TABLE notifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id bigint NOT NULL REFERENCES users(id),
  event_id bigint NOT NULL REFERENCES activity_events(id),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recipient_id,event_id)
);
CREATE INDEX notifications_inbox_idx ON notifications(recipient_id,created_at DESC);
CREATE TABLE wall_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_id bigint NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (btrim(body) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wall_messages_recent_idx ON wall_messages(created_at DESC,id DESC);

CREATE VIEW public_found_objects AS
  SELECT f.id, f.category, f.object_type, f.university, f.campus, f.general_area,
    f.found_from, f.found_until, f.status, f.created_at,
    f.object_type || ' encontrado en ' || f.campus AS title,
    u.username AS author_username
  FROM found_objects f JOIN users u ON u.id=f.author_id
  WHERE f.status IN ('available','reserved');

CREATE FUNCTION validate_claim_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_status text; previous claims;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.object_id,NEW.author_id,NEW.claimant_id,NEW.previous_claim_id) IS DISTINCT FROM
       (OLD.object_id,OLD.author_id,OLD.claimant_id,OLD.previous_claim_id) THEN
      RAISE EXCEPTION 'Participantes y antecedente inmutables' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT status INTO current_status FROM found_objects WHERE id=NEW.object_id FOR UPDATE;
  IF current_status IS DISTINCT FROM 'available' OR NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'La reclamación requiere un hallazgo disponible' USING ERRCODE='23514';
  END IF;
  SELECT * INTO previous FROM claims WHERE object_id=NEW.object_id AND claimant_id=NEW.claimant_id
    ORDER BY id DESC LIMIT 1;
  IF previous.id IS NOT NULL THEN
    IF previous.status NOT IN ('rejected','cancelled') OR NEW.previous_claim_id IS DISTINCT FROM previous.id THEN
      RAISE EXCEPTION 'Repetición sin antecedente válido' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.previous_claim_id IS NOT NULL THEN
    RAISE EXCEPTION 'Antecedente inexistente' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER claims_identity BEFORE INSERT OR UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION validate_claim_identity();

CREATE FUNCTION preserve_found_author() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.author_id <> OLD.author_id THEN
    RAISE EXCEPTION 'Autor inmutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER found_author BEFORE UPDATE ON found_objects
  FOR EACH ROW EXECUTE FUNCTION preserve_found_author();

CREATE FUNCTION check_found_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE oid bigint; s text; accepted integer; completed integer; waiting integer; active integer;
BEGIN
  IF TG_TABLE_NAME='found_objects' THEN oid:=COALESCE(NEW.id,OLD.id);
  ELSE oid:=COALESCE(NEW.object_id,OLD.object_id); END IF;
  SELECT status INTO s FROM found_objects WHERE id=oid FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM found_object_private WHERE object_id=oid) THEN
    RAISE EXCEPTION 'Faltan detalles privados del hallazgo' USING ERRCODE='23514';
  END IF;
  SELECT count(*) FILTER(WHERE status='accepted'),count(*) FILTER(WHERE status='completed'),
    count(*) FILTER(WHERE status='waiting'),count(*) FILTER(WHERE status IN ('pending','waiting','accepted'))
    INTO accepted,completed,waiting,active FROM claims WHERE object_id=oid;
  IF (s='available' AND (accepted<>0 OR completed<>0 OR waiting<>0)) OR
     (s='reserved' AND (accepted<>1 OR completed<>0 OR active<>waiting+accepted)) OR
     (s='returned' AND (completed<>1 OR active<>0)) OR
     (s='withdrawn' AND (active<>0 OR completed<>0)) THEN
    RAISE EXCEPTION 'Estados de hallazgo y reclamaciones incompatibles' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER found_workflow AFTER INSERT OR UPDATE OR DELETE ON found_objects
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_found_workflow();
CREATE CONSTRAINT TRIGGER claims_workflow AFTER INSERT OR UPDATE OR DELETE ON claims
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_found_workflow();
CREATE CONSTRAINT TRIGGER private_workflow AFTER INSERT OR UPDATE OR DELETE ON found_object_private
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_found_workflow();

CREATE FUNCTION check_claim_content() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c claims; cid bigint;
BEGIN
  IF TG_TABLE_NAME='claim_message_files' THEN
    SELECT claim_id INTO cid FROM claim_messages WHERE id=NEW.message_id;
  ELSE cid:=NEW.claim_id; END IF;
  SELECT * INTO c FROM claims WHERE id=cid FOR UPDATE;
  IF NOT FOUND OR c.status NOT IN ('pending','waiting','accepted') THEN
    RAISE EXCEPTION 'Conversación cerrada o inexistente' USING ERRCODE='23514';
  END IF;
  IF TG_TABLE_NAME='claim_messages' THEN
    IF NEW.sender_id NOT IN (c.author_id,c.claimant_id) THEN
      RAISE EXCEPTION 'Emisor ajeno a la reclamación' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='claim_incidents' THEN
    IF NEW.opened_by NOT IN (c.author_id,c.claimant_id) OR c.status<>'accepted'
       OR (c.author_confirmed_at IS NULL AND c.claimant_confirmed_at IS NULL) THEN
      RAISE EXCEPTION 'Incidencia sin participante o confirmación' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER messages_participant BEFORE INSERT ON claim_messages
  FOR EACH ROW EXECUTE FUNCTION check_claim_content();
CREATE TRIGGER evidence_open BEFORE INSERT ON claim_evidence
  FOR EACH ROW EXECUTE FUNCTION check_claim_content();
CREATE TRIGGER message_files_open BEFORE INSERT ON claim_message_files
  FOR EACH ROW EXECUTE FUNCTION check_claim_content();
CREATE TRIGGER incidents_participant BEFORE INSERT ON claim_incidents
  FOR EACH ROW EXECUTE FUNCTION check_claim_content();
`);

// Las reconstrucciones de desarrollo aplican siempre up desde cero.
export const down = () => {
  throw new Error("Migración histórica: usar el reinicio local documentado.");
};
