export const PUBLIC_POST_FIELDS = [
  "id",
  "category",
  "object_type",
  "university",
  "campus",
  "general_area",
  "found_from",
  "found_until",
  "status",
  "created_at",
  "title",
  "author_username",
  "campus_latitude",
  "campus_longitude",
];
export function publicPost(row) {
  return Object.fromEntries(
    PUBLIC_POST_FIELDS.map((key) => [key, row[key] ?? null]),
  );
}
