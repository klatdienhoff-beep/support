const adminLogin = document.querySelector("#admin-login");
const loginStatus = document.querySelector("#admin-login-status");
const adminLayout = document.querySelector("#admin-layout");
const threadList = document.querySelector("#admin-thread-list");
const inboxEmpty = document.querySelector("#inbox-empty");
const inboxCount = document.querySelector("#inbox-count");
const openCount = document.querySelector("#open-count");
const conversationStatus = document.querySelector("#conversation-status");
const adminChatTitle = document.querySelector("#admin-chat-title");
const adminEmptyState = document.querySelector("#admin-empty-state");
const adminMessages = document.querySelector("#admin-messages");
const adminMessageList = document.querySelector("#admin-message-list");
const adminTypingIndicator = document.querySelector("#admin-typing-indicator");
const replyForm = document.querySelector("#admin-reply-form");
const replyInput = document.querySelector("#admin-reply");
const sendButton = document.querySelector("#admin-send");
const syncStatus = document.querySelector("#admin-sync-status");
const inboxSearch = document.querySelector("#inbox-search");

let adminTypingIdleTimer;
let adminIsTyping = false;
let adminTypingUpdatedAt = 0;
let sending = false;
let renderedAdminMessages = "";
let renderedConversationId = null;

function showSyncError(message) {
  syncStatus.textContent = message;
}

function customerLabel(conversation) {
  return `Customer ${conversation.customer_id.slice(0, 8)}`;
}

function renderState(state) {
  const query = inboxSearch.value.trim().toLowerCase();
  const matching = state.conversations.filter((conversation) =>
    customerLabel(conversation).toLowerCase().includes(query));
  threadList.querySelectorAll(".admin-thread").forEach((thread) => thread.remove());
  inboxCount.textContent = String(state.conversations.length);
  openCount.textContent = String(state.conversations.length);
  inboxEmpty.hidden = matching.length > 0;
  inboxEmpty.textContent = state.conversations.length ? "No matching conversations." : "No conversations yet.";

  matching.forEach((conversation) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `admin-thread${state.conversation?.id === conversation.id ? " selected" : ""}`;
    const avatar = document.createElement("span");
    avatar.className = "thread-avatar";
    avatar.textContent = "C";
    const summary = document.createElement("span");
    summary.className = "thread-summary";
    const name = document.createElement("strong");
    name.textContent = customerLabel(conversation);
    const preview = document.createElement("small");
    preview.textContent = "Support conversation";
    summary.append(name, preview);
    button.append(avatar, summary);
    button.addEventListener("click", async () => {
      try {
        stopAdminTyping();
        await SupportCloud.selectConversation(conversation.id);
        syncStatus.textContent = "";
      } catch (error) {
        showSyncError(`Could not open conversation: ${error.message}`);
      }
    });
    threadList.append(button);
  });

  const hasConversation = Boolean(state.conversation);
  adminChatTitle.textContent = hasConversation ? customerLabel(state.conversation) : "Customer";
  conversationStatus.textContent = hasConversation ? "Support conversation" : "Waiting for a customer chat";
  adminEmptyState.hidden = hasConversation;
  replyInput.disabled = !hasConversation || sending;
  sendButton.disabled = !hasConversation || sending;
  adminTypingIndicator.hidden = !SupportCloud.isTyping(state, "customer");
  const conversationId = state.conversation?.id || null;
  const messageKey = JSON.stringify([conversationId, state.messages.map((message) => [message.id, message.imageUrl])]);
  const conversationChanged = conversationId !== renderedConversationId;
  const previousScrollTop = adminMessages.scrollTop;
  const wasAtBottom = adminMessages.scrollHeight - adminMessages.scrollTop - adminMessages.clientHeight < 60;
  if (messageKey !== renderedAdminMessages) {
    renderedAdminMessages = messageKey;
    renderedConversationId = conversationId;
    adminMessageList.replaceChildren();
    state.messages.forEach((message) => {
      const isAdmin = message.sender === "admin";
      const row = document.createElement("article");
      row.className = `admin-message${isAdmin ? " from-admin" : " from-customer"}`;
      const author = document.createElement("span");
      author.className = "admin-message-author";
      author.textContent = isAdmin ? "You · Support" : "Customer";
      const bubble = document.createElement("div");
      bubble.className = "admin-message-bubble";
      if (message.imageUrl) {
        const image = document.createElement("img");
        image.className = "chat-image";
        image.src = message.imageUrl;
        image.alt = "Customer attachment";
        image.loading = "lazy";
        bubble.append(image);
      } else {
        bubble.textContent = message.text;
      }
      const time = document.createElement("time");
      time.className = "admin-message-time";
      time.dateTime = new Date(message.sentAt).toISOString();
      time.textContent = new Date(message.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      row.append(author, bubble, time);
      adminMessageList.append(row);
    });
    adminMessages.scrollTop = conversationChanged || wasAtBottom ? adminMessages.scrollHeight : previousScrollTop;
  }
}

