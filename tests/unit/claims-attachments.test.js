import { test, expect } from "vitest";
import sharp from "sharp";
import {
  validateAttachment,
  attachmentPath,
  saveAttachments,
  MAX_BYTES,
} from "../../src/claims/attachments.js";
import { pdf } from "../helpers/claim-fixtures.js";
const file = (f) => ({
  originalname: f.name,
  mimetype: f.type,
  buffer: f.buffer,
});
test("PDF reconocido y nombre saneado", async () => {
  const v = await validateAttachment(
    file({ ...pdf(), name: "../../prueba.pdf" }),
  );
  expect(v.original_name).toBe("prueba.pdf");
  expect(v.mime_type).toBe("application/pdf");
});
for (const format of ["jpeg", "png", "webp"])
  test(`imagen ${format} decodificada y normalizada`, async () => {
    const buffer = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "#775599" },
    })
      [format]()
      .toBuffer();
    const f = await validateAttachment({
      originalname: `x.${format}`,
      mimetype: `image/${format}`,
      buffer,
    });
    expect(f.mime_type).toBe("image/webp");
    expect((await sharp(f.buffer).metadata()).format).toBe("webp");
  });
for (const [name, type, buffer] of [
  ["x.svg", "image/svg+xml", Buffer.from("<svg/>")],
  ["x.png", "image/png", Buffer.from("texto")],
  ["x.pdf", "application/pdf", Buffer.from("texto")],
  ["x.pdf", "text/plain", pdf().buffer],
  ["x.pdf", "application/pdf", Buffer.alloc(MAX_BYTES + 1)],
  ["x.pdf", "application/pdf", Buffer.alloc(0)],
])
  test(`rechaza ${name}/${type}/${buffer.length}`, async () =>
    await expect(
      validateAttachment({ originalname: name, mimetype: type, buffer }),
    ).rejects.toThrow());
test("rutas confinadas y límite de cantidad", async () => {
  expect(() => attachmentPath("../escape", "test")).toThrow();
  expect(() =>
    attachmentPath("12345678-1234-1234-1234-123456789abc", "otro"),
  ).toThrow();
  await expect(saveAttachments([1, 2, 3, 4], "test")).rejects.toThrow("tres");
});
