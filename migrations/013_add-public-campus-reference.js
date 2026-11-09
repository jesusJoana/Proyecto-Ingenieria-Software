/** Referencia pública aproximada, separada de la ubicación exacta privada. */
export const up = (pgm) =>
  pgm.sql(`
  ALTER TABLE found_objects
    ADD COLUMN campus_latitude numeric(5,2),
    ADD COLUMN campus_longitude numeric(5,2),
    ADD CONSTRAINT found_objects_campus_reference CHECK (
      (campus_latitude IS NULL AND campus_longitude IS NULL) OR
      (campus_latitude IS NOT NULL AND campus_longitude IS NOT NULL
       AND campus_latitude BETWEEN -85 AND 85 AND campus_longitude BETWEEN -180 AND 180)
    );
  CREATE OR REPLACE VIEW public_found_objects AS
    SELECT f.id, f.category, f.object_type, f.university, f.campus, f.general_area,
      f.found_from, f.found_until, f.status, f.created_at,
      f.object_type || ' encontrado en ' || f.campus AS title,
      u.username AS author_username, f.campus_latitude, f.campus_longitude
    FROM found_objects f JOIN users u ON u.id=f.author_id
    WHERE f.status IN ('available','reserved');
`);
export const down = () => {
  throw new Error("Usar el reinicio local documentado.");
};
