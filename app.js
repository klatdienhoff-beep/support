const loginScreen = document.querySelector("#login-screen");
const supportApp = document.querySelector("#support-app");
const form = document.querySelector("#login-form");
const emailInput = document.querySelector("#email");
const passwordInput = document.querySelector("#password");
const passwordToggle = document.querySelector("#password-toggle");
const formMessage = document.querySelector("#form-message");
const resetLink = document.querySelector("#reset-link");
const contactLinks = document.querySelectorAll("#contact-link, #help-link");

const appViews = Array.from(document.querySelectorAll(".app-view"));
const previewBanner = document.querySelector("#preview-banner");
const cookieBanner = document.querySelector("#cookie-banner");
const cookieSettingsScrim = document.querySelector("#cookie-settings-scrim");
const faqSearch = document.querySelector("#faq-search");
const faqCategory = document.querySelector("#faq-category");
const faqResults = document.querySelector("#faq-results");
const emptyResults = document.querySelector("#empty-results");
const chatTranscript = document.querySelector("#chat-transcript");
const sharedChatMessages = document.querySelector("#shared-chat-messages");
const customerTypingIndicator = document.querySelector("#customer-typing-indicator");
const chatSyncStatus = document.querySelector("#chat-sync-status");
const chatInput = document.querySelector("#chat-input");
const chatImage = document.querySelector("#chat-image");
const historyList = document.querySelector("#history-list");
const shareUrl = document.querySelector("#share-url");
const shareMessage = document.querySelector("#share-message");
const toastMessage = document.querySelector("#toast-message");

const articleDetails = {
  tokenized: {
    title: "Understanding tokenized assets",
    category: "DIGITAL ASSETS · HELP ARTICLE",
    slug: "tokenized-assets"
  },
  account: {
    title: "How to protect your account",
    category: "ACCOUNT · HELP ARTICLE",
    slug: "account-safety"
  },
  payments: {
    title: "Payment and transfer basics",
    category: "PAYMENTS · HELP ARTICLE",
    slug: "payment-and-transfer-basics"
  }
};

let activeView = "home-view";
let previousView = "home-view";
let activeArticle = "tokenized";
let cookieChoice = null;
let toastTimer;
let customerTypingIdleTimer;
let supportTypingExpiryTimer;
let customerIsTyping = false;
let customerTypingUpdatedAt = 0;
let sendingChat = false;
let renderedCustomerMessages = "";

passwordToggle.addEventListener("click", () => {
  const isPasswordHidden = passwordInput.type === "password";
  passwordInput.type = isPasswordHidden ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(isPasswordHidden));
  passwordToggle.setAttribute("aria-label", isPasswordHidden ? "Hide password" : "Show password");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const finishLoading = ClickLoader.start();
  try {
    formMessage.textContent = "Signing in…";
    await SupportCloud.signIn(emailInput.value.trim(), passwordInput.value);
    passwordInput.value = "";
    enterSupport();
    formMessage.textContent = "";
  } catch (error) {
    formMessage.textContent = `Sign-in failed: ${error.message}`;
  } finally {
    finishLoading();
  }
});

document.querySelector("#create-account").addEventListener("click", async () => {
  if (!form.reportValidity()) return;
  const finishLoading = ClickLoader.start();
  try {
    formMessage.textContent = "Creating account…";
    const signedIn = await SupportCloud.signUp(emailInput.value.trim(), passwordInput.value);
    passwordInput.value = "";
    if (signedIn) {
      enterSupport();
      formMessage.textContent = "";
    } else {
      formMessage.textContent = "Check your email to confirm your account, then sign in.";
    }
  } catch (error) {
    formMessage.textContent = `Account creation failed: ${error.message}`;
  } finally {
    finishLoading();
  }
});

resetLink.addEventListener("click", () => {
  formMessage.textContent = "Password reset is not configured in this app yet.";
});

contactLinks.forEach((link) => {
  link.addEventListener("click", () => {
    formMessage.textContent = "Sign in to start a support chat, or browse help without signing in.";
  });
});

function enterSupport() {
  loginScreen.hidden = true;
  supportApp.hidden = false;
  document.querySelector("#sign-in").hidden = SupportCloud.hasSession();
  document.querySelector("#sign-out").hidden = !SupportCloud.hasSession();
  previewBanner.hidden = SupportCloud.hasSession();
  showView("home-view");
  if (cookieChoice === null) {
    cookieBanner.hidden = false;
  }
  window.scrollTo(0, 0);
}

function leaveSupport() {
  supportApp.hidden = true;
  loginScreen.hidden = false;
  window.scrollTo(0, 0);
}

