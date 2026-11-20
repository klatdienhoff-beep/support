(() => {
  const projectUrl = "https://wiapyjbwyewrleshmqfy.supabase.co";
  const publishableKey = "sb_publishable_GJyaLUK4eKgLJywVA0Gcpg_MYfV7pnp";
  const isAdminPage = document.body.classList.contains("admin-body");
  const listeners = new Set();
  const errorListeners = new Set();
  const imageUrls = new Map();
  let client;
  let session = null;
  let timer = null;
  let refreshing = null;
  let typingQueue = Promise.resolve();
  let sessionVersion = 0;
  let state = { conversation: null, conversations: [], messages: [], typing: {} };

  function getClient() {
    if (!window.supabase) {
      throw new Error("The Supabase client could not load. Check your internet connection and reload.");
    }
    if (!client) {
      client = window.supabase.createClient(projectUrl, publishableKey, {
        auth: { storageKey: isAdminPage ? "support-admin-session" : "support-customer-session" }
      });
    }
    return client;
  }

  function check(result) {
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.data;
  }

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  function report(error) {
    errorListeners.forEach((listener) => listener(error));
  }

  async function requireSession() {
    const version = sessionVersion;
    const data = check(await getClient().auth.getSession());
    if (version !== sessionVersion) throw new Error("The session changed. Please try again.");
    session = data.session;
    if (!session) throw new Error("Sign in to use support chat.");
    return session;
  }

  async function signIn(email, password) {
    const data = check(await getClient().auth.signInWithPassword({ email, password }));
    sessionVersion += 1;
    session = data.session;
    if (isAdminPage && !check(await getClient().rpc("is_support_admin"))) {
      check(await getClient().auth.signOut());
      sessionVersion += 1;
      session = null;
      throw new Error("This account is not authorized for the admin inbox.");
    }
    await start();
  }

  async function signUp(email, password) {
    const data = check(await getClient().auth.signUp({ email, password }));
    sessionVersion += 1;
    session = data.session;
    if (session) await start();
    return Boolean(session);
  }

  async function signOut() {
    check(await getClient().auth.signOut());
    sessionVersion += 1;
    window.clearInterval(timer);
    timer = null;
    session = null;
    imageUrls.clear();
    state = { conversation: null, conversations: [], messages: [], typing: {} };
    notify();
  }

  async function signedImage(path) {
    const cached = imageUrls.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const data = check(await getClient().storage.from("support-images").createSignedUrl(path, 3600));
    imageUrls.set(path, { url: data.signedUrl, expiresAt: Date.now() + 3000000 });
    return data.signedUrl;
  }

  async function refreshNow() {
    const version = sessionVersion;
    await requireSession();
    const conversations = check(await getClient().from("support_conversations")
      .select("id,customer_id,created_at,customer_typing_at,admin_typing_at")
      .order("created_at", { ascending: false }));
    let conversation = conversations.find((item) => item.id === state.conversation?.id);
    if (!conversation && !isAdminPage) conversation = conversations[0];
    if (!conversation && isAdminPage) conversation = conversations[0];
    let messages = [];
    if (conversation) {
      const rows = check(await getClient().from("support_messages")
        .select("id,sender,body,image_path,created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }));
      messages = await Promise.all(rows.map(async (row) => ({
        id: row.id,
        sender: row.sender,
        text: row.body || "",
        imageUrl: row.image_path ? await signedImage(row.image_path) : null,
        sentAt: Date.parse(row.created_at)
      })));
    }
    if (version !== sessionVersion) return;
    state = {
      conversation: conversation || null,
      conversations,
      messages,
      typing: conversation ? {
        customer: conversation.customer_typing_at,
        admin: conversation.admin_typing_at
      } : {}
    };
    notify();
  }

  function refresh() {
    if (!refreshing) {
      refreshing = refreshNow().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function start() {
    await requireSession();
    if (isAdminPage && !check(await getClient().rpc("is_support_admin"))) {
      throw new Error("This account is not authorized for the admin inbox.");
    }
    await refresh();
    if (!timer) {
      timer = window.setInterval(() => {
        refresh().catch(report);
      }, 2000);
    }
  }

  async function ensureConversation() {
    const current = await requireSession();
    if (!state.conversation) {
      const result = await getClient().from("support_conversations")
        .insert({ customer_id: current.user.id }).select().single();
      if (result.error && result.error.code !== "23505") check(result);
      if (refreshing) await refreshing;
      await refresh();
      if (!state.conversation) throw new Error("The new conversation could not be loaded.");
    }
    return state;
  }

  async function selectConversation(id) {
    if (refreshing) await refreshing;
    const conversation = state.conversations.find((item) => item.id === id);
    if (!conversation) throw new Error("Conversation no longer exists.");
    state = { ...state, conversation };
    await refresh();
  }

  function setTyping(sender, active) {
    if (!state.conversation) return Promise.resolve();
    const conversation = state.conversation.id;
    const result = typingQueue.catch(() => {}).then(async () => {
      check(await getClient().rpc("support_set_typing", { conversation, participant: sender, active }));
    });
    typingQueue = result;
    return result;
  }

  async function refreshAfterMutation() {
    if (refreshing) await refreshing;
    await refresh();
  }

  async function sendMessage(sender, text) {
    if (!text.trim() || text.trim().length > 2000) throw new Error("Enter a message of up to 2,000 characters.");
    if (!state.conversation && !isAdminPage) await ensureConversation();
    if (!state.conversation) throw new Error("Select a conversation first.");
    check(await getClient().from("support_messages").insert({
      conversation_id: state.conversation.id, sender, body: text.trim()
    }));
    setTyping(sender, false).catch(report);
    refreshAfterMutation().catch(report);
  }

  async function sendImage(file) {
    const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    if (!extensions[file.type] || file.size > 5242880 || file.size === 0) {
      throw new Error("Choose a JPEG, PNG, GIF or WebP image up to 5 MB.");
    }
    const current = await requireSession();
    await ensureConversation();
    const path = `${current.user.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
    check(await getClient().storage.from("support-images").upload(path, file, { contentType: file.type }));
    check(await getClient().from("support_messages").insert({
      conversation_id: state.conversation.id, sender: "customer", image_path: path
    }));
    refreshAfterMutation().catch(report);
  }

  function isTyping(currentState, sender) {
    const time = Date.parse(currentState.typing[sender]);
    return Number.isFinite(time) && Date.now() - time < 6000;
  }

  window.SupportCloud = Object.freeze({
    signIn, signUp, signOut, start, ensureConversation, selectConversation,
    setTyping, sendMessage, sendImage, isTyping,
    getState: () => state,
    hasSession: () => Boolean(session),
    subscribe: (listener) => listeners.add(listener),
    onError: (listener) => errorListeners.add(listener)
  });
})();
