/** Coordenadas privadas: el hallazgo original y la custodia son independientes. */
export const up = (pgm) =>
  pgm.sql(`
  ALTER TABLE found_object_private
    ADD COLUMN found_latitude double precision,
    ADD COLUMN found_longitude double precision,
    ADD COLUMN found_accuracy double precision,
    ADD COLUMN custody_latitude double precision,
    ADD COLUMN custody_longitude double precision,
    ADD COLUMN custody_accuracy double precision,
    ADD CONSTRAINT private_found_position CHECK (
      (found_latitude IS NULL AND found_longitude IS NULL AND found_accuracy IS NULL) OR
      (found_latitude IS NOT NULL AND found_longitude IS NOT NULL
       AND found_latitude BETWEEN -90 AND 90 AND found_longitude BETWEEN -180 AND 180
       AND (found_accuracy IS NULL OR found_accuracy BETWEEN 0 AND 40075000))),
    ADD CONSTRAINT private_custody_position CHECK (
      (custody_latitude IS NULL AND custody_longitude IS NULL AND custody_accuracy IS NULL) OR
      (custody_latitude IS NOT NULL AND custody_longitude IS NOT NULL
       AND custody_latitude BETWEEN -90 AND 90 AND custody_longitude BETWEEN -180 AND 180
       AND (custody_accuracy IS NULL OR custody_accuracy BETWEEN 0 AND 40075000)));
`);
export const down = () => {
  throw new Error("Usar el reinicio local documentado.");
};
