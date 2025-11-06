// WebSocket соединение
let ws = null;
let selectedFiles = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// Инициализация чата
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.chat-main')) {
        initChat();
    }
});

// Инициализация чата
function initChat() {
    loadMessages();
    connectWebSocket();
    setupEventListeners();
}

// Подключение к WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/chat`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket подключен');
        // Отправляем ping для поддержания соединения каждые 30 секунд
        setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            // Игнорируем служебные сообщения (ping/pong)
            if (data.type === 'pong' || data.type === 'ping') {
                return;
            }
            
            // Отображаем сообщения чата
            // (проверка на дубликаты уже есть в displayMessage)
            displayMessage(data);
        } catch (error) {
            console.error('Ошибка парсинга сообщения WebSocket:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
    };
    
    ws.onclose = () => {
        console.log('WebSocket отключен, переподключение...');
        setTimeout(connectWebSocket, 3000);
    };
}

// Загрузка сообщений
async function loadMessages() {
    try {
        const response = await fetch(`${API_URL}/api/chat/messages`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки сообщений');
        }
        
        const messages = await response.json();
        const container = document.getElementById('messages-container');
        container.innerHTML = '';
        
        if (messages.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Пока нет сообщений</p></div>';
            return;
        }
        
        messages.forEach(msg => displayMessage(msg));
        scrollToBottom();
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
        document.getElementById('messages-loading').textContent = 'Ошибка загрузки сообщений';
    }
}

// Отображение сообщения
function displayMessage(msg) {
    const container = document.getElementById('messages-container');
    const loading = document.getElementById('messages-loading');
    if (loading) loading.remove();
    
    // Проверяем, не отображается ли уже это сообщение
    const existingMessage = container.querySelector(`[data-message-id="${msg.id}"]`);
    if (existingMessage) {
        return; // Сообщение уже отображается
    }
    
    const isOwn = msg.user_id === currentUser.id;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    messageDiv.dataset.messageId = msg.id;
    
    const date = new Date(msg.created_at);
    const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    let mediaContent = '';
    if (msg.message_type === 'image' && msg.file_path) {
        mediaContent = `<img src="${msg.file_path}" alt="Изображение" class="message-media">`;
    } else if (msg.message_type === 'video' && msg.file_path) {
        mediaContent = `<video src="${msg.file_path}" controls class="message-media"></video>`;
    } else if (msg.message_type === 'audio' && msg.file_path) {
        mediaContent = `<audio src="${msg.file_path}" controls class="message-audio"></audio>`;
    }
    
    const avatar = msg.avatar 
        ? `<img src="${msg.avatar}" alt="${msg.username}" class="message-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
        : '';
    const avatarPlaceholder = `<div class="message-avatar-placeholder" style="${msg.avatar ? 'display: none;' : ''}">${msg.username[0].toUpperCase()}</div>`;
    
    messageDiv.innerHTML = `
        <div class="message-avatar-container">
            ${avatar}
            ${avatarPlaceholder}
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${escapeHtml(msg.username)}</span>
                <span class="message-time">${timeStr}</span>
            </div>
            <div class="message-bubble">
                ${msg.content ? escapeHtml(msg.content) : ''}
                ${mediaContent}
            </div>
        </div>
    `;
    
    container.appendChild(messageDiv);
    
    // Прокручиваем вниз только если пользователь уже внизу (чтобы не мешать чтению старых сообщений)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    if (isNearBottom || isOwn) {
        scrollToBottom();
    }
}

// Отправка сообщения
async function sendMessage(event) {
    event.preventDefault();
    
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content && selectedFiles.length === 0 && audioChunks.length === 0) {
        return;
    }
    
    const formData = new FormData();
    if (content) {
        formData.append('content', content);
    }
    
    // Добавляем файл (приоритет голосовому сообщению)
    if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice-message.webm', { type: 'audio/webm' });
        formData.append('file', audioFile);
        audioChunks = []; // Очищаем после добавления
    } else if (selectedFiles.length > 0) {
        // Отправляем первый выбранный файл
        formData.append('file', selectedFiles[0]);
        selectedFiles.shift(); // Удаляем отправленный файл
        updateFilePreview();
    }
    
    try {
        const response = await fetch(`${API_URL}/api/chat/message`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка отправки сообщения');
        }
        
        const result = await response.json();
        
        // Сообщение будет отображено через WebSocket для всех пользователей
        // Но сразу показываем у отправителя для мгновенной обратной связи
        displayMessage(result);
        
        input.value = '';
        // selectedFiles уже обновлены выше
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Обработка нажатия Enter
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage(event);
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Прикрепление файлов
    document.getElementById('attach-btn').addEventListener('click', () => {
        document.getElementById('file-input').click();
    });
    
    document.getElementById('file-input').addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
                selectedFiles.push(file);
            }
        });
        updateFilePreview();
    });
    
    // Голосовое сообщение
    const voiceBtn = document.getElementById('voice-btn');
    voiceBtn.addEventListener('mousedown', startRecording);
    voiceBtn.addEventListener('mouseup', stopRecording);
    voiceBtn.addEventListener('mouseleave', stopRecording);
}

// Начало записи голосового сообщения
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        isRecording = true;
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
            // Отправляем сообщение после завершения записи
            if (audioChunks.length > 0) {
                setTimeout(() => {
                    sendMessage({ preventDefault: () => {} });
                }, 200);
            }
        };
        
        mediaRecorder.start();
        
        // Показываем индикатор записи
        const indicator = document.getElementById('recording-indicator');
        if (indicator) {
            indicator.classList.add('active');
        }
        
        document.getElementById('voice-btn').style.background = 'rgba(220, 53, 69, 0.3)';
    } catch (error) {
        showNotification('Не удалось получить доступ к микрофону', 'error');
    }
}

// Остановка записи
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        // Скрываем индикатор записи
        const indicator = document.getElementById('recording-indicator');
        if (indicator) {
            indicator.classList.remove('active');
        }
        
        document.getElementById('voice-btn').style.background = '';
    }
}

// Обновление превью файлов
function updateFilePreview() {
    const preview = document.getElementById('file-preview');
    preview.innerHTML = '';
    
    if (selectedFiles.length === 0) {
        preview.style.display = 'none';
        return;
    }
    
    preview.style.display = 'flex';
    
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-preview-item';
        
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            item.appendChild(img);
        } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(file);
            video.controls = false;
            item.appendChild(video);
        } else {
            const div = document.createElement('div');
            div.textContent = file.name;
            div.style.cssText = 'width: 100px; height: 100px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); border-radius: 8px;';
            item.appendChild(div);
        }
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => {
            selectedFiles.splice(index, 1);
            updateFilePreview();
        };
        item.appendChild(removeBtn);
        preview.appendChild(item);
    });
}

// Прокрутка вниз
function scrollToBottom() {
    const container = document.getElementById('messages-container');
    if (container) {
        // Плавная прокрутка
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }
}

