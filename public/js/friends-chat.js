const panel = document.querySelector("[data-chat]");

if (panel) {
  const friendId = panel.dataset.friendId;
  const userId = panel.dataset.userId;
  const csrf = panel.dataset.csrf;
  const messages = panel.querySelector("[data-messages]");
  const form = panel.querySelector("[data-compose]");
  const input = form.querySelector("textarea");
  const sendButton = form.querySelector('[type="submit"]');
  const status = panel.querySelector("[data-status]");
  const previewList = panel.querySelector("[data-preview-list]");
  const menuButton = panel.querySelector("[data-attach-menu]");
  const menu = panel.querySelector("[data-attach-options]");
  const photoInput = panel.querySelector("[data-photo-input]");
  const fileInput = panel.querySelector("[data-file-input]");
  const cancelButton = panel.querySelector("[data-cancel-upload]");
  const dropOverlay = panel.querySelector("[data-drop-overlay]");
  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxImage = lightbox.querySelector("[data-lightbox-image]");
  const lightboxCaption = lightbox.querySelector("[data-lightbox-caption]");
  const allowed = {
    jpg: { kind: "photo", max: 10 * 1024 * 1024 },
    jpeg: { kind: "photo", max: 10 * 1024 * 1024 },
    png: { kind: "photo", max: 10 * 1024 * 1024 },
    webp: { kind: "photo", max: 10 * 1024 * 1024 },
    gif: { kind: "photo", max: 10 * 1024 * 1024 },
    pdf: { kind: "file", max: 20 * 1024 * 1024 },
    doc: { kind: "file", max: 20 * 1024 * 1024 },
    docx: { kind: "file", max: 20 * 1024 * 1024 },
    xls: { kind: "file", max: 20 * 1024 * 1024 },
    xlsx: { kind: "file", max: 20 * 1024 * 1024 },
    ppt: { kind: "file", max: 20 * 1024 * 1024 },
    pptx: { kind: "file", max: 20 * 1024 * 1024 },
    txt: { kind: "file", max: 20 * 1024 * 1024 },
    csv: { kind: "file", max: 20 * 1024 * 1024 },
    zip: { kind: "file", max: 20 * 1024 * 1024 },
  };
  let stagedFiles = [];
  let uploadRequest = null;
  let failedMessage = null;
  let polling = false;
  let lastId =
    messages.querySelector("[data-message-id]:last-of-type")?.dataset.messageId ??
    messages.querySelector("[data-message-id]")?.dataset.messageId ??
    "0";

  function scrollToLatest() {
    messages.scrollTop = messages.scrollHeight;
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function fileInfo(file) {
    return allowed[file.name.split(".").pop().toLowerCase()];
  }

  function syncSendButton() {
    sendButton.disabled = uploadRequest !== null || (!input.value.trim() && stagedFiles.length === 0);
  }

  function attachmentUrl(attachment) {
    return `/api/amigos/adjuntos/${encodeURIComponent(attachment.id)}`;
  }

  function createFileIcon(filename = "") {
    const icon = document.createElement("span");
    icon.className = "chat-file-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6m-6 4h6"/></svg>';
    const mark = document.createElement("small");
    mark.className = "chat-file-mark";
    mark.textContent = filename.split(".").pop().slice(0, 4).toUpperCase();
    icon.append(mark);
    return icon;
  }

  function renderAttachment(container, attachment) {
    if (attachment.attachment_type === "photo") {
      const link = document.createElement("a");
      link.className = "chat-photo-link";
      link.href = attachmentUrl(attachment);
      link.dataset.chatPhoto = "";
      link.setAttribute("aria-label", `Ampliar ${attachment.original_name}`);
      const image = document.createElement("img");
      image.src = `${link.href}?preview=1`;
      image.alt = attachment.original_name;
      image.loading = "lazy";
      image.width = 240;
      image.height = 240;
      image.addEventListener("load", () => {
        if (messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120)
          scrollToLatest();
      });
      link.append(image);
      container.append(link);
      container.classList.add("chat-attachments-photos");
      return;
    }

    const link = document.createElement("a");
    link.className = "chat-file";
    link.href = attachmentUrl(attachment);
    link.download = attachment.original_name;
    link.append(createFileIcon(attachment.original_name));
    const details = document.createElement("span");
    details.className = "chat-file-details";
    const name = document.createElement("strong");
    name.textContent = attachment.original_name;
    const size = document.createElement("small");
    size.textContent = formatSize(Number(attachment.size_bytes));
    details.append(name, size);
    const download = document.createElement("span");
    download.className = "chat-download";
    download.setAttribute("aria-hidden", "true");
    download.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/></svg>';
    link.append(details, download);
    container.append(link);
  }

  function renderMessage(message, options = {}) {
    panel.querySelector("[data-empty]")?.remove();
    const item = document.createElement("li");
    item.className = `chat-message${String(message.sender_id) === userId ? " chat-message-mine" : ""}`;
    if (message.id) item.dataset.messageId = message.id;
    if (options.pending) item.classList.add("chat-message-pending");

    const attachmentItems = message.attachments || options.files?.map(({ file, info, previewUrl }) => ({
      attachment_type: info.kind,
      original_name: file.name,
      size_bytes: file.size,
      previewUrl,
    })) || [];
    if (attachmentItems.length) {
      const attachmentList = document.createElement("div");
      attachmentList.className = "chat-attachments";
      for (const attachment of attachmentItems) {
        if (attachment.previewUrl) {
          const link = document.createElement("a");
          link.className = "chat-photo-link";
          link.href = attachment.previewUrl;
          link.setAttribute("aria-label", `Vista previa de ${attachment.original_name}`);
          const image = document.createElement("img");
          image.src = attachment.previewUrl;
          image.alt = attachment.original_name;
          image.width = 240;
          image.height = 240;
          link.append(image);
          attachmentList.append(link);
          attachmentList.classList.add("chat-attachments-photos");
        } else {
          renderAttachment(attachmentList, attachment);
        }
      }
      item.append(attachmentList);
    }

    if (message.content) {
      const content = document.createElement("p");
      content.textContent = message.content;
      item.append(content);
    }
    const time = document.createElement("time");
    time.dateTime = message.created_at || new Date().toISOString();
    time.textContent = message.created_at
      ? new Date(message.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })
      : "Ahora";
    item.append(time);

    if (options.pending) {
      const state = document.createElement("div");
      state.className = "chat-pending-state";
      state.textContent = "Enviando…";
      item.append(state);
      options.state = state;
    }
    messages.append(item);
    if (message.id) lastId = String(message.id);
    scrollToLatest();
    return item;
  }

  function renderPreview() {
    previewList.replaceChildren();
    stagedFiles.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "chat-preview-item";
      item.dataset.fileIndex = String(index);
      if (entry.info.kind === "photo") {
        const image = document.createElement("img");
        image.className = "chat-preview-photo";
        image.src = entry.previewUrl;
        image.alt = entry.file.name;
        item.append(image);
      } else {
        item.append(createFileIcon(entry.file.name));
      }
      const details = document.createElement("span");
      details.className = "chat-preview-details";
      const name = document.createElement("strong");
      name.textContent = entry.file.name;
      name.title = entry.file.name;
      const size = document.createElement("small");
      size.textContent = formatSize(entry.file.size);
      details.append(name, size);
      item.append(details);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chat-preview-remove";
      remove.setAttribute("aria-label", `Quitar ${entry.file.name}`);
      remove.textContent = "×";
      remove.disabled = uploadRequest !== null;
      item.append(remove);
      const progress = document.createElement("span");
      progress.className = "chat-preview-progress";
      progress.setAttribute("aria-hidden", "true");
      const bar = document.createElement("span");
      bar.dataset.progress = "";
      bar.style.width = `${entry.progress || 0}%`;
      progress.append(bar);
      item.append(progress);
      previewList.append(item);
    });
  }

  function addFiles(files) {
    let added = 0;
    let issue = "";
    for (const file of files) {
      const info = fileInfo(file);
      if (!info) {
        issue = `${file.name}: tipo de archivo no permitido.`;
        continue;
      }
      if (file.type && info.kind === "photo" && !file.type.startsWith("image/")) {
        issue = `${file.name}: el tipo declarado no coincide con una foto.`;
        continue;
      }
      if (file.size > info.max) {
        issue = info.kind === "photo"
          ? `${file.name}: la imagen supera el límite de 10 MB.`
          : `${file.name}: el archivo supera el límite de 20 MB.`;
        continue;
      }
      if (stagedFiles.length >= 5) {
        issue = "Puedes adjuntar como máximo 5 elementos por mensaje.";
        break;
      }
      stagedFiles.push({ file, info, previewUrl: info.kind === "photo" ? URL.createObjectURL(file) : null, progress: 0 });
      added += 1;
    }
    status.textContent = issue || (added ? "" : status.textContent);
    renderPreview();
    syncSendButton();
  }

  function closeMenu(returnFocus = false) {
    menu.hidden = true;
    menuButton.setAttribute("aria-expanded", "false");
    if (returnFocus) menuButton.focus();
  }

  menuButton.addEventListener("click", () => {
    const isOpen = !menu.hidden;
    menu.hidden = isOpen;
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    if (!isOpen) menu.querySelector("button")?.focus();
  });
  menu.addEventListener("click", (event) => {
    const option = event.target.closest("button");
    if (!option) return;
    closeMenu();
    (option.hasAttribute("data-pick-photo") ? photoInput : fileInput).click();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!menu.hidden && !event.target.closest(".chat-attach-wrap")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) closeMenu(true);
  });
  menu.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      menu.querySelector("button")?.focus();
    }
  });
  photoInput.addEventListener("change", () => {
    addFiles(photoInput.files);
    photoInput.value = "";
  });
  fileInput.addEventListener("change", () => {
    addFiles(fileInput.files);
    fileInput.value = "";
  });
  previewList.addEventListener("click", (event) => {
    const button = event.target.closest(".chat-preview-remove");
    if (!button || uploadRequest) return;
    const item = button.closest("[data-file-index]");
    const [removed] = stagedFiles.splice(Number(item.dataset.fileIndex), 1);
    if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    renderPreview();
    syncSendButton();
  });
  input.addEventListener("input", syncSendButton);

  let dragDepth = 0;
  form.addEventListener("dragenter", (event) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    dragDepth += 1;
    form.classList.add("is-dragging");
  });
  form.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
  });
  form.addEventListener("dragleave", (event) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) form.classList.remove("is-dragging");
  });
  form.addEventListener("drop", (event) => {
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    dragDepth = 0;
    form.classList.remove("is-dragging");
    addFiles(event.dataTransfer.files);
  });
  document.addEventListener("paste", (event) => {
    if (!panel.contains(document.activeElement)) return;
    const images = [...(event.clipboardData?.items || [])]
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item, index) => item.getAsFile())
      .filter(Boolean)
      .map((file, index) => {
        const extension = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/gif": "gif",
        }[file.type] || "png";
        return new File(
          [file],
          `imagen-pegada-${Date.now()}-${index}.${extension}`,
          { type: file.type },
        );
      });
    if (images.length) addFiles(images);
  });

  function beginUpload() {
    status.textContent = "";
    const content = input.value.trim();
    if (!content && !stagedFiles.length) {
      status.textContent = "Escribe un mensaje o añade un adjunto.";
      input.focus();
      return;
    }
    if (content.length > 2000) {
      status.textContent = "El mensaje no puede superar los 2000 caracteres.";
      return;
    }
    failedMessage?.remove();
    failedMessage = null;
    const optimistic = renderMessage(
      { sender_id: userId, content },
      { pending: true, files: stagedFiles },
    );
    const state = optimistic.querySelector(".chat-pending-state");
    const body = new FormData();
    body.append("content", content);
    body.append("_csrf", csrf);
    stagedFiles.forEach(({ file }) => body.append("attachments", file, file.name));
    uploadRequest = new XMLHttpRequest();
    const xhr = uploadRequest;
    sendButton.disabled = true;
    cancelButton.hidden = false;
    renderPreview();
    xhr.open("POST", `/api/amigos/${encodeURIComponent(friendId)}/mensajes`);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("X-CSRF-Token", csrf);
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percentage = Math.round((event.loaded / event.total) * 100);
      stagedFiles.forEach((entry) => { entry.progress = percentage; });
      renderPreview();
      state.textContent = `Enviando… ${percentage}%`;
    });
    xhr.addEventListener("load", () => {
      uploadRequest = null;
      cancelButton.hidden = true;
      let result;
      try {
        result = JSON.parse(xhr.responseText);
      } catch {
        result = { error: "No se pudo interpretar la respuesta del servidor." };
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        showFailure(optimistic, state, result.error || "No se pudo enviar el mensaje.");
        return;
      }
      optimistic.remove();
      renderMessage(result.message);
      stagedFiles.forEach(({ previewUrl }) => previewUrl && URL.revokeObjectURL(previewUrl));
      stagedFiles = [];
      renderPreview();
      input.value = "";
      status.textContent = "";
      syncSendButton();
      input.focus();
      pollMessages();
    });
    xhr.addEventListener("error", () => {
      uploadRequest = null;
      cancelButton.hidden = true;
      showFailure(optimistic, state, "No se pudo enviar el mensaje. Comprueba tu conexión.");
    });
    xhr.addEventListener("abort", () => {
      uploadRequest = null;
      cancelButton.hidden = true;
      optimistic.remove();
      stagedFiles.forEach((entry) => { entry.progress = 0; });
      renderPreview();
      syncSendButton();
    });
    xhr.send(body);
  }

  function showFailure(item, state, message) {
    state.replaceChildren();
    state.append(document.createTextNode("Error al enviar. "));
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Reintentar";
    retry.addEventListener("click", beginUpload, { once: true });
    state.append(retry);
    item.classList.remove("chat-message-pending");
    failedMessage = item;
    status.textContent = message;
    stagedFiles.forEach((entry) => { entry.progress = 0; });
    renderPreview();
    syncSendButton();
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!uploadRequest) beginUpload();
  });
  cancelButton.addEventListener("click", () => uploadRequest?.abort());

  async function pollMessages() {
    if (polling || uploadRequest) return;
    polling = true;
    try {
      const response = await fetch(
        `/api/amigos/${encodeURIComponent(friendId)}/mensajes?after=${encodeURIComponent(lastId)}`,
        { headers: { Accept: "application/json" }, cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) {
        status.textContent = result.error || "No se pudo actualizar la conversación.";
        if (response.status === 404 || response.status === 401) {
          input.disabled = true;
          sendButton.disabled = true;
          window.clearInterval(pollingTimer);
        }
        return;
      }
      result.messages.forEach((message) => renderMessage(message));
    } catch {
      status.textContent = "No se pudo actualizar el chat. Se volverá a intentar.";
    } finally {
      polling = false;
    }
  }

  const pollingTimer = window.setInterval(pollMessages, 3000);
  messages.addEventListener("click", (event) => {
    const photo = event.target.closest("a[data-chat-photo]");
    if (!photo) return;
    event.preventDefault();
    const photos = [...photo.closest(".chat-message").querySelectorAll("a[data-chat-photo]")];
    openLightbox(photos, photos.indexOf(photo));
  });
  messages.addEventListener("load", (event) => {
    if (
      event.target instanceof HTMLImageElement &&
      messages.scrollHeight - messages.scrollTop - messages.clientHeight < 120
    ) scrollToLatest();
  }, true);

  let lightboxPhotos = [];
  let lightboxIndex = 0;
  function openLightbox(photos, index) {
    lightboxPhotos = photos;
    lightboxIndex = index;
    updateLightbox();
    lightbox.showModal();
  }
  function updateLightbox() {
    const photo = lightboxPhotos[lightboxIndex];
    lightboxImage.src = photo.href;
    lightboxImage.alt = photo.querySelector("img")?.alt || "Foto del mensaje";
    lightboxCaption.textContent = lightboxImage.alt;
    lightbox.querySelector("[data-lightbox-prev]").disabled = lightboxPhotos.length < 2;
    lightbox.querySelector("[data-lightbox-next]").disabled = lightboxPhotos.length < 2;
  }
  lightbox.querySelector("[data-lightbox-close]").addEventListener("click", () => lightbox.close());
  lightbox.querySelector("[data-lightbox-prev]").addEventListener("click", () => {
    lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
    updateLightbox();
  });
  lightbox.querySelector("[data-lightbox-next]").addEventListener("click", () => {
    lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
    updateLightbox();
  });
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close();
  });
  lightbox.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" && lightboxPhotos.length > 1)
      lightbox.querySelector("[data-lightbox-prev]").click();
    if (event.key === "ArrowRight" && lightboxPhotos.length > 1)
      lightbox.querySelector("[data-lightbox-next]").click();
  });

  renderPreview();
  syncSendButton();
  scrollToLatest();
}