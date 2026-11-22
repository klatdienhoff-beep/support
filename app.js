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
const chatCaseId = document.querySelector("#chat-case-id");
const historyList = document.querySelector("#history-list");
const shareUrl = document.querySelector("#share-url");
const shareMessage = document.querySelector("#share-message");
const toastMessage = document.querySelector("#toast-message");

const articleDetails = {
  tokenized: {
    title: "トークン化資産について",
    category: "デジタル資産 · ヘルプ記事",
    slug: "tokenized-assets"
  },
  account: {
    title: "アカウントを保護するには",
    category: "アカウント · ヘルプ記事",
    slug: "account-safety"
  },
  payments: {
    title: "支払いと送金の基本",
    category: "支払い · ヘルプ記事",
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

function navigationState() {
  const modal = document.querySelector(".modal-scrim:not([hidden])");
  return {
    supportNavigation: true,
    screen: supportApp.hidden ? "login" : "support",
    view: activeView,
    article: activeArticle,
    category: faqCategory.value,
    search: faqSearch.value,
    modal: modal ? modal.id : null
  };
}

function saveNavigation(replace = false) {
  const state = navigationState();
  const current = window.history.state;
  if (!replace && JSON.stringify(current) === JSON.stringify(state)) return;
  window.history[replace ? "replaceState" : "pushState"](state, "");
}

saveNavigation(true);

window.addEventListener("popstate", (event) => {
  const state = event.state;
  if (!state || !state.supportNavigation) return;
  document.querySelectorAll(".modal-scrim").forEach((modal) => { modal.hidden = true; });
  if (state.screen === "login") {
    leaveSupport(false);
  } else {
    loginScreen.hidden = true;
    supportApp.hidden = false;
    document.querySelector("#sign-in").hidden = SupportCloud.hasSession();
    document.querySelector("#sign-out").hidden = !SupportCloud.hasSession();
    previewBanner.hidden = SupportCloud.hasSession();
    if (state.view === "article-view" && articleDetails[state.article]) {
      openArticle(state.article, false);
    } else {
      showView(state.view, false);
    }
    faqCategory.value = state.category;
    faqSearch.value = state.search;
    filterFaqs();
  }
  const modal = state.modal && document.getElementById(state.modal);
  if (modal) modal.hidden = false;
});

passwordToggle.addEventListener("click", () => {
  const isPasswordHidden = passwordInput.type === "password";
  passwordInput.type = isPasswordHidden ? "text" : "password";
  passwordToggle.setAttribute("aria-pressed", String(isPasswordHidden));
  passwordToggle.setAttribute("aria-label", isPasswordHidden ? "パスワードを非表示" : "パスワードを表示");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const finishLoading = ClickLoader.start();
  try {
    formMessage.textContent = "ログイン中…";
    await SupportCloud.signIn(emailInput.value.trim(), passwordInput.value);
    passwordInput.value = "";
    enterSupport();
    formMessage.textContent = "";
  } catch (error) {
    formMessage.textContent = `ログインできませんでした: ${error.message}`;
  } finally {
    finishLoading();
  }
});

document.querySelector("#create-account").addEventListener("click", async () => {
  if (!form.reportValidity()) return;
  const finishLoading = ClickLoader.start();
  try {
    formMessage.textContent = "アカウントを作成中…";
    const signedIn = await SupportCloud.signUp(emailInput.value.trim(), passwordInput.value);
    passwordInput.value = "";
    if (signedIn) {
      enterSupport();
      formMessage.textContent = "";
    } else {
      formMessage.textContent = "メールを確認してアカウントを認証し、ログインしてください。";
    }
  } catch (error) {
    formMessage.textContent = `アカウントを作成できませんでした: ${error.message}`;
  } finally {
    finishLoading();
  }
});

resetLink.addEventListener("click", () => {
  formMessage.textContent = "パスワードの再設定はまだ利用できません。";
});

contactLinks.forEach((link) => {
  link.addEventListener("click", () => {
    formMessage.textContent = "チャットを始めるにはログインしてください。ログインせずにヘルプを閲覧することもできます。";
  });
});

function enterSupport(record = true) {
  loginScreen.hidden = true;
  supportApp.hidden = false;
  document.querySelector("#sign-in").hidden = SupportCloud.hasSession();
  document.querySelector("#sign-out").hidden = !SupportCloud.hasSession();
  previewBanner.hidden = SupportCloud.hasSession();
  showView("home-view", false);
  if (cookieChoice === null) {
    cookieBanner.hidden = false;
  }
  window.scrollTo(0, 0);
  if (record) saveNavigation();
}

function leaveSupport(record = true) {
  supportApp.hidden = true;
  loginScreen.hidden = false;
  window.scrollTo(0, 0);
  if (record) saveNavigation();
}

function showView(viewId, record = true) {
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
        chatSyncStatus.textContent = `チャットを同期できません: ${error.message}`;
      });
    } else {
      chatSyncStatus.textContent = "メッセージや画像を送信するにはログインしてください。";
    }
  }
  window.scrollTo(0, 0);
  if (record) saveNavigation();
}

function openArticle(articleKey, record = true) {
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
  showView("article-view", record);
}

function openModal(id) {
  const modal = document.querySelector(`#${id}`);
  if (modal) {
    modal.hidden = false;
    saveNavigation();
  }
}