function setAdminTyping(active) {
  if (adminIsTyping === active && (!active || Date.now() - adminTypingUpdatedAt < 3000)) return;
  adminIsTyping = active;
  adminTypingUpdatedAt = Date.now();
  SupportCloud.setTyping("admin", active).catch((error) => {
    adminIsTyping = false;
    showSyncError(`Typing status could not sync: ${error.message}`);
  });
}

function stopAdminTyping() {
  window.clearTimeout(adminTypingIdleTimer);
  setAdminTyping(false);
}

adminLogin.addEventListener("submit", async (event) => {
  event.preventDefault();
  const finishLoading = ClickLoader.start();
  try {
    loginStatus.textContent = "Signing in…";
    await SupportCloud.signIn(document.querySelector("#admin-email").value.trim(),
      document.querySelector("#admin-password").value);
    document.querySelector("#admin-password").value = "";
    adminLogin.hidden = true;
    adminLayout.hidden = false;
    loginStatus.textContent = "";
  } catch (error) {
    loginStatus.textContent = `Sign-in failed: ${error.message}`;
  } finally {
    finishLoading();
  }
});

document.querySelector("#admin-sign-out").addEventListener("click", async () => {
  const finishLoading = ClickLoader.start();
  try {
    stopAdminTyping();
    await SupportCloud.signOut();
    adminLayout.hidden = true;
    adminLogin.hidden = false;
  } catch (error) {
    showSyncError(`Sign-out failed: ${error.message}`);
  } finally {
    finishLoading();
  }
});

replyInput.addEventListener("input", () => {
  window.clearTimeout(adminTypingIdleTimer);
  if (!replyInput.value.trim()) {
    stopAdminTyping();
    return;
  }
  setAdminTyping(true);
  adminTypingIdleTimer = window.setTimeout(stopAdminTyping, 2200);
});
replyInput.addEventListener("blur", stopAdminTyping);
window.addEventListener("beforeunload", stopAdminTyping);

replyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = replyInput.value.trim();
  if (!message || sending) return;
  window.clearTimeout(adminTypingIdleTimer);
  adminIsTyping = false;
  sending = true;
  sendButton.disabled = true;
  try {
    await SupportCloud.sendMessage("admin", message);
    replyInput.value = "";
    syncStatus.textContent = "";
  } catch (error) {
    showSyncError(`Reply not sent: ${error.message}`);
  } finally {
    sending = false;
    sendButton.disabled = !SupportCloud.getState().conversation;
  }
});

inboxSearch.addEventListener("input", () => renderState(SupportCloud.getState()));
SupportCloud.subscribe(renderState);
SupportCloud.onError((error) => showSyncError(`Inbox sync unavailable: ${error.message}`));
renderState(SupportCloud.getState());
SupportCloud.start().then(() => {
  adminLogin.hidden = true;
  adminLayout.hidden = false;
}).catch((error) => {
  if (error.message !== "Sign in to use support chat.") {
    loginStatus.textContent = `Inbox connection unavailable: ${error.message}`;
  }
});
