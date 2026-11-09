export const validClaim = (changes = {}) => ({
  description: "Mochila de tela con asa ancha",
  distinguishing_details: "Bolsillo interior con una costura roja",
  lost_location: "Biblioteca sala primera",
  date_unknown: "1",
  lost_from: "",
  lost_until: "",
  additional_information: "",
  ...changes,
});
export function claimSubmit(
  person,
  url,
  values = validClaim(),
  files = [],
  csrf = person.csrf,
) {
  let req = person.agent.post(url);
  if (csrf) req = req.field("_csrf", csrf);
  for (const [k, v] of Object.entries(values))
    if (v !== undefined) req = req.field(k, String(v));
  for (const f of files)
    req = req.attach("attachments", f.buffer, {
      filename: f.name,
      contentType: f.type,
    });
  return req;
}
export const pdf = () => ({
  name: "prueba.pdf",
  type: "application/pdf",
  buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF"),
});