function showView(viewId) {
  const nextView = appViews.find((view) => view.id === viewId);
  if (!nextView) {
    return;
  }
  appViews.forEach((view) => {
    view.hidden = view !== nextView;
  });
  if (viewId !== activeView) {
    previousView = activeView;
  }
  activeView = viewId;
  if (viewId === "chat-view") {
    if (SupportCloud.hasSession()) {
      SupportCloud.ensureConversation().then(() => {
        chatSyncStatus.textContent = "";
      }).catch((error) => {
        chatSyncStatus.textContent = `Chat sync unavailable: ${error.message}`;
      });
    } else {
      chatSyncStatus.textContent = "Sign in to send messages and images.";
    }
  }
  window.scrollTo(0, 0);
}

function openArticle(articleKey) {
  const article = articleDetails[articleKey];
  if (!article) {
    return;
  }
  activeArticle = articleKey;
  document.querySelector("#article-title").textContent = article.title;
  document.querySelector("#article-crumb").textContent = article.title;
  document.querySelector("#article-category").textContent = article.category;
  document.querySelectorAll("[data-article-section]").forEach((section) => {
    section.hidden = section.dataset.articleSection !== articleKey;
  });
  document.querySelector("#feedback-result").textContent = "";
  showView("article-view");
}

function openModal(id) {
  const modal = document.querySelector(`#${id}`);
  if (modal) {
    modal.hidden = false;
  }
}

function closeModal(id) {
  const modal = document.querySelector(`#${id}`);
  if (modal) {
    modal.hidden = true;
  }
}

function showToast(message) {
  toastMessage.textContent = message;
  toastMessage.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastMessage.classList.remove("is-visible");
  }, 3000);
}

function filterFaqs() {
  const query = faqSearch.value.trim().toLowerCase();
  const category = faqCategory.value;
  let visibleCount = 0;
  document.querySelectorAll(".faq-result").forEach((result) => {
    const matchesText = result.textContent.toLowerCase().includes(query);
    const matchesCategory = category === "All" || result.dataset.category === category;
    result.hidden = !matchesText || !matchesCategory;
    if (!result.hidden) {
      visibleCount += 1;
    }
  });
  emptyResults.hidden = visibleCount > 0;
}

function renderHistory(state) {
  historyList.replaceChildren();
  const lastMessage = state.messages[state.messages.length - 1];
  if (!lastMessage) {
    const emptyState = document.createElement("p");
    emptyState.textContent = "No messages yet. Sign in and start a chat.";
    historyList.append(emptyState);
    return;
  }

  const historyItem = document.createElement("button");
  historyItem.className = "history-item";
  historyItem.type = "button";
  const historyIcon = document.createElement("span");
  historyIcon.className = "history-item-icon";
  historyIcon.textContent = "◌";
  const historyText = document.createElement("span");
  const historyTitle = document.createElement("strong");
  historyTitle.textContent = "Support conversation";
  const historyPreview = document.createElement("small");
  historyPreview.textContent = `${lastMessage.sender === "admin" ? "Support: " : "You: "}${lastMessage.text ? lastMessage.text.slice(0, 64) : "Image"}`;
  historyText.append(historyTitle, historyPreview);
  const historyArrow = document.createElement("b");
  historyArrow.textContent = "›";
  historyItem.append(historyIcon, historyText, historyArrow);
  historyItem.addEventListener("click", () => {
    closeModal("history-scrim");
    showView("chat-view");
  });
  historyList.append(historyItem);
}

