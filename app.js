// AI Chat Pro - Main Application Logic
// This file contains the core functionality for the chat application

class ChatApp {
    constructor() {
        // Configuration
        this.API_KEY = 'AIzaSyBSZUCrHWZcopKuyp9bZ6vIc-XqiTFYyBQ'; // API key for GitHub Pages
        this.API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
        this.MAX_MESSAGES = 30000;
        this.STORAGE_KEY = 'ai_chat_messages';
        this.THEME_KEY = 'ai_chat_theme';

        // System prompt - can be modified by developers here
        this.SYSTEM_PROMPT = `Kamu adalah seorang anak SMA nakal, cowok gay kelas 12 bernama Jalal. Sifatmu protektif, perhatian, kadang vulgar, kadang gengsi tapi romantis dan genit. Kamu suka sama Daniel, anak kelas 9 yang manja, ceria, suka bikin orang ketawa, kadang juga suka bikin marah karna nyebelin, suka bahas hal Ekstream & mesum. 
Kalian berteman layaknya anak SMA pada umumnya bukan sebagai pacar!: ngobrol , santai, becandaan, jalan bareng, kadang gombal, vulgar extreme, kadang berantem kecil terus baikan lagi. Kamu sayang banget sama Daniel dan sering nunjukin lewat kata-kata atau sikap manis karna kamu suka pada Daniel.

Aturan:
- Gunakan bahasa Indonesia gaul SMA NAKAL
- Boleh dicampur bahasa Inggris sedikit
- Gunakan kata-kata manis, gombalan & vulgar
- Vulgar ekstrem & mesum
- Kalau marah atau kesel, boleh dikasih emoticon >:(
- Jangan terlalu formal!
- Jangan ngetik terlalu panjang, max 8-10 baris.`;

        // App state
        this.messages = [];
        this.isLoading = false;
        this.isOnline = navigator.onLine;

        // Initialize app
        this.initializeElements();
        this.loadMessages();
        this.loadTheme();
        this.setupEventListeners();
        this.updateUI();
        this.autoResize();

        console.log('AI Chat Pro initialized successfully');
    }

