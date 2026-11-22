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

  function renderMessage(bubble, message, outgoing, showError) {
    if (message.imageUrl) {
      bubble.classList.add("image-message");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-image-download";
      button.setAttribute("aria-label", "Download image");
      button.title = "Download image";
      const image = document.createElement("img");
      image.className = "chat-image";
      image.src = message.imageUrl;
      image.alt = "Shared image";
      image.loading = "lazy";
      button.append(image);
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          const blob = await SupportCloud.downloadImage(message.imagePath);
          saveFile(blob, message.imagePath.split("/").pop());
        } catch (error) {
          showError(`Image download failed: ${error.message}`);
        } finally {
          button.disabled = false;
        }
      });
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