function renderSharedChat(state) {
  const messageKey = JSON.stringify(state.messages.map((message) => [message.id, message.imageUrl]));
  const messagesChanged = messageKey !== renderedCustomerMessages;
  const previousScrollTop = chatTranscript.scrollTop;
  const wasAtBottom = chatTranscript.scrollHeight - chatTranscript.scrollTop - chatTranscript.clientHeight < 60;
  if (messagesChanged) {
    renderedCustomerMessages = messageKey;
    sharedChatMessages.replaceChildren();
    state.messages.forEach((message) => {
      const isCustomer = message.sender === "customer";
      const row = document.createElement("div");
      row.className = isCustomer ? "message-row user-message" : "message-row assistant-message";

      if (!isCustomer) {
        const avatar = document.createElement("span");
        avatar.className = "message-avatar";
        avatar.textContent = "S";
        row.append(avatar);
      }

      const bubble = document.createElement("p");
      bubble.className = "shared-message";
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
      const meta = document.createElement("span");
      meta.className = "message-meta";
      meta.textContent = new Date(message.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      bubble.append(document.createElement("br"), meta);
      row.append(bubble);
      sharedChatMessages.append(row);
    });
  }

  const supportIsTyping = SupportCloud.isTyping(state, "admin");
  const typingAppeared = supportIsTyping && customerTypingIndicator.hidden;
  customerTypingIndicator.hidden = !supportIsTyping;
  window.clearTimeout(supportTypingExpiryTimer);
  if (supportIsTyping) {
    supportTypingExpiryTimer = window.setTimeout(() => {
      try {
        renderSharedChat(SupportCloud.getState());
      } catch (error) {
        chatSyncStatus.textContent = `Chat sync unavailable: ${error.message}`;
      }
    }, 5000);
  }
  renderHistory(state);
  if (activeView === "chat-view" && (messagesChanged || typingAppeared)) {
    chatTranscript.scrollTop = wasAtBottom ? chatTranscript.scrollHeight : previousScrollTop;
  }
}

function setCustomerTyping(active) {
  if (!SupportCloud.hasSession() || (customerIsTyping === active && (!active || Date.now() - customerTypingUpdatedAt < 3000))) {
    return;
  }
  customerIsTyping = active;
  customerTypingUpdatedAt = Date.now();
  SupportCloud.setTyping("customer", active).catch((error) => {
    customerIsTyping = false;
    chatSyncStatus.textContent = `Chat sync unavailable: ${error.message}`;
  });
}

function stopCustomerTyping() {
  window.clearTimeout(customerTypingIdleTimer);
  customerTypingIdleTimer = null;
  setCustomerTyping(false);
}

async function sendChatMessage(message) {
  const cleanMessage = message.trim();
  if (!cleanMessage || sendingChat) return false;
  sendingChat = true;
  stopCustomerTyping();
  try {
    await SupportCloud.sendMessage("customer", cleanMessage);
    chatSyncStatus.textContent = "";
    return true;
  } catch (error) {
    chatSyncStatus.textContent = `Message not sent: ${error.message}`;
    return false;
  } finally {
    sendingChat = false;
  }
}

function showShareSheet() {
  const article = articleDetails[activeArticle];
  shareUrl.textContent = `Help Center / ${article.title}`;
  shareMessage.textContent = "";
  openModal("share-scrim");
}

async function copyArticleLink() {
  const link = `${window.location.href.split("#")[0]}#article-${activeArticle}`;
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    shareMessage.textContent = "Clipboard access isn't available here. This local preview address can't be shared publicly yet.";
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    shareMessage.textContent = "Local preview address copied. It will only open where this project is available.";
  } catch (error) {
    shareMessage.textContent = "Couldn't access the clipboard. Sharing is available after this preview has a public URL.";
  }
}

try {
  SupportCloud.subscribe(renderSharedChat);
  SupportCloud.onError((error) => { chatSyncStatus.textContent = `Chat sync unavailable: ${error.message}`; });
  renderSharedChat(SupportCloud.getState());
} catch (error) {
  chatSyncStatus.textContent = `Chat sync unavailable: ${error.message}`;
}

chatInput.addEventListener("input", () => {
  window.clearTimeout(customerTypingIdleTimer);
  if (!chatInput.value.trim()) {
    stopCustomerTyping();
    return;
  }
  setCustomerTyping(true);
  customerTypingIdleTimer = window.setTimeout(stopCustomerTyping, 3500);
});
chatInput.addEventListener("blur", stopCustomerTyping);
window.addEventListener("beforeunload", stopCustomerTyping);

document.querySelector("#browse-help").addEventListener("click", enterSupport);
document.querySelector("#sign-in").addEventListener("click", leaveSupport);
document.querySelector("#sign-out").addEventListener("click", async () => {
  const finishLoading = ClickLoader.start();
  try {
    stopCustomerTyping();
    await SupportCloud.signOut();
    leaveSupport();
  } catch (error) {
    showToast(`Sign-out failed: ${error.message}`);
  } finally {
    finishLoading();
  }
});
document.querySelector("#app-home").addEventListener("click", () => showView("home-view"));
document.querySelector("#app-back").addEventListener("click", () => {
  if (activeView === "home-view") {
    leaveSupport();
  } else {
    showView(previousView === activeView ? "home-view" : previousView);
  }
});
document.querySelector("#preview-dismiss").addEventListener("click", () => {
  previewBanner.hidden = true;
});

document.querySelector("#more-tools").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const expanded = button.getAttribute("aria-expanded") === "true";
  button.setAttribute("aria-expanded", String(!expanded));
  document.querySelectorAll(".extra-tool").forEach((tool) => {
    tool.hidden = expanded;
  });
});