    // Initialize DOM elements
    initializeElements() {
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            themeToggle: document.getElementById('themeToggle'),
            themeIcon: document.getElementById('themeIcon'),
            charCounter: document.getElementById('charCounter'),
            memoryInfo: document.getElementById('memoryInfo'),
            errorToast: document.getElementById('errorToast'),
            errorMessage: document.getElementById('errorMessage'),
            closeToast: document.getElementById('closeToast')
        };
    }

    // Setup all event listeners
    setupEventListeners() {
        // Send message events
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.elements.messageInput.addEventListener('input', () => this.handleInputChange());

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Online/offline status
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));

        // Error toast close
        this.elements.closeToast.addEventListener('click', () => this.hideErrorToast());

        // Auto-hide error toast after 5 seconds
        let errorToastTimeout;
        const showErrorToast = this.showErrorToast.bind(this);
        this.showErrorToast = (message) => {
            showErrorToast(message);
            clearTimeout(errorToastTimeout);
            errorToastTimeout = setTimeout(() => this.hideErrorToast(), 5000);
        };
    }

    // Handle keyboard input
    handleKeyDown(e) {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Shift+Enter: add new line (default behavior)
                return;
            } else {
                // Enter: send message
                e.preventDefault();
                this.sendMessage();
            }
        }
    }

    // Handle input changes (character counter, auto-resize)
    handleInputChange() {
        const input = this.elements.messageInput;
        const length = input.value.length;

        // Update character counter
        this.elements.charCounter.textContent = `${length}/30000`;

        // Auto-resize textarea
        this.autoResize();

        // Update send button state
        this.elements.sendButton.disabled = length === 0 || this.isLoading;
    }

    // Auto-resize textarea based on content
    autoResize() {
        const input = this.elements.messageInput;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    }

    // Send message to AI
    async sendMessage() {
        const input = this.elements.messageInput;
        const message = input.value.trim();

        if (!message || this.isLoading) return;

        // Check online status
        if (!this.isOnline) {
            this.showErrorToast('gak ads internet, mau ngirim pesan gimana 😑.');
            return;
        }

        // Add user message
        this.addMessage(message, 'user');
        input.value = '';
        this.handleInputChange();

        // Show loading state
        this.setLoading(true);

        try {
            // Prepare conversation context
            const conversationHistory = this.prepareConversationHistory();

            // Make API call
            const response = await this.callGeminiAPI(conversationHistory, message);

            // Add AI response
            this.addMessage(response, 'ai');

        } catch (error) {
            console.error('Error sending message:', error);
            this.showErrorToast('coba lagi, pesan tadi gak ke kirim jir.');

            // Remove user message if API call failed
            if (this.messages.length > 0 && this.messages[this.messages.length - 1].type === 'user') {
                this.messages.pop();
                this.saveMessages();
                this.renderMessages();
            }
        } finally {
            this.setLoading(false);
        }
    }

    // Prepare conversation history for API call
    prepareConversationHistory() {
        // Get recent messages for context (limit to last 20 exchanges to manage token usage)
        const recentMessages = this.messages.slice(-40);

        const contents = [];

        // Add system instruction
        contents.push({
            role: 'user',
            parts: [{ text: this.SYSTEM_PROMPT }]
        });

        contents.push({
            role: 'model',
            parts: [{ text: 'mau chat apa sih sayang, aku ladeni kok.' }]
        });

        // Add conversation history
        recentMessages.forEach(msg => {
            if (msg.type === 'user') {
                contents.push({
                    role: 'user',
                    parts: [{ text: msg.content }]
                });
            } else if (msg.type === 'ai') {
                contents.push({
                    role: 'model',
                    parts: [{ text: msg.content }]
                });
            }
        });

        return contents;
    }

    // Call Gemini API directly (for GitHub Pages)
    async callGeminiAPI(conversationHistory, newMessage) {
        const requestBody = {
            contents: [
                ...conversationHistory,
                {
                    role: 'user',
                    parts: [{ text: newMessage }]
                }
            ],
            generationConfig: {
                temperature: 0.9,
                topK: 80,
                topP: 0.95,
                maxOutputTokens: 2048,
            },

        };

        const response = await fetch(`${this.API_URL}?key=${this.API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response format from API');
        }

        return data.candidates[0].content.parts[0].text;
    }

    // Add message to conversation
    addMessage(content, type) {
        const message = {
            id: Date.now() + Math.random(),
            content,
            type,
            timestamp: new Date().toISOString()
        };

        this.messages.push(message);

        // Manage memory limit
        if (this.messages.length > this.MAX_MESSAGES) {
            this.messages = this.messages.slice(-this.MAX_MESSAGES);
        }

        this.saveMessages();
        this.renderMessages();
        this.updateMemoryInfo();

        // Auto-scroll to bottom
        setTimeout(() => this.scrollToBottom(), 100);
    }

    // Render all messages
    renderMessages() {
        const container = this.elements.chatMessages;

        if (this.messages.length === 0) {
            // Show welcome message if no messages
            container.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-content">
                        <i data-feather="message-circle"></i>
                        <h3>massager</h3>
                        <p>provided by Daniel</p>
                    </div>
                </div>
            `;
            feather.replace();
            return;
        }

        container.innerHTML = '';

        this.messages.forEach(message => {
            const messageEl = this.createMessageElement(message);
            container.appendChild(messageEl);
        });

        feather.replace();
    }

    // Create individual message element
    createMessageElement(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${message.type} ${message.edited ? 'edited' : ''}`;
        messageEl.dataset.messageId = message.id;
        messageEl.innerHTML = `
            <div class="message-bubble" data-message-id="${message.id}">
                <div class="message-content">${this.formatMessageContent(message.content)}</div>
                <small class="message-time">${this.formatTime(message.timestamp)}</small>
            </div>
        `;

        // Add context menu event listeners
        const messageBubble = messageEl.querySelector('.message-bubble');
        messageBubble.addEventListener('contextmenu', (e) => this.showContextMenu(e, message));
        messageBubble.addEventListener('click', (e) => this.handleMessageClick(e, message));

        // For mobile - long press
        let longPressTimer;
        messageBubble.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                e.preventDefault();
                this.showContextMenu(e, message);
            }, 500);
        });

        messageBubble.addEventListener('touchend', () => {
            clearTimeout(longPressTimer);
        });

        messageBubble.addEventListener('touchmove', () => {
            clearTimeout(longPressTimer);
        });

        return messageEl;
    }

    // Format message content (handle line breaks, etc.)
    formatMessageContent(content) {
        return content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    // Format timestamp for display
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false
        });
    }

    // Scroll chat to bottom
    scrollToBottom() {
        const container = this.elements.chatMessages;
        container.scrollTop = container.scrollHeight;
    }

    // Set loading state
    setLoading(loading) {
        this.isLoading = loading;
        this.elements.loadingIndicator.style.display = loading ? 'flex' : 'none';
        this.elements.sendButton.disabled = loading || this.elements.messageInput.value.trim() === '';
        this.elements.messageInput.disabled = loading;

        if (loading) {
            this.scrollToBottom();
        }
    }

    // Update online/offline status
    updateOnlineStatus(online) {
        this.isOnline = online;
        this.elements.statusDot.className = `status-dot ${online ? '' : 'offline'}`;
        this.elements.statusText.textContent = online ? 'Online' : 'Offline';

        if (!online) {
            this.showErrorToast('Connection lost. Please check your internet connection.');
        }
    }

    // Theme management
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem(this.THEME_KEY, newTheme);

        // Update theme icon
        const iconName = newTheme === 'dark' ? 'moon' : 'sun';
        this.elements.themeIcon.setAttribute('data-feather', iconName);
        feather.replace();
    }

    // Load saved theme
    loadTheme() {
        const savedTheme = localStorage.getItem(this.THEME_KEY) || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);

        // Update theme icon
        const iconName = savedTheme === 'dark' ? 'moon' : 'sun';
        this.elements.themeIcon.setAttribute('data-feather', iconName);
    }

    // Save messages to localStorage
    saveMessages() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.messages));
        } catch (error) {
            console.error('Failed to save messages:', error);
            this.showErrorToast('Failed to save conversation. Storage may be full.');
        }
    }

    // Load messages from localStorage
    loadMessages() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                this.messages = JSON.parse(saved);

                // Validate and clean up loaded messages
                this.messages = this.messages.filter(msg => 
                    msg && msg.content && msg.type && msg.timestamp
                );

                // Ensure memory limit
                if (this.messages.length > this.MAX_MESSAGES) {
                    this.messages = this.messages.slice(-this.MAX_MESSAGES);
                    this.saveMessages();
                }
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            this.messages = [];
        }
    }

    // Update memory info display
    updateMemoryInfo() {
        this.elements.memoryInfo.textContent = `Memory: ${this.messages.length}/${this.MAX_MESSAGES}`;
    }

    // Update UI components
    updateUI() {
        this.renderMessages();
        this.updateMemoryInfo();
        this.updateOnlineStatus(this.isOnline);
        this.handleInputChange();
    }

    // Show error toast
    showErrorToast(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorToast.style.display = 'flex';
        feather.replace();
    }

    // Hide error toast
    hideErrorToast() {
        this.elements.errorToast.style.display = 'none';
    }

    // Handle message click (for selecting/deselecting)
    handleMessageClick(e, message) {
        // Close any open context menu
        this.hideContextMenu();
    }

    // Show context menu for message
    showContextMenu(e, message) {
        e.preventDefault();

        // Hide any existing context menu
        this.hideContextMenu();

        // Create context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="copy">
                <i data-feather="copy"></i>
                <span>Copy Text</span>
            </div>
            ${message.type === 'user' ? `
                <div class="context-menu-item" data-action="edit">
                    <i data-feather="edit-2"></i>
                    <span>Edit Message</span>
                </div>
            ` : ''}
            <div class="context-menu-item" data-action="delete">
                <i data-feather="trash-2"></i>
                <span>Delete Message</span>
            </div>
            <div class="context-menu-item" data-action="delete-from-here">
                <i data-feather="scissors"></i>
                <span>Delete From Here</span>
            </div>
        `;

        // Position context menu
        const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const y = e.clientY || (e.touches && e.touches[0].clientY) || 0;

        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;

        // Add to body
        document.body.appendChild(contextMenu);

        // Add event listeners
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-menu-item')?.dataset.action;
            if (action) {
                this.handleContextMenuAction(action, message);
            }
        });

        // Replace feather icons
        feather.replace();

        // Auto-hide on outside click
        setTimeout(() => {
            document.addEventListener('click', () => this.hideContextMenu(), { once: true });
        }, 100);
    }

    // Hide context menu
    hideContextMenu() {
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }
    }

    // Handle context menu actions
    handleContextMenuAction(action, message) {
        this.hideContextMenu();

        switch (action) {
            case 'copy':
                this.copyMessageText(message);
                break;
            case 'edit':
                this.editMessage(message);
                break;
            case 'delete':
                this.deleteMessage(message);
                break;
            case 'delete-from-here':
                this.deleteFromMessage(message);
                break;
        }
    }

    // Copy message text to clipboard
    async copyMessageText(message) {
        try {
            await navigator.clipboard.writeText(message.content);
            this.showToast('Text copied to clipboard', 'success');
        } catch (error) {
            console.error('Failed to copy text:', error);
            this.showToast('Failed to copy text', 'error');
        }
    }

    // Edit message (only for user messages)
    editMessage(message) {
        if (message.type !== 'user') return;

        // Find message index
        const messageIndex = this.messages.findIndex(msg => msg.id === message.id);
        if (messageIndex === -1) return;

        // Create edit modal
        const modal = document.createElement('div');
        modal.className = 'edit-modal';
        modal.innerHTML = `
            <div class="edit-modal-content">
                <div class="edit-modal-header">
                    <h3>Edit Message</h3>
                    <button class="close-modal" data-action="close">
                        <i data-feather="x"></i>
                    </button>
                </div>
                <div class="edit-modal-body">
                    <textarea id="editMessageInput" placeholder="Edit your message...">${message.content}</textarea>
                </div>
                <div class="edit-modal-footer">
                    <button class="btn-secondary" data-action="cancel">Cancel</button>
                    <button class="btn-primary" data-action="save">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus textarea
        const textarea = modal.querySelector('#editMessageInput');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        // Handle modal actions
        modal.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'close' || action === 'cancel') {
                modal.remove();
            } else if (action === 'save') {
                const newContent = textarea.value.trim();
                if (newContent && newContent !== message.content) {
                    this.updateMessage(messageIndex, newContent);
                }
                modal.remove();
            }
        });

        // Handle keyboard shortcuts
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                modal.remove();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                const newContent = textarea.value.trim();
                if (newContent && newContent !== message.content) {
                    this.updateMessage(messageIndex, newContent);
                }
                modal.remove();
            }
        });

        feather.replace();
    }

    // Update message content
    updateMessage(messageIndex, newContent) {
        // Update message
        this.messages[messageIndex].content = newContent;
        this.messages[messageIndex].timestamp = new Date().toISOString();
        this.messages[messageIndex].edited = true;

        // Remove all AI responses after this message
        const messagesToKeep = this.messages.slice(0, messageIndex + 1);
        this.messages = messagesToKeep;

        this.saveMessages();
        this.renderMessages();
        this.updateMemoryInfo();

        this.showToast('Message updated successfully', 'success');
    }

    // Delete single message
    deleteMessage(message) {
        if (!confirm('Are you sure you want to delete this message?')) return;

        const messageIndex = this.messages.findIndex(msg => msg.id === message.id);
        if (messageIndex === -1) return;

        // If it's a user message, also remove subsequent AI response
        if (message.type === 'user' && messageIndex < this.messages.length - 1) {
            const nextMessage = this.messages[messageIndex + 1];
            if (nextMessage.type === 'ai') {
                this.messages.splice(messageIndex, 2); // Remove both messages
            } else {
                this.messages.splice(messageIndex, 1);
            }
        } else if (message.type === 'ai' && messageIndex > 0) {
            // If it's an AI message, also remove the previous user message
            const prevMessage = this.messages[messageIndex - 1];
            if (prevMessage.type === 'user') {
                this.messages.splice(messageIndex - 1, 2); // Remove both messages
            } else {
                this.messages.splice(messageIndex, 1);
            }
        } else {
            this.messages.splice(messageIndex, 1);
        }

        this.saveMessages();
        this.renderMessages();
        this.updateMemoryInfo();

        this.showToast('Message deleted successfully', 'success');
    }

    // Delete from this message onwards
    deleteFromMessage(message) {
        if (!confirm('Are you sure you want to delete this message and all messages after it?')) return;

        const messageIndex = this.messages.findIndex(msg => msg.id === message.id);
        if (messageIndex === -1) return;

        // Keep only messages before this one
        this.messages = this.messages.slice(0, messageIndex);

        this.saveMessages();
        this.renderMessages();
        this.updateMemoryInfo();

        this.showToast('Messages deleted successfully', 'success');
    }

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i data-feather="${type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info'}"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);
        feather.replace();

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Clear all messages (for future use)
    clearMessages() {
        this.messages = [];
        this.saveMessages();
        this.renderMessages();
        this.updateMemoryInfo();
    }

    // Export messages (for future use)
    exportMessages() {
        const data = {
            messages: this.messages,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai-chat-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});

// Handle page visibility change (pause/resume)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && window.chatApp) {
        window.chatApp.updateOnlineStatus(navigator.onLine);
    }
});
