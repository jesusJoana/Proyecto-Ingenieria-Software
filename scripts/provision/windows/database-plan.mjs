/** Reglas puras del aprovisionamiento; no abren conexiones ni escriben archivos. */
const hex = /^[a-f0-9]{64}$/;
const definitions = [
  ["development", "dev", 3000],
  ["test", "test", 3002],
  ["e2e", "e2e", 3001],
];
export function buildEnvironments(secrets) {
  const values = definitions.flatMap(([mode, suffix]) => [
    secrets[suffix],
    secrets["session-" + mode],
  ]);
  if (
    values.some((v) => typeof v !== "string" || !hex.test(v)) ||
    new Set(values).size !== 6
  )
    throw new Error("Secretos locales invalidos o repetidos.");
  return definitions.map(([mode, suffix, port]) => ({
    mode,
    suffix,
    port,
    role: `refind_${suffix}_user`,
    database: `refind_${suffix}`,
    secret: secrets["session-" + mode],
    password: secrets[suffix],
    url: `postgresql://refind_${suffix}_user:${secrets[suffix]}@127.0.0.1:5433/refind_${suffix}`,
  }));
}
export function assertInstance(row, expectedDirectory) {
  const normalize = (p) =>
    p.replaceAll("\\", "/").replace(/\/$/, "").toLowerCase();
  if (
    row.version !== "170011" ||
    Number(row.port) !== 5433 ||
    row.cluster !== "refind-local" ||
    normalize(row.data) !== normalize(expectedDirectory)
  )
    throw new Error("Instancia PostgreSQL ajena o version incorrecta.");
}
export function roleStatements(role, password) {
  if (!/^refind_(dev|test|e2e)_user$/.test(role) || !hex.test(password))
    throw new Error("Rol o secreto no permitido.");
  return `CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`;
}