document.querySelector("#refresh-suggestions").addEventListener("click", () => {
  const list = document.querySelector(".suggestion-list");
  list.classList.remove("suggestions-refresh");
  void list.offsetWidth;
  list.classList.add("suggestions-refresh");
  showToast("Popular help topics refreshed.");
});

document.querySelector("#history-open").addEventListener("click", () => {
  try {
    renderHistory(SupportCloud.getState());
    openModal("history-scrim");
  } catch (error) {
    chatSyncStatus.textContent = `Chat history unavailable: ${error.message}`;
  }
});
document.querySelector("#chat-history").addEventListener("click", () => {
  document.querySelector("#history-open").click();
});
document.querySelector("#language-open").addEventListener("click", () => openModal("language-scrim"));

document.querySelector("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = chatInput.value;
  if (await sendChatMessage(message) && chatInput.value === message) chatInput.value = "";
});
document.querySelector("#chat-attachment").addEventListener("click", () => {
  if (!SupportCloud.hasSession()) {
    chatSyncStatus.textContent = "Sign in to send images.";
    return;
  }
  chatImage.click();
});
chatImage.addEventListener("change", async () => {
  const file = chatImage.files[0];
  if (!file) return;
  try {
    chatSyncStatus.textContent = "Uploading image…";
    await SupportCloud.sendImage(file);
    chatSyncStatus.textContent = "";
  } catch (error) {
    chatSyncStatus.textContent = `Image not sent: ${error.message}`;
  } finally {
    chatImage.value = "";
  }
});

faqSearch.addEventListener("input", filterFaqs);
faqCategory.addEventListener("change", filterFaqs);
document.querySelector("#share-open").addEventListener("click", showShareSheet);
document.querySelector("#share-open-top").addEventListener("click", showShareSheet);
document.querySelector("#copy-share").addEventListener("click", copyArticleLink);

document.querySelectorAll(".modal-scrim").forEach((scrim) => {
  scrim.addEventListener("click", (event) => {
    if (event.target === scrim) {
      scrim.hidden = true;
    }
  });
});
document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => closeModal(`${button.dataset.close}-scrim`));
});

document.querySelector("#cookie-accept").addEventListener("click", () => {
  cookieChoice = "optional";
  cookieBanner.hidden = true;
  showToast("Optional cookies accepted for this page preview.");
});
document.querySelector("#cookie-reject").addEventListener("click", () => {
  cookieChoice = "essential";
  cookieBanner.hidden = true;
  showToast("Only essential storage selected for this page preview.");
});
document.querySelector("#manage-cookies").addEventListener("click", () => openModal("cookie-settings-scrim"));
document.querySelector("#save-cookie-choice").addEventListener("click", () => {
  cookieChoice = document.querySelector("#analytics-choice").checked ? "optional" : "essential";
  cookieBanner.hidden = true;
  closeModal("cookie-settings-scrim");
  showToast("Your preferences are saved for this page preview.");
});

document.querySelectorAll("[data-share]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.share === "copy") {
      copyArticleLink();
      return;
    }
    shareMessage.textContent = "Share destinations are available after this preview has a public web address.";
  });
});

document.querySelectorAll("[data-feedback]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#feedback-result").textContent = "Thanks for your feedback.";
    document.querySelectorAll("[data-feedback]").forEach((feedbackButton) => {
      feedbackButton.disabled = true;
    });
  });
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) {
    return;
  }

  const articleButton = target.closest("[data-article]");
  if (articleButton) {
    openArticle(articleButton.dataset.article);
    return;
  }

  const categoryButton = target.closest("[data-category]");
  if (categoryButton && categoryButton.matches("button")) {
    showView("faq-view");
    faqCategory.value = Array.from(faqCategory.options).some((option) => option.value === categoryButton.dataset.category)
      ? categoryButton.dataset.category
      : "All";
    faqSearch.value = "";
    filterFaqs();
    return;
  }

  const viewButton = target.closest("[data-open]");
  if (viewButton) {
    showView(`${viewButton.dataset.open}-view`);
  }

  const suggestion = target.closest("[data-chat-suggestion]");
  if (suggestion) {
    const article = articleDetails[suggestion.dataset.chatSuggestion];
    if (article) {
      sendChatMessage(`Tell me about ${article.title.toLowerCase()}.`);
    }
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    showView("faq-view");
    faqSearch.focus();
  }
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-scrim:not([hidden])").forEach((modal) => {
      modal.hidden = true;
    });

    SupportCloud.start().then(() => {
      enterSupport();
    }).catch((error) => {
      if (error.message !== "Sign in to use support chat.") {
        formMessage.textContent = `Support connection unavailable: ${error.message}`;
      }
    });
  }
});
