/* =============================================
   chat.js — Admin Live Chat & Remote Control Logic
============================================= */

let adminChatInitialized = false;

function initAdminChatConsole() {
  if (adminChatInitialized) {
    syncAdminChatConsole();
    return;
  }

  const sendBtn = document.getElementById('admin-chat-send-btn');
  const input = document.getElementById('admin-chat-input');
  const remoteBtn = document.getElementById('admin-remote-btn');
  const endBtn = document.getElementById('admin-end-chat-btn');
  const termInput = document.getElementById('remote-terminal-input');

  if (sendBtn) sendBtn.addEventListener('click', sendAdminReply);
  if (input) {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendAdminReply();
    });
  }

  if (remoteBtn) remoteBtn.addEventListener('click', requestRemoteControl);
  if (endBtn) endBtn.addEventListener('click', endAdminChat);

  if (termInput) {
    termInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') executeTerminalCommand();
    });
  }

  // Listen to localStorage changes in real time
  window.addEventListener('storage', e => {
    if (e.key === 'hd_chat_session') {
      syncAdminChatConsole();
    }
  });

  adminChatInitialized = true;
  syncAdminChatConsole();
}

function getChatSession() {
  try {
    const raw = localStorage.getItem('hd_chat_session');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function saveChatSession(session) {
  try {
    localStorage.setItem('hd_chat_session', JSON.stringify(session));
  } catch(e) {
    console.warn("localStorage saveChatSession failed:", e);
  }
}

function refreshAdminChatList() {
  const list = document.getElementById('chat-sessions-list');
  const badge = document.getElementById('chat-count');
  if (!list) return;

  const session = getChatSession();
  
  if (!session || session.status === 'ended') {
    list.innerHTML = `
      <div class="chat-empty-panel" style="height:100%">
        <span>💬</span>
        <span>No active chats</span>
      </div>
    `;
    if (badge) badge.style.display = 'none';
    return;
  }

  if (badge) {
    badge.textContent = '1';
    badge.style.display = 'inline-block';
  }

  const lastMsg = session.messages.length > 0 ? session.messages[session.messages.length - 1] : { text: 'Started a new session' };
  const lastMsgText = lastMsg.type === 'remote_request' ? '🖥️ Remote control requested' : lastMsg.text;

  list.innerHTML = `
    <div class="chat-session-item active" onclick="syncAdminChatConsole()">
      <div class="chat-session-user">
        <span>👤 ${session.userName}</span>
        <span style="font-size:0.65rem;color:var(--text-muted)">Active</span>
      </div>
      <div class="chat-session-dept">📁 ${session.userDept}</div>
      <div class="chat-session-preview">${lastMsgText}</div>
    </div>
  `;
}

function syncAdminChatConsole() {
  refreshAdminChatList();
  
  const session = getChatSession();
  const consolePanel = document.getElementById('admin-chat-console');
  const emptyPanel = document.getElementById('chat-empty-panel');

  if (!session || session.status === 'ended') {
    if (consolePanel) consolePanel.style.display = 'none';
    if (emptyPanel) emptyPanel.style.display = 'flex';
    return;
  }

  if (consolePanel) consolePanel.style.display = 'flex';
  if (emptyPanel) emptyPanel.style.display = 'none';

  // Populate metadata
  const userEl = document.getElementById('admin-chat-username');
  const deptEl = document.getElementById('admin-chat-userdept');
  if (userEl) userEl.textContent = session.userName + ` (${session.userEmail})`;
  if (deptEl) deptEl.textContent = 'Department: ' + session.userDept;

  // Manage remote control elements
  const remoteBtn = document.getElementById('admin-remote-btn');
  const indicatorTag = document.getElementById('admin-remote-indicator-tag');
  const remotePanel = document.getElementById('admin-remote-view-panel');
  const terminalLogs = document.getElementById('remote-terminal-logs');

  if (session.remoteControlState === 'active') {
    if (remoteBtn) remoteBtn.style.display = 'none';
    if (indicatorTag) indicatorTag.style.display = 'flex';
    if (remotePanel) remotePanel.classList.add('active');
    
    // Set terminal logs from state
    if (terminalLogs) {
      if (!session.terminalLog) {
        session.terminalLog = `Connecting to Remote Support Server...\nEstablished encrypted channel.\nAgent (Admin User) has assumed control.\nType 'help' for commands.`;
        saveChatSession(session);
      }
      terminalLogs.textContent = session.terminalLog;
      terminalLogs.scrollTop = terminalLogs.scrollHeight;
    }
  } else {
    if (remoteBtn) {
      remoteBtn.style.display = 'inline-block';
      if (session.remoteControlState === 'requested') {
        remoteBtn.textContent = '⏳ Waiting for User...';
        remoteBtn.disabled = true;
      } else {
        remoteBtn.textContent = '🖥️ Request Remote Control';
        remoteBtn.disabled = false;
      }
    }
    if (indicatorTag) indicatorTag.style.display = 'none';
    if (remotePanel) remotePanel.classList.remove('active');
  }

  // Render message stream
  renderAdminChatMessages(session);
}

function renderAdminChatMessages(session) {
  const messagesDiv = document.getElementById('admin-chat-messages');
  if (!messagesDiv) return;

  messagesDiv.innerHTML = '';
  
  session.messages.forEach(msg => {
    const timeStr = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (msg.type === 'remote_request') {
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble agent';
      bubble.innerHTML = `
        <div style="font-weight:700;color:var(--accent-blue)">🖥️ Remote Access Requested</div>
        <div style="font-size:0.75rem;font-style:italic">State: ${session.remoteControlState}</div>
        <div class="msg-time">${timeStr}</div>
      `;
      messagesDiv.appendChild(bubble);
    } else {
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble ' + (msg.sender === 'user' ? 'agent' : 'user'); // swap bubbles style for admin view
      bubble.innerHTML = `
        <div><strong>${msg.sender === 'user' ? session.userName : 'You'}</strong>: ${msg.text}</div>
        <div class="msg-time">${timeStr}</div>
      `;
      messagesDiv.appendChild(bubble);
    }
  });

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function sendAdminReply() {
  const input = document.getElementById('admin-chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  const session = getChatSession();
  if (!session) return;

  session.agentJoined = true;
  session.agentName = 'Admin User';
  session.messages.push({
    sender: 'agent',
    text: text,
    time: new Date().toISOString()
  });

  saveChatSession(session);
  syncAdminChatConsole();
}

function requestRemoteControl() {
  const session = getChatSession();
  if (!session) return;

  session.agentJoined = true;
  session.agentName = 'Admin User';
  session.remoteControlState = 'requested';
  
  session.messages.push({
    sender: 'agent',
    text: 'Agent requested remote control access.',
    type: 'remote_request',
    time: new Date().toISOString()
  });

  saveChatSession(session);
  syncAdminChatConsole();
}

function endAdminChat() {
  if (!confirm('Are you sure you want to end this live support session?')) return;
  const session = getChatSession();
  if (!session) return;

  session.status = 'ended';
  session.remoteControlState = 'none';
  session.messages.push({
    sender: 'agent',
    text: 'Chat session has been ended by the support agent.',
    time: new Date().toISOString()
  });

  saveChatSession(session);
  syncAdminChatConsole();
}

function executeTerminalCommand() {
  const input = document.getElementById('remote-terminal-input');
  if (!input) return;
  const command = input.value.trim();
  if (!command) return;

  input.value = '';
  const session = getChatSession();
  if (!session || session.remoteControlState !== 'active') return;

  let output = `\n$ ${command}\n`;
  const lower = command.toLowerCase();

  if (lower === 'help') {
    output += `Available commands:\n  sysinfo   - Display system hardware & OS details\n  diagnose  - Run diagnostics on memory and networks\n  ping      - Test connectivity to gateway\n  reboot    - Simulate user machine reboot\n  clear     - Clear terminal logs`;
  } else if (lower === 'sysinfo') {
    output += `System Information:\n  Device Name:  TKT-WORKSTATION-5\n  OS:           Windows 11 Professional (Build 22631)\n  CPU:          Intel Core i7-13700H @ 3.40GHz\n  Memory:       16.0 GB DDR5 RAM\n  IPv4 Address: 192.168.1.144\n  Uptime:       4 days, 12 hours, 30 minutes`;
  } else if (lower === 'diagnose') {
    output += `Running diagnostics...\n[OK] CPU temperature: 54°C\n[OK] RAM integrity check passed\n[WARN] High memory usage detected (88% allocated)\n[OK] Wi-Fi signal strength: -52 dBm\n[WARN] Intermittent packet drops detected at gateway 192.168.1.1\n\nOptimizing connection adapter settings...\nFlushing DNS resolver cache...\nDone. Diagnostics complete. Connection stabilized.`;
  } else if (lower === 'ping') {
    output += `Pinging 192.168.1.1 with 32 bytes of data:\nReply from 192.168.1.1: bytes=32 time=4ms TTL=64\nReply from 192.168.1.1: bytes=32 time=5ms TTL=64\nReply from 192.168.1.1: bytes=32 time=3ms TTL=64\n\nPing statistics for 192.168.1.1:\n  Packets: Sent = 3, Received = 3, Lost = 0 (0% loss)`;
  } else if (lower === 'reboot') {
    output += `Triggering remote machine reboot...\nSending SIGTERM signals...\nShutting down adapter...\nRebooting... [Connection offline]`;
    // Simulate reconnection after 3 seconds
    setTimeout(() => {
      const reconnectSession = getChatSession();
      if (reconnectSession && reconnectSession.remoteControlState === 'active') {
        reconnectSession.terminalLog += `\n\nSystem restarted successfully.\nConnection re-established.\n$ `;
        saveChatSession(reconnectSession);
        syncAdminChatConsole();
      }
    }, 3000);
  } else if (lower === 'clear') {
    session.terminalLog = `Connecting to Remote Support Server...\nEstablished encrypted channel.\nAgent (Admin User) has assumed control.\nType 'help' for commands.`;
    saveChatSession(session);
    syncAdminChatConsole();
    return;
  } else {
    output += `bash: command not found: ${command}. Type 'help' for support commands.`;
  }

  session.terminalLog += output + '\n$ ';
  saveChatSession(session);
  syncAdminChatConsole();
}
