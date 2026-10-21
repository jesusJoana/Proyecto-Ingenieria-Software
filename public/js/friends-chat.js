const panel = document.querySelector("[data-chat]");

if (panel) {
  const friendId = panel.dataset.friendId;
  const userId = panel.dataset.userId;
  const csrf = panel.dataset.csrf;
  const messages = panel.querySelector("[data-messages]");
  const form = panel.querySelector("[data-compose]");
  const input = form.querySelector("textarea");
  const sendButton = form.querySelector('button[type="submit"]');
  const status = panel.querySelector("[data-status]");
  let lastId =
    messages.querySelector("[data-message-id]")?.dataset.messageId ?? "0";
  let polling = false;

  function scrollToLatest() {
    messages.scrollTop = messages.scrollHeight;
  }

  function appendMessage(message) {
    panel.querySelector("[data-empty]")?.remove();
    const item = document.createElement("li");
    item.className = `chat-message${String(message.sender_id) === userId ? " chat-message-mine" : ""}`;
    item.dataset.messageId = message.id;

    const content = document.createElement("p");
    content.textContent = message.content;
    const time = document.createElement("time");
    time.dateTime = message.created_at;
    time.textContent = new Date(message.created_at).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });
    item.append(content, time);
    messages.append(item);
    lastId = String(message.id);
    scrollToLatest();
  }

  async function pollMessages() {
    if (polling) return;
    polling = true;
    try {
      const response = await fetch(
        `/api/amigos/${encodeURIComponent(friendId)}/mensajes?after=${encodeURIComponent(lastId)}`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) {
        status.textContent =
          result.error || "No se pudo actualizar la conversación.";
        if (response.status === 404 || response.status === 401) {
          input.disabled = true;
          sendButton.disabled = true;
          window.clearInterval(pollingTimer);
        }
        return;
      }
      result.messages.forEach(appendMessage);
    } catch {
      status.textContent =
        "No se pudo actualizar el chat. Se volverá a intentar.";
    } finally {
      polling = false;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    const content = input.value.trim();
    if (!content) {
      status.textContent = "Escribe un mensaje antes de enviarlo.";
      input.focus();
      return;
    }
    sendButton.disabled = true;
    try {
      const response = await fetch(
        `/api/amigos/${encodeURIComponent(friendId)}/mensajes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            Accept: "application/json",
          },
          body: new URLSearchParams({ content, _csrf: csrf }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        status.textContent = result.error || "No se pudo enviar el mensaje.";
        if (response.status === 404 || response.status === 401)
          input.disabled = true;
        return;
      }
      appendMessage(result.message);
      form.reset();
      input.focus();
    } catch {
      status.textContent =
        "No se pudo enviar el mensaje. Comprueba tu conexión.";
    } finally {
      sendButton.disabled = input.disabled;
    }
  });

  const pollingTimer = window.setInterval(pollMessages, 3000);
  scrollToLatest();
}
