import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { csrfToken, verifyCsrf } from "../auth/security.js";
import { requireAuth } from "../session.js";
import { createFriendsService } from "./service.js";
import { isValidId, messageSchema, searchSchema } from "./validation.js";

function requireApiAuth(req, res, next) {
  if (req.session?.userId) return next();
  return res
    .status(401)
    .json({ error: "Inicia sesión para usar Amigos y Chat." });
}

function verifyApiCsrf(req, res, next) {
  const received = req.body?._csrf;
  const expected = req.session?.csrfToken;
  if (
    typeof received === "string" &&
    typeof expected === "string" &&
    /^[a-f0-9]{64}$/.test(received) &&
    /^[a-f0-9]{64}$/.test(expected) &&
    timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  )
    return next();
  return res
    .status(403)
    .json({ error: "La sesión del formulario caducó. Recarga la página." });
}

function invalidPageId(req, res) {
  return res.status(404).render("error", {
    title: "Conversación no disponible",
    message: "No se ha encontrado esa conversación o ya no sois amigos.",
  });
}

export function createFriendsRouter(pool) {
  const router = Router();
  const friends = createFriendsService(pool);

  router.get("/amigos", requireAuth, async (req, res) => {
    const parsed = searchSchema.safeParse(req.query.q ?? "");
    const query = parsed.success ? parsed.data : "";
    const [lists, results] = await Promise.all([
      friends.list(req.session.userId),
      query.length >= 2 ? friends.search(req.session.userId, query) : [],
    ]);
    res.set("Cache-Control", "no-store");
    return res.status(parsed.success ? 200 : 400).render("friends", {
      title: "Amigos",
      csrf: csrfToken(req),
      query,
      resultado: req.query.resultado,
      searchError: parsed.success
        ? null
        : "Escribe una búsqueda de hasta 100 caracteres.",
      searchResults: results,
      ...lists,
    });
  });

  router.post(
    "/amigos/solicitudes/:userId",
    requireAuth,
    verifyCsrf,
    async (req, res) => {
      if (!isValidId(req.params.userId))
        return res.redirect(303, "/amigos?resultado=no-encontrado");
      try {
        const result = await friends.sendRequest(
          req.session.userId,
          req.params.userId,
        );
        return res.redirect(303, `/amigos?resultado=${result}`);
      } catch (error) {
        if (error.code === "FRIEND_TARGET_NOT_FOUND")
          return res.redirect(303, "/amigos?resultado=no-encontrado");
        if (error.code === "FRIEND_SELF_REQUEST")
          return res.redirect(303, "/amigos?resultado=propia");
        throw error;
      }
    },
  );

  router.post(
    "/amigos/solicitudes/:requestId/aceptar",
    requireAuth,
    verifyCsrf,
    async (req, res) => {
      if (!isValidId(req.params.requestId))
        return res.redirect(303, "/amigos?resultado=no-disponible");
      const accepted = await friends.respond(
        req.params.requestId,
        req.session.userId,
        "accepted",
      );
      return res.redirect(
        303,
        `/amigos?resultado=${accepted ? "aceptada" : "no-disponible"}`,
      );
    },
  );

  router.post(
    "/amigos/solicitudes/:requestId/rechazar",
    requireAuth,
    verifyCsrf,
    async (req, res) => {
      if (!isValidId(req.params.requestId))
        return res.redirect(303, "/amigos?resultado=no-disponible");
      const rejected = await friends.respond(
        req.params.requestId,
        req.session.userId,
        "rejected",
      );
      return res.redirect(
        303,
        `/amigos?resultado=${rejected ? "rechazada" : "no-disponible"}`,
      );
    },
  );

  router.post(
    "/amigos/solicitudes/:requestId/cancelar",
    requireAuth,
    verifyCsrf,
    async (req, res) => {
      if (!isValidId(req.params.requestId))
        return res.redirect(303, "/amigos?resultado=no-disponible");
      const cancelled = await friends.cancel(
        req.params.requestId,
        req.session.userId,
      );
      return res.redirect(
        303,
        `/amigos?resultado=${cancelled ? "cancelada" : "no-disponible"}`,
      );
    },
  );

  router.post(
    "/amigos/:friendId/eliminar",
    requireAuth,
    verifyCsrf,
    async (req, res) => {
      if (!isValidId(req.params.friendId))
        return res.redirect(303, "/amigos?resultado=no-disponible");
      const removed = await friends.remove(
        req.session.userId,
        req.params.friendId,
      );
      return res.redirect(
        303,
        `/amigos?resultado=${removed ? "eliminada" : "no-disponible"}`,
      );
    },
  );

  router.get("/amigos/:friendId/chat", requireAuth, async (req, res) => {
    if (!isValidId(req.params.friendId)) return invalidPageId(req, res);
    const conversation = await friends.getConversation(
      req.session.userId,
      req.params.friendId,
    );
    if (!conversation) return invalidPageId(req, res);
    const messages = await friends.getMessages(conversation.friendship_id);
    res.set("Cache-Control", "no-store");
    return res.render("friends-chat", {
      title: `Chat con @${conversation.username}`,
      csrf: csrfToken(req),
      userId: req.session.userId,
      conversation,
      messages,
    });
  });

  router.get(
    "/api/amigos/:friendId/mensajes",
    requireApiAuth,
    async (req, res) => {
      if (!isValidId(req.params.friendId))
        return res.status(404).json({ error: "Conversación no disponible." });
      const conversation = await friends.getConversation(
        req.session.userId,
        req.params.friendId,
      );
      if (!conversation)
        return res
          .status(404)
          .json({ error: "Conversación no disponible. Debéis ser amigos." });
      const afterId = req.query.after ?? "0";
      if (typeof afterId !== "string" || !/^\d{1,19}$/.test(afterId))
        return res
          .status(400)
          .json({ error: "El cursor de mensajes no es válido." });
      const messages = await friends.getMessages(
        conversation.friendship_id,
        afterId,
      );
      return res.json({ messages });
    },
  );

  router.post(
    "/api/amigos/:friendId/mensajes",
    requireApiAuth,
    verifyApiCsrf,
    async (req, res) => {
      if (!isValidId(req.params.friendId))
        return res.status(404).json({ error: "Conversación no disponible." });
      const parsed = messageSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(422).json({ error: parsed.error.issues[0].message });
      const conversation = await friends.getConversation(
        req.session.userId,
        req.params.friendId,
      );
      if (!conversation)
        return res
          .status(404)
          .json({ error: "Conversación no disponible. Debéis ser amigos." });
      const message = await friends.sendMessage(
        conversation.friendship_id,
        req.session.userId,
        parsed.data.content,
      );
      if (!message)
        return res
          .status(404)
          .json({ error: "Conversación no disponible. Debéis ser amigos." });
      return res.status(201).json({ message });
    },
  );

  return router;
}
