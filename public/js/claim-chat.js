/* Sondeo privado sin reemplazar el formulario ni perder su borrador. */
(() => {
  const root = document.querySelector("[data-claim-chat]");
  if (!root || root.dataset.older === "1") return;
  const id = root.dataset.claimId,
    list = root.querySelector("[data-messages]"),
    notice = root.querySelector("[data-chat-notice]");
  let after = root.dataset.after,
    busy = false;
  function append(m) {
    if (list.querySelector(`[data-message-id="${m.id}"]`)) return;
    const article = document.createElement("article");
    article.dataset.messageId = m.id;
    article.className = "auth-panel p-3 my-2";
    const author = document.createElement("p");
    author.textContent = `@${m.sender_username} · ${new Date(m.created_at).toLocaleString("es-ES")}`;
    const body = document.createElement("p");
    body.className = "text-break";
    body.style.whiteSpace = "pre-wrap";
    body.textContent = m.body;
    article.append(author, body);
    const ul = document.createElement("ul");
    for (const f of m.files) {
      const li = document.createElement("li"),
        a = document.createElement("a");
      a.href = `/reclamaciones/${id}/archivos/${f.storage_key}`;
      a.textContent = f.original_name;
      a.className = "text-break";
      li.append(a);
      ul.append(li);
    }
    article.append(ul);
    list.append(article);
  }
  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      let more;
      do {
        const response = await fetch(
          `/reclamaciones/${id}/mensajes.json?after=${after}`,
          { headers: { Accept: "application/json" }, cache: "no-store" },
        );
        if (
          !response.ok ||
          !response.headers.get("content-type")?.includes("application/json")
        )
          throw new Error();
        const result = await response.json();
        for (const m of result.messages) {
          append(m);
          after = m.id;
        }
        more = result.more && result.messages.length > 0;
        notice.textContent = result.writable
          ? ""
          : "La conversación está cerrada y solo permite consulta.";
        if (!result.writable) {
          const form = root.querySelector("[data-message-form]");
          if (form)
            for (const control of form.elements) control.disabled = true;
        }
      } while (more && !document.hidden);
    } catch {
      notice.textContent =
        "No se han podido actualizar los mensajes. Se volverá a intentar; tu borrador se conserva.";
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(refresh, 5000);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("pagehide", () => clearInterval(timer));
})();
