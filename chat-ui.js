(() => {
  function saveFile(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openImageViewer(message, showError) {
    const dialog = document.createElement("dialog");
    dialog.className = "image-viewer";
    dialog.setAttribute("aria-label", "Image viewer");
    dialog.innerHTML = `
      <div class="image-viewer-toolbar">
        <button type="button" class="image-zoom-out" aria-label="Zoom out">−</button>
        <span class="image-zoom-level" aria-live="polite">100%</span>
        <button type="button" class="image-zoom-in" aria-label="Zoom in">+</button>
        <button type="button" class="image-save">Download</button>
        <button type="button" class="image-close" aria-label="Close image viewer">×</button>
      </div>
      <div class="image-viewer-stage"><div class="image-viewer-frame"><img alt="Shared image"></div></div>
      <p class="image-viewer-status" role="status" aria-live="polite"></p>`;
    document.body.append(dialog);
    const stage = dialog.querySelector(".image-viewer-stage");
    const image = stage.querySelector("img");
    const level = dialog.querySelector(".image-zoom-level");
    const zoomOut = dialog.querySelector(".image-zoom-out");
    const zoomIn = dialog.querySelector(".image-zoom-in");
    const save = dialog.querySelector(".image-save");
    const status = dialog.querySelector(".image-viewer-status");
    let zoom = 1;
    let fitWidth = 0;
    let pinchDistance = 0;
    let pinchZoom = 1;

    function updateZoom(value) {
      zoom = Math.max(1, Math.min(5, value));
      image.style.width = `${fitWidth * zoom}px`;
      level.textContent = `${Math.round(zoom * 100)}%`;
      zoomOut.disabled = zoom <= 1;
      zoomIn.disabled = zoom >= 5;
    }

    image.addEventListener("load", () => {
      fitWidth = Math.min(stage.clientWidth, stage.clientHeight * image.naturalWidth / image.naturalHeight, image.naturalWidth);
      updateZoom(1);
    });
    image.addEventListener("error", () => { status.textContent = "Could not load this image. Close and try again."; });
    zoomOut.addEventListener("click", () => updateZoom(zoom / 1.5));
    zoomIn.addEventListener("click", () => updateZoom(zoom * 1.5));
    stage.addEventListener("touchstart", (event) => {
      if (event.touches.length === 2) {
        pinchDistance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY);
        pinchZoom = zoom;
      }
    }, { passive: true });
    stage.addEventListener("touchmove", (event) => {
      if (event.touches.length !== 2 || !pinchDistance) return;
      event.preventDefault();
      const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY);
      updateZoom(pinchZoom * distance / pinchDistance);
    }, { passive: false });
    stage.addEventListener("touchend", (event) => {
      if (event.touches.length < 2) pinchDistance = 0;
    });
    save.addEventListener("click", async () => {
      save.disabled = true;
      status.textContent = "Downloading image…";
      try {
        const blob = await SupportCloud.downloadImage(message.imagePath);
        saveFile(blob, message.imagePath.split("/").pop());
        status.textContent = "";
      } catch (error) {
        status.textContent = `Image download failed: ${error.message}`;
        showError(`Image download failed: ${error.message}`);
      } finally {
        save.disabled = false;
      }
    });
    function handleKeydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        dialog.close();
      }
    }
    dialog.querySelector(".image-close").addEventListener("click", () => dialog.close());
    window.addEventListener("keydown", handleKeydown, true);
    dialog.addEventListener("close", () => {
      window.removeEventListener("keydown", handleKeydown, true);
      dialog.remove();
    });
    dialog.showModal();
    image.src = message.imageUrl;
  }

  function renderMessage(bubble, message, outgoing, showError) {
    if (message.imageUrl) {
      bubble.classList.add("image-message");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-image-download";
      button.setAttribute("aria-label", "View and zoom image");
      button.title = "View and zoom image";
      const image = document.createElement("img");
      image.className = "chat-image";
      image.src = message.imageUrl;
      image.alt = "Shared image";
      image.loading = "lazy";
      button.append(image);
      button.addEventListener("click", () => openImageViewer(message, showError));
      bubble.append(button);
    } else {
      const text = document.createElement("span");
      text.className = "chat-message-text";
      text.textContent = message.text;
      bubble.append(text);
    }

    const meta = document.createElement("span");
    meta.className = "chat-message-meta";
    const time = document.createElement("time");
    time.dateTime = new Date(message.sentAt).toISOString();
    time.textContent = new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    meta.append(time);
    if (outgoing) {
      const check = document.createElement("span");
      check.className = "chat-sent-check";
      check.setAttribute("aria-label", "Sent");
      check.textContent = "✓";
      meta.append(check);
    }
    bubble.append(meta);
  }

  window.ChatUI = Object.freeze({ renderMessage });
})();
