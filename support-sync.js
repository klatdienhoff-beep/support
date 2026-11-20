(() => {
  const storageKey = "help-support-preview-v1";
  const messageChannel = "help-support-preview-v1";
  const channel = typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel(messageChannel);
  const listeners = new Set();
  let memoryState = null;
  let peerWindow = null;

  if (window.opener && window.opener !== window) {
    peerWindow = window.opener;
  }

  function emptyState() {
    return {
      version: 1,
      updatedAt: 0,
      conversation: null,
      messages: [],
      typing: {
        customer: { active: false, updatedAt: 0 },
        admin: { active: false, updatedAt: 0 }
      }
    };
  }

  function parseState(serialized) {
    if (!serialized) {
      return emptyState();
    }

    let state;
    try {
      state = JSON.parse(serialized);
    } catch (error) {
      throw new Error("The shared preview inbox data is unreadable. Clear this site's local storage to reset it.");
    }

    if (
      !state
      || state.version !== 1
      || !Array.isArray(state.messages)
      || !state.typing
      || !state.typing.customer
      || !state.typing.admin
      || state.messages.some((message) => (
        !message
        || typeof message.id !== "string"
        || (message.sender !== "customer" && message.sender !== "admin")
        || typeof message.text !== "string"
        || typeof message.sentAt !== "number"
      ))
    ) {
      throw new Error("The shared preview inbox data has an unexpected format.");
    }
    return state;
  }

  function readState() {
    if (memoryState) {
      return memoryState;
    }
    return parseState(window.localStorage.getItem(storageKey));
  }

  function notify(state) {
    listeners.forEach((listener) => listener(state));
  }

  function sendToPeer(type, state) {
    if (peerWindow && !peerWindow.closed) {
      peerWindow.postMessage({ channel: messageChannel, type, state }, "*");
    }
  }

  function publish(state) {
    state.updatedAt = Date.now();
    memoryState = state;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    if (channel) {
      channel.postMessage({ type: "updated" });
    }
    sendToPeer("state", state);
    notify(state);
  }

  function mergePeerState(peerState) {
    const incoming = parseState(JSON.stringify(peerState));
    const current = readState();
    const messageMap = new Map();
    [...current.messages, ...incoming.messages].forEach((message) => {
      messageMap.set(message.id, message);
    });

    const merged = {
      version: 1,
      updatedAt: Math.max(current.updatedAt || 0, incoming.updatedAt || 0),
      conversation: incoming.conversation || current.conversation,
      messages: Array.from(messageMap.values()).sort((first, second) => first.sentAt - second.sentAt),
      typing: {
        customer: incoming.typing.customer.updatedAt >= current.typing.customer.updatedAt
          ? incoming.typing.customer
          : current.typing.customer,
        admin: incoming.typing.admin.updatedAt >= current.typing.admin.updatedAt
          ? incoming.typing.admin
          : current.typing.admin
      }
    };
    memoryState = merged;
    window.localStorage.setItem(storageKey, JSON.stringify(merged));
    notify(merged);
  }

  function openAdmin() {
    const adminWindow = window.open("admin.html", "help-support-admin-preview");
    if (!adminWindow) {
      throw new Error("The admin preview was blocked. Allow pop-ups for this page and try again.");
    }
    peerWindow = adminWindow;
    return adminWindow;
  }

  function ensureConversation() {
    const state = readState();
    if (!state.conversation) {
      state.conversation = {
        id: "guest-preview",
        customerName: "Guest customer",
        createdAt: Date.now()
      };
      publish(state);
    }
    return state;
  }

  function setTyping(sender, active) {
    if (sender !== "customer" && sender !== "admin") {
      throw new Error("Unknown chat participant.");
    }

    const state = readState();
    if (!state.conversation) {
      return;
    }
    state.typing[sender] = { active: Boolean(active), updatedAt: Date.now() };
    publish(state);
  }

  function sendMessage(sender, text) {
    if (sender !== "customer" && sender !== "admin") {
      throw new Error("Unknown chat participant.");
    }
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Enter a message before sending.");
    }
    if (text.trim().length > 2000) {
      throw new Error("Messages must be 2,000 characters or fewer.");
    }

    const state = ensureConversation();
    state.messages.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sender,
      text: text.trim(),
      sentAt: Date.now()
    });
    state.typing[sender] = { active: false, updatedAt: Date.now() };
    publish(state);
    return state;
  }

  function isTyping(state, sender) {
    const typing = state.typing[sender];
    return Boolean(typing && typing.active && Date.now() - typing.updatedAt < 5000);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (
      !message
      || message.channel !== messageChannel
      || (peerWindow && event.source !== peerWindow)
      || (!peerWindow && event.source !== window.opener)
    ) {
      return;
    }

    if (message.type === "request") {
      peerWindow = event.source;
      sendToPeer("state", readState());
    } else if (message.type === "state" && message.state) {
      mergePeerState(message.state);
    }
  });

  window.addEventListener("storage", (event) => {
    if (event.key === storageKey) {
      memoryState = parseState(event.newValue);
      notify(memoryState);
    }
  });

  if (channel) {
    channel.addEventListener("message", () => {
      memoryState = parseState(window.localStorage.getItem(storageKey));
      notify(memoryState);
    });
  }

  if (peerWindow) {
    peerWindow.postMessage({ channel: messageChannel, type: "request" }, "*");
  }

  window.SupportSync = Object.freeze({
    ensureConversation,
    getState: readState,
    isTyping,
    openAdmin,
    sendMessage,
    setTyping,
    subscribe
  });
})();
