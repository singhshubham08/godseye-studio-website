(function () {
  if (window.__godseyeChatbotLoaded) return;
  window.__godseyeChatbotLoaded = true;

  const state = {
    open: false,
    minimized: false,
    sessionId: 'guest-' + Math.random().toString(36).slice(2, 10),
    pending: false,
  };
  const launcherPositionKey = 'godseye-ai-launcher-position';
  const dragState = {
    pointerId: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    nextX: 0,
    nextY: 0,
    frame: 0,
    moved: false,
    suppressClick: false,
  };

  function viewportBounds() {
    return {
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function clampLauncherPosition(launcher, x, y) {
    const bounds = viewportBounds();
    const rect = launcher.getBoundingClientRect();
    const insetX = Math.min(8, Math.max(0, (bounds.width - rect.width) / 2));
    const insetY = Math.min(8, Math.max(0, (bounds.height - rect.height) / 2));
    return {
      x: clamp(x, insetX, bounds.width - rect.width - insetX),
      y: clamp(y, insetY, bounds.height - rect.height - insetY),
    };
  }

  function getLauncherPosition(launcher) {
    const rect = launcher.getBoundingClientRect();
    return clampLauncherPosition(launcher, rect.left, rect.top);
  }

  function applyLauncherPosition(launcher, x, y) {
    const position = clampLauncherPosition(launcher, x, y);

    launcher.style.left = position.x + 'px';
    launcher.style.top = position.y + 'px';
    launcher.style.right = 'auto';
    launcher.style.bottom = 'auto';
    return position;
  }

  function saveLauncherPosition(position) {
    try {
      localStorage.setItem(launcherPositionKey, JSON.stringify(position));
    } catch (error) {
      console.warn('Unable to save the AI chat button position.', error);
    }
  }

  function restoreLauncherPosition(launcher) {
    let saved;
    try {
      const value = localStorage.getItem(launcherPositionKey);
      if (value) saved = JSON.parse(value);
    } catch (error) {
      console.warn('Unable to restore the saved AI chat button position.', error);
    }

    if (
      saved &&
      Number.isFinite(saved.x) &&
      Number.isFinite(saved.y)
    ) {
      const position = applyLauncherPosition(launcher, saved.x, saved.y);
      saveLauncherPosition(position);
    } else {
      const position = getLauncherPosition(launcher);
      const adjusted = applyLauncherPosition(launcher, position.x, position.y);
      saveLauncherPosition(adjusted);
    }
  }

  function placeChatPanel(launcher, chat) {
    if (!state.open) return;

    const bounds = viewportBounds();
    const button = launcher.getBoundingClientRect();
    const panel = chat.getBoundingClientRect();
    const gap = 14;
    const x = clamp(
      button.right - panel.width,
      12,
      bounds.width - panel.width - 12
    );
    const above = button.top - panel.height - gap;
    const below = button.bottom + gap;
    const y = above >= 12
      ? above
      : below + panel.height <= bounds.height - 12
        ? below
        : clamp(above, 12, bounds.height - panel.height - 12);

    chat.style.left = x + 'px';
    chat.style.top = y + 'px';
    chat.style.right = 'auto';
    chat.style.bottom = 'auto';
  }

  function enableLauncherDragging(launcher, chat) {
    restoreLauncherPosition(launcher);
    launcher.style.touchAction = 'none';

    function updatePosition() {
      dragState.frame = 0;
      applyLauncherPosition(launcher, dragState.nextX, dragState.nextY);
    }

    launcher.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || dragState.pointerId !== null) return;

      const position = getLauncherPosition(launcher);
      dragState.pointerId = event.pointerId;
      dragState.startX = event.clientX;
      dragState.startY = event.clientY;
      dragState.startLeft = position.x;
      dragState.startTop = position.y;
      dragState.nextX = position.x;
      dragState.nextY = position.y;
      dragState.moved = false;

      if (launcher.setPointerCapture) {
        launcher.setPointerCapture(event.pointerId);
      }
    });

    launcher.addEventListener('pointermove', (event) => {
      if (event.pointerId !== dragState.pointerId) return;

      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      if (!dragState.moved && Math.hypot(deltaX, deltaY) < 5) return;

      dragState.moved = true;
      event.preventDefault();
      launcher.classList.add('is-dragging');
      dragState.nextX = dragState.startLeft + deltaX;
      dragState.nextY = dragState.startTop + deltaY;

      if (!dragState.frame) {
        dragState.frame = requestAnimationFrame(updatePosition);
      }
    });

    function finishDrag(event) {
      if (event.pointerId !== dragState.pointerId) return;

      if (dragState.frame) {
        cancelAnimationFrame(dragState.frame);
        dragState.frame = 0;
        updatePosition();
      }

      if (dragState.moved) {
        dragState.suppressClick = true;
        saveLauncherPosition(getLauncherPosition(launcher));
        setTimeout(() => { dragState.suppressClick = false; }, 0);
      }

      launcher.classList.remove('is-dragging');
      dragState.pointerId = null;
      dragState.moved = false;
    }

    launcher.addEventListener('pointerup', finishDrag);
    launcher.addEventListener('pointercancel', finishDrag);
    launcher.addEventListener('lostpointercapture', finishDrag);
    launcher.addEventListener('click', (event) => {
      if (!dragState.suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    function keepLauncherInView() {
      const position = getLauncherPosition(launcher);
      const adjusted = applyLauncherPosition(launcher, position.x, position.y);
      saveLauncherPosition(adjusted);
      placeChatPanel(launcher, chat);
    }

    window.addEventListener('resize', keepLauncherInView);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', keepLauncherInView);
    }
  }

  function addMessage(role, text) {
    const body = document.getElementById('godseye-ai-chat-body');
    const row = document.createElement('div');
    row.className = 'godseye-chat-message ' + role;

    const avatar = document.createElement('div');
    avatar.className = 'godseye-chat-avatar';
    avatar.textContent = role === 'bot' ? 'AI' : 'You';

    const bubble = document.createElement('div');
    bubble.className = 'godseye-chat-bubble';
    bubble.innerHTML = String(text || '').replace(/\n/g, '<br>');

    if (role === 'bot') {
      row.appendChild(avatar);
      row.appendChild(bubble);
    } else {
      row.appendChild(bubble);
      row.appendChild(avatar);
    }

    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  function setTyping(visible) {
    const body = document.getElementById('godseye-ai-chat-body');
    let node = document.getElementById('godseye-chat-typing');
    if (visible) {
      if (!node) {
        node = document.createElement('div');
        node.id = 'godseye-chat-typing';
        node.className = 'godseye-chat-message bot';
        node.innerHTML = '<div class="godseye-chat-typing"><span></span><span></span><span></span></div>';
        body.appendChild(node);
      }
    } else if (node) {
      node.remove();
    }
    body.scrollTop = body.scrollHeight;
  }

  function renderQuickActions() {
    const form = document.getElementById('godseye-ai-chat-form');
    form.innerHTML = '';

    const actions = ['Build a Website', 'Branding & Logo', 'AI Automation', 'Digital Marketing', 'Talk to Our Team'];
    const wrap = document.createElement('div');
    wrap.className = 'godseye-chat-quick-actions';

    actions.forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'godseye-quick-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => sendQuickAction(label));
      wrap.appendChild(btn);
    });

    form.appendChild(wrap);
  }

  function renderComposer() {
    const form = document.getElementById('godseye-ai-chat-form');
    form.innerHTML = '';

    const textarea = document.createElement('textarea');
    textarea.className = 'godseye-chat-input';
    textarea.placeholder = 'Tell us about your project...';
    textarea.rows = 3;

    const footer = document.createElement('div');
    footer.className = 'godseye-chat-footer';

    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'godseye-chat-send';
    send.textContent = 'Send';

    send.addEventListener('click', () => {
      const value = textarea.value.trim();
      if (!value) return;
      sendMessage(value);
      textarea.value = '';
    });

    textarea.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const value = textarea.value.trim();
        if (!value) return;
        sendMessage(value);
        textarea.value = '';
      }
    });

    footer.appendChild(textarea);
    footer.appendChild(send);
    form.appendChild(footer);
  }

  function sendQuickAction(label) {
    if (state.pending) return;
    state.pending = true;
    setTyping(true);
    fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, quickAction: label })
    })
      .then(async (response) => {
        const data = await response.json();
        setTyping(false);
        if (!response.ok) {
          addMessage('bot', data.error || 'Something went wrong.');
          return;
        }
        addMessage('user', label);
        addMessage('bot', data.reply || 'Thanks for reaching out.');
        if (data.phase === 'complete') {
          renderQuickActions();
        }
      })
      .catch(() => {
        setTyping(false);
        addMessage('bot', 'The assistant is temporarily unavailable. Please try again in a moment.');
      })
      .finally(() => { state.pending = false; });
  }

  function sendMessage(message) {
    if (state.pending) return;
    state.pending = true;
    setTyping(true);
    addMessage('user', message);

    fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId, message })
    })
      .then(async (response) => {
        const data = await response.json();
        setTyping(false);
        if (!response.ok) {
          addMessage('bot', data.error || 'Something went wrong.');
          return;
        }
        addMessage('bot', data.reply || 'Thanks for your message.');
        if (data.phase === 'complete') {
          renderQuickActions();
        }
      })
      .catch(() => {
        setTyping(false);
        addMessage('bot', 'The assistant is temporarily unavailable. Please try again in a moment.');
      })
      .finally(() => { state.pending = false; });
  }

  function init() {
    const launcher = document.getElementById('godseye-ai-launcher');
    const chat = document.getElementById('godseye-ai-chat');
    const close = document.getElementById('godseye-ai-close');
    const minimize = document.getElementById('godseye-ai-minimize');

    launcher.addEventListener('click', () => {
      state.open = !state.open;
      chat.classList.toggle('open', state.open);
      if (state.open) {
        chat.classList.remove('minimized');
        requestAnimationFrame(() => placeChatPanel(launcher, chat));
      }
    });

    close.addEventListener('click', () => {
      state.open = false;
      chat.classList.remove('open');
    });

    minimize.addEventListener('click', () => {
      state.minimized = !state.minimized;
      if (state.minimized) {
        chat.classList.remove('open');
      } else {
        state.open = true;
        chat.classList.add('open');
      }
    });

    chat.classList.toggle('open', state.open && !state.minimized);
    chat.classList.toggle('minimized', state.minimized);

    const body = document.getElementById('godseye-ai-chat-body');
    body.innerHTML = '';
    addMessage('bot', "Hey! I'm God's Eye AI. Tell me what kind of project you want to build.");
    renderQuickActions();
    renderComposer();
    enableLauncherDragging(launcher, chat);
    if (state.open && !state.minimized) {
      requestAnimationFrame(() => placeChatPanel(launcher, chat));
    }
  }

  function mountChatbot() {
    const existingLauncher = document.getElementById('godseye-ai-launcher');
    const existingChat = document.getElementById('godseye-ai-chat');
    if (existingLauncher && existingChat) return;
    if (existingLauncher) existingLauncher.remove();
    if (existingChat) existingChat.remove();

    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.id = 'godseye-ai-launcher';
    launcher.setAttribute('aria-label', 'Open Godseye AI assistant');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.5C7.58 3.5 4 7.08 4 11.5c0 2.5 1.14 4.74 2.93 6.23L6 20.5l3.08-1.26A8.58 8.58 0 0 0 12 19.5c4.42 0 8-3.58 8-8s-3.58-8-8-8Zm.5 6.5h-1v2.5H9v1h2.5V16h1v-2.5H15v-1h-2.5V10Z" fill="currentColor"/></svg>';
    document.body.appendChild(launcher);

    const chat = document.createElement('aside');
    chat.id = 'godseye-ai-chat';
    chat.setAttribute('role', 'dialog');
    chat.setAttribute('aria-live', 'polite');
    chat.setAttribute('aria-label', 'Godseye AI assistant');
    chat.innerHTML = `
      <div class="godseye-chat-header">
        <div class="godseye-chat-brand">
          <div class="godseye-chat-badge">AI</div>
          <div>
            <p class="godseye-chat-title">God's Eye AI</p>
            <p class="godseye-chat-subtitle">Project Assistant</p>
          </div>
        </div>
        <div class="godseye-chat-actions">
          <button type="button" class="godseye-icon-btn" id="godseye-ai-minimize" aria-label="Minimize chat">–</button>
          <button type="button" class="godseye-icon-btn" id="godseye-ai-close" aria-label="Close chat">×</button>
        </div>
      </div>
      <div class="godseye-chat-body" id="godseye-ai-chat-body"></div>
      <div class="godseye-chat-form" id="godseye-ai-chat-form"></div>
    `;
    document.body.appendChild(chat);

    init();
  }

  function startChatbot() {
    const observer = new MutationObserver(() => {
      if (
        !document.getElementById('godseye-ai-launcher') ||
        !document.getElementById('godseye-ai-chat')
      ) {
        mountChatbot();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    mountChatbot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startChatbot, { once: true });
  } else {
    startChatbot();
  }
})();
