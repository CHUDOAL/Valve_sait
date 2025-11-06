const API_URL = '';

// Утилиты
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Авторизация
async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка авторизации');
        }
        
        const result = await response.json();
        showNotification('Авторизация успешна!', 'success');
        setTimeout(() => {
            window.location.href = '/profile';
        }, 500);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Регистрация
async function handleRegister(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role'),
        avatar: null,
        description: null
    };
    
    try {
        const response = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка регистрации');
        }
        
        const result = await response.json();
        showNotification('Регистрация успешна!', 'success');
        setTimeout(() => {
            window.location.href = '/profile';
        }, 500);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Выход
async function logout() {
    try {
        const response = await fetch(`${API_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            showNotification('Выход выполнен', 'success');
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        }
    } catch (error) {
        showNotification('Ошибка при выходе', 'error');
    }
}

// Профиль - редактирование
function showEditForm() {
    document.getElementById('edit-form').style.display = 'block';
    document.getElementById('edit-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideEditForm() {
    document.getElementById('edit-form').style.display = 'none';
}

async function handleProfileUpdate(event) {
    event.preventDefault();
    
    const data = {
        username: document.getElementById('edit-username').value,
        description: document.getElementById('edit-description').value || null
    };
    
    try {
        const response = await fetch(`${API_URL}/api/user`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка при обновлении профиля');
        }
        
        const result = await response.json();
        showNotification('Профиль обновлен!', 'success');
        
        // Обновляем данные на странице
        document.getElementById('profile-username').textContent = result.username;
        const avatarImg = document.getElementById('avatar-img');
        const avatarPlaceholder = document.getElementById('avatar-placeholder');
        if (result.avatar) {
            if (avatarImg) {
                avatarImg.src = result.avatar;
                avatarImg.style.display = 'block';
                if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
            } else {
                // Создаем img если его нет
                const newImg = document.createElement('img');
                newImg.id = 'avatar-img';
                newImg.src = result.avatar;
                newImg.alt = 'Avatar';
                newImg.style.cssText = 'width: 120px; height: 120px; border-radius: 50%; border: 3px solid #ff6b35; object-fit: cover;';
                newImg.onerror = function() {
                    this.style.display = 'none';
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'flex';
                };
                const avatarContainer = document.querySelector('.profile-avatar');
                if (avatarPlaceholder) {
                    avatarPlaceholder.before(newImg);
                    avatarPlaceholder.style.display = 'none';
                }
            }
        } else {
            if (avatarImg) avatarImg.style.display = 'none';
            if (avatarPlaceholder) {
                avatarPlaceholder.textContent = result.username[0].toUpperCase();
                avatarPlaceholder.style.display = 'flex';
            }
        }
        if (result.description) {
            document.getElementById('profile-description').textContent = result.description;
        }
        
        hideEditForm();
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Загрузка аватарки
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Файл должен быть изображением', 'error');
        return;
    }
    
    // Ограничение размера файла (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Файл слишком большой (максимум 5MB)', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_URL}/api/upload-avatar`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка при загрузке аватарки');
        }
        
        const result = await response.json();
        showNotification('Аватарка загружена!', 'success');
        
        // Обновляем аватар на странице
        const avatarImg = document.getElementById('avatar-img');
        const avatarPlaceholder = document.getElementById('avatar-placeholder');
        
        if (result.avatar) {
            if (avatarImg) {
                avatarImg.src = result.avatar;
                avatarImg.style.display = 'block';
                if (avatarPlaceholder) avatarPlaceholder.style.display = 'none';
            } else {
                const newImg = document.createElement('img');
                newImg.id = 'avatar-img';
                newImg.src = result.avatar;
                newImg.alt = 'Avatar';
                newImg.style.cssText = 'width: 120px; height: 120px; border-radius: 50%; border: 3px solid #ff6b35; object-fit: cover;';
                newImg.onerror = function() {
                    this.style.display = 'none';
                    if (avatarPlaceholder) avatarPlaceholder.style.display = 'flex';
                };
                const avatarContainer = document.querySelector('.profile-avatar');
                if (avatarPlaceholder) {
                    avatarPlaceholder.before(newImg);
                    avatarPlaceholder.style.display = 'none';
                }
            }
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function editAvatar() {
    document.getElementById('edit-avatar-file').click();
}

function editDescription() {
    document.getElementById('edit-description').value = document.getElementById('profile-description').textContent;
    showEditForm();
}

// Задачи - для начальника
async function loadEmployees() {
    try {
        const response = await fetch(`${API_URL}/api/users`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка при загрузке сотрудников');
        }
        
        const employees = await response.json();
        const select = document.getElementById('task-assigned');
        select.innerHTML = '<option value="">Выберите подчиненного</option>';
        
        employees.forEach(employee => {
            const option = document.createElement('option');
            option.value = employee.id;
            option.textContent = employee.username;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка загрузки сотрудников:', error);
    }
}

function showTaskForm() {
    if (typeof userRole !== 'undefined' && userRole === 'boss') {
        loadEmployees();
        document.getElementById('task-form').style.display = 'block';
        document.getElementById('task-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function hideTaskForm() {
    document.getElementById('task-form').style.display = 'none';
    document.getElementById('task-form').querySelector('form').reset();
}

async function handleTaskCreate(event) {
    event.preventDefault();
    
    const data = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        assigned_to_id: parseInt(document.getElementById('task-assigned').value)
    };
    
    try {
        const response = await fetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка при создании задачи');
        }
        
        const result = await response.json();
        showNotification('Задача создана!', 'success');
        hideTaskForm();
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Задачи - обновление статуса
async function updateTaskStatus(taskId, status) {
    try {
        const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: status }),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка при обновлении задачи');
        }
        
        const result = await response.json();
        showNotification('Статус задачи обновлен!', 'success');
        
        // Обновляем бейдж статуса
        const taskCard = document.querySelector(`[data-task-id="${taskId}"]`);
        if (taskCard) {
            const badge = taskCard.querySelector('.badge-status');
            if (badge) {
                badge.className = `badge badge-status badge-${status}`;
                const statusText = {
                    'pending': 'В ожидании',
                    'in_progress': 'В работе',
                    'completed': 'Выполнено'
                };
                badge.textContent = statusText[status] || status;
            }
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// Загрузка имен пользователей для задач
async function loadTaskUserNames() {
    try {
        const taskCards = document.querySelectorAll('.task-card');
        
        for (const card of taskCards) {
            const taskId = card.dataset.taskId;
            const assignedNameEl = card.querySelector(`#assigned-name-${taskId}`);
            const creatorNameEl = card.querySelector(`#creator-name-${taskId}`);
            
            if (assignedNameEl || creatorNameEl) {
                // Получаем задачи из API
                const response = await fetch(`${API_URL}/api/tasks`, {
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const tasks = await response.json();
                    const task = tasks.find(t => t.id === parseInt(taskId));
                    
                    if (task) {
                        // Для начальника - имя назначенного
                        if (assignedNameEl && typeof userRole !== 'undefined' && userRole === 'boss') {
                            try {
                                const userResponse = await fetch(`${API_URL}/api/user/${task.assigned_to_id}`, {
                                    credentials: 'include'
                                });
                                if (userResponse.ok) {
                                    const user = await userResponse.json();
                                    assignedNameEl.textContent = user.username;
                                } else {
                                    assignedNameEl.textContent = 'Неизвестно';
                                }
                            } catch (error) {
                                assignedNameEl.textContent = 'Неизвестно';
                            }
                        }
                        
                        // Для подчиненного - имя создателя
                        if (creatorNameEl && typeof userRole !== 'undefined' && userRole === 'employee') {
                            try {
                                const userResponse = await fetch(`${API_URL}/api/user/${task.created_by_id}`, {
                                    credentials: 'include'
                                });
                                if (userResponse.ok) {
                                    const user = await userResponse.json();
                                    creatorNameEl.textContent = user.username;
                                } else {
                                    creatorNameEl.textContent = 'Начальник';
                                }
                            } catch (error) {
                                creatorNameEl.textContent = 'Начальник';
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки имен:', error);
    }
}

// Инициализация на странице профиля
if (document.querySelector('.profile-main')) {
    if (typeof userRole !== 'undefined' && userRole === 'boss') {
        // Загружаем сотрудников при открытии формы
        const taskForm = document.getElementById('task-form');
        if (taskForm) {
            const observer = new MutationObserver((mutations) => {
                if (taskForm.style.display === 'block') {
                    loadEmployees();
                }
            });
            observer.observe(taskForm, { attributes: true, attributeFilter: ['style'] });
        }
    }
    
    // Загружаем имена пользователей для задач
    loadTaskUserNames();
}