function closeModal(id, afterClose) {
  const modal = document.querySelector(`#${id}`);
  if (modal) {
    modal.hidden = true;
    if (window.history.state?.supportNavigation && window.history.state.modal === id) {
      if (afterClose) window.addEventListener("popstate", afterClose, { once: true });
      window.history.back();
    } else if (afterClose) {
      afterClose();
    }
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
    emptyState.textContent = "メッセージはまだありません。ログインしてチャットを始めてください。";
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
  historyTitle.textContent = `ケースID: #${state.conversation.case_id}`;
  const historyPreview = document.createElement("small");
  historyPreview.textContent = `${lastMessage.sender === "admin" ? "サポート: " : "あなた: "}${lastMessage.text ? lastMessage.text.slice(0, 64) : "画像"}`;
  historyText.append(historyTitle, historyPreview);
  const historyArrow = document.createElement("b");
  historyArrow.textContent = "›";
  historyItem.append(historyIcon, historyText, historyArrow);
  historyItem.addEventListener("click", () => {
    closeModal("history-scrim", () => showView("chat-view"));
  });
  historyList.append(historyItem);
}

function renderSharedChat(state) {
  chatCaseId.textContent = state.conversation
    ? `ケースID: #${state.conversation.case_id}`
    : "ケースID：チャットを始めるにはログインしてください";
  const messageKey = JSON.stringify([state.conversation?.id, state.messages.map((message) => [message.id, message.imageUrl])]);
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

      const bubble = document.createElement("div");
      bubble.className = "shared-message";
      ChatUI.renderMessage(bubble, message, isCustomer, (error) => { chatSyncStatus.textContent = error; });
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
        chatSyncStatus.textContent = `チャットを同期できません: ${error.message}`;
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
    chatSyncStatus.textContent = `チャットを同期できません: ${error.message}`;
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
    chatSyncStatus.textContent = `メッセージを送信できませんでした: ${error.message}`;
    return false;
  } finally {
    sendingChat = false;
  }
}

function showShareSheet() {
  const article = articleDetails[activeArticle];
  shareUrl.textContent = `ヘルプセンター / ${article.title}`;
  shareMessage.textContent = "";
  openModal("share-scrim");
}

async function copyArticleLink() {
  const link = `${window.location.href.split("#")[0]}#article-${activeArticle}`;
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    shareMessage.textContent = "クリップボードを使用できません。このローカルプレビューのアドレスは公開共有できません。";
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    shareMessage.textContent = "ローカルプレビューのアドレスをコピーしました。このプロジェクトを利用できる環境でのみ開けます。";
  } catch (error) {
    shareMessage.textContent = "クリップボードにアクセスできません。公開URLの設定後に共有できます。";
  }
}

try {
  SupportCloud.subscribe(renderSharedChat);
  SupportCloud.onError((error) => { chatSyncStatus.textContent = `チャットを同期できません: ${error.message}`; });
  renderSharedChat(SupportCloud.getState());
} catch (error) {
  chatSyncStatus.textContent = `チャットを同期できません: ${error.message}`;
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
    showToast(`ログアウトできませんでした: ${error.message}`);
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
  showToast("よくある質問を更新しました。");
});

document.querySelector("#history-open").addEventListener("click", () => {
  try {
    renderHistory(SupportCloud.getState());
    openModal("history-scrim");
  } catch (error) {
    chatSyncStatus.textContent = `チャット履歴を表示できません: ${error.message}`;
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
    chatSyncStatus.textContent = "画像を送信するにはログインしてください。";
    return;
  }
  chatImage.click();
});
chatImage.addEventListener("change", async () => {
  const file = chatImage.files[0];
  if (!file) return;
  try {
    chatSyncStatus.textContent = "画像をアップロード中…";
    await SupportCloud.sendImage(file);
    chatSyncStatus.textContent = "";
  } catch (error) {
    chatSyncStatus.textContent = `画像を送信できませんでした: ${error.message}`;
  } finally {
    chatImage.value = "";
  }
});

function updateFaqFilters() {
  filterFaqs();
  saveNavigation(true);
}
faqSearch.addEventListener("input", updateFaqFilters);
faqCategory.addEventListener("change", updateFaqFilters);
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
  showToast("このプレビューで任意のCookieを許可しました。");
});
document.querySelector("#cookie-reject").addEventListener("click", () => {
  cookieChoice = "essential";
  cookieBanner.hidden = true;
  showToast("このプレビューでは必須の保存機能のみを使用します。");
});
document.querySelector("#manage-cookies").addEventListener("click", () => openModal("cookie-settings-scrim"));
document.querySelector("#save-cookie-choice").addEventListener("click", () => {
  cookieChoice = document.querySelector("#analytics-choice").checked ? "optional" : "essential";
  cookieBanner.hidden = true;
  closeModal("cookie-settings-scrim");
  showToast("このプレビューの設定を保存しました。");
});

document.querySelectorAll("[data-share]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.share === "copy") {
      copyArticleLink();
      return;
    }
    shareMessage.textContent = "公開URLの設定後に共有先を利用できます。";
  });
});

document.querySelectorAll("[data-feedback]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#feedback-result").textContent = "ご意見ありがとうございます。";
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
    saveNavigation(true);
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
      sendChatMessage(`${article.title}を教えてください。`);
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
      closeModal(modal.id);
    });

    SupportCloud.start().then(() => {
      enterSupport();
    }).catch((error) => {
      if (error.message !== "サポートチャットを利用するにはログインしてください。") {
        formMessage.textContent = `サポートに接続できません: ${error.message}`;
      }
    });
  }
});
