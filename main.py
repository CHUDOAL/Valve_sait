from fastapi import FastAPI, HTTPException, Request, status, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.websockets import WebSocket, WebSocketDisconnect
from pydantic import BaseModel, EmailStr
from typing import List, Optional
import asyncio
from datetime import datetime, timedelta
import secrets
import hashlib
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from database import get_db, init_db, AsyncSessionLocal
from models import User as UserModel, Task as TaskModel, UserSession as SessionModel, Message as MessageModel, Role, TaskStatus
import os
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

# Инициализация OpenAI клиента
openai_client = None
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Создаем экземпляр FastAPI приложения
app = FastAPI(
    title="Valve Corporation Portal",
    description="Корпоративный портал компании Valve",
    version="2.0.0"
)

# Создаем папки для загрузок (перед монтированием)
import os
os.makedirs("uploads/avatars", exist_ok=True)
os.makedirs("uploads/chat/images", exist_ok=True)
os.makedirs("uploads/chat/videos", exist_ok=True)
os.makedirs("uploads/chat/audio", exist_ok=True)

# Настройка статических файлов и шаблонов
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# Pydantic модели для валидации
class RoleEnum(str, Enum):
    BOSS = "boss"
    EMPLOYEE = "employee"

class TaskStatusEnum(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"

class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: RoleEnum
    avatar: Optional[str] = None
    description: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    username: Optional[str] = None
    avatar: Optional[str] = None
    description: Optional[str] = None

class TaskBase(BaseModel):
    title: str
    description: str
    assigned_to_id: int

class TaskCreate(TaskBase):
    pass

class TaskResponse(TaskBase):
    id: int
    created_by_id: int
    status: TaskStatusEnum
    created_at: datetime
    
    class Config:
        from_attributes = True

class TaskUpdate(BaseModel):
    status: Optional[TaskStatusEnum] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# Хеширование паролей
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

# Создание сессии
async def create_session_db(user_id: int, db: AsyncSession) -> str:
    session_id = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    db_session = SessionModel(
        session_id=session_id,
        user_id=user_id,
        expires_at=expires_at
    )
    db.add(db_session)
    await db.commit()
    await db.refresh(db_session)
    
    return session_id

# Получение текущего пользователя
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> Optional[UserModel]:
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None
    
    # Проверяем сессию в БД
    result = await db.execute(
        select(SessionModel).where(
            SessionModel.session_id == session_id,
            SessionModel.expires_at > datetime.utcnow()
        )
    )
    db_session = result.scalar_one_or_none()
    
    if not db_session:
        return None
    
    # Получаем пользователя
    result = await db.execute(select(UserModel).where(UserModel.id == db_session.user_id))
    user = result.scalar_one_or_none()
    
    return user

# Проверка авторизации
async def require_auth(request: Request, db: AsyncSession = Depends(get_db)) -> UserModel:
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация"
        )
    return user

# Проверка роли начальника
async def require_boss(request: Request, db: AsyncSession = Depends(get_db)) -> UserModel:
    user = await require_auth(request, db)
    if user.role != Role.BOSS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен. Требуется роль начальника"
        )
    return user

# Создание тестового пользователя-начальника
async def create_test_users(db: AsyncSession):
    # Проверяем, есть ли уже начальник
    result = await db.execute(
        select(UserModel).where(UserModel.role == Role.BOSS)
    )
    boss = result.scalar_one_or_none()
    
    if not boss:
        boss = UserModel(
            username="admin",
            email="boss@valve.com",
            password_hash=hash_password("admin123"),
            role=Role.BOSS,
            avatar=None,
            description="Главный начальник компании Valve"
        )
        db.add(boss)
        await db.commit()
        await db.refresh(boss)

# Эндпоинты страниц
@app.get("/")
async def home(request: Request):
    """Главная страница о Valve"""
    async with AsyncSessionLocal() as db:
        user = await get_current_user(request, db)
        user_dict = None
        if user:
            user_dict = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "avatar": user.avatar,
                "description": user.description
            }
    return templates.TemplateResponse("index.html", {
        "request": request,
        "user": user_dict
    })

@app.get("/login")
async def login_page(request: Request):
    """Страница авторизации"""
    async with AsyncSessionLocal() as db:
        user = await get_current_user(request, db)
        if user:
            return RedirectResponse(url="/profile", status_code=303)
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/register")
async def register_page(request: Request):
    """Страница регистрации"""
    async with AsyncSessionLocal() as db:
        user = await get_current_user(request, db)
        if user:
            return RedirectResponse(url="/profile", status_code=303)
    return templates.TemplateResponse("register.html", {"request": request})

@app.get("/profile")
async def profile_page(request: Request):
    """Личный кабинет"""
    async with AsyncSessionLocal() as db:
        user = await require_auth(request, db)
        
        # Получаем задачи пользователя
        if user.role == Role.BOSS:
            result = await db.execute(
                select(TaskModel).where(TaskModel.created_by_id == user.id)
                .options(selectinload(TaskModel.assignee))
            )
            user_tasks = result.scalars().all()
        else:
            result = await db.execute(
                select(TaskModel).where(TaskModel.assigned_to_id == user.id)
                .options(selectinload(TaskModel.creator))
            )
            user_tasks = result.scalars().all()
        
        user_dict = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "avatar": user.avatar,
            "description": user.description
        }
        
        tasks_list = []
        for task in user_tasks:
            tasks_list.append({
                "id": task.id,
                "title": task.title,
                "description": task.description,
                "status": task.status,
                "created_by_id": task.created_by_id,
                "assigned_to_id": task.assigned_to_id,
                "created_at": task.created_at
            })
    
    return templates.TemplateResponse("profile.html", {
        "request": request,
        "user": user_dict,
        "tasks": tasks_list
    })

# API эндпоинты
@app.post("/api/register")
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Регистрация нового пользователя"""
    # Проверка на существующий email
    result = await db.execute(select(UserModel).where(UserModel.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    # Проверка на существующий username
    result = await db.execute(select(UserModel).where(UserModel.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь с таким никнеймом уже существует")
    
    new_user = UserModel(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role.value,
        avatar=user_data.avatar,
        description=user_data.description
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # Создаем сессию
    session_id = await create_session_db(new_user.id, db)
    
    response = JSONResponse({
        "message": "Регистрация успешна",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "role": new_user.role
        }
    })
    response.set_cookie(key="session_id", value=session_id, httponly=True)
    
    return response

@app.post("/api/login")
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Авторизация"""
    result = await db.execute(select(UserModel).where(UserModel.email == credentials.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    
    # Создаем сессию
    session_id = await create_session_db(user.id, db)
    
    response = JSONResponse({
        "message": "Авторизация успешна",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    })
    response.set_cookie(key="session_id", value=session_id, httponly=True)
    
    return response

@app.post("/api/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    """Выход из системы"""
    session_id = request.cookies.get("session_id")
    if session_id:
        await db.execute(
            delete(SessionModel).where(SessionModel.session_id == session_id)
        )
        await db.commit()
    
    response = JSONResponse({"message": "Выход выполнен"})
    response.delete_cookie(key="session_id")
    return response

@app.get("/api/user")
async def get_current_user_api(request: Request, db: AsyncSession = Depends(get_db)):
    """Получить текущего пользователя"""
    user = await get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="Не авторизован")
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "avatar": user.avatar,
        "description": user.description
    }

@app.post("/api/upload-avatar")
async def upload_avatar(file: UploadFile = File(...), request: Request = None, db: AsyncSession = Depends(get_db)):
    """Загрузка аватарки пользователя"""
    user = await require_auth(request, db)
    
    # Проверяем тип файла
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Файл должен быть изображением")
    
    # Генерируем уникальное имя файла
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{user.id}_{secrets.token_urlsafe(8)}{file_ext}"
    filepath = os.path.join("uploads/avatars", filename)
    
    # Сохраняем файл
    with open(filepath, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    # Удаляем старый аватар если есть
    if user.avatar and user.avatar.startswith("/uploads/avatars/"):
        old_filepath = user.avatar.replace("/uploads/", "uploads/")
        if os.path.exists(old_filepath):
            os.remove(old_filepath)
    
    # Обновляем путь к аватару в БД
    avatar_url = f"/uploads/avatars/{filename}"
    user.avatar = avatar_url
    await db.commit()
    await db.refresh(user)
    
    return {
        "avatar": avatar_url,
        "message": "Аватарка успешно загружена"
    }

@app.patch("/api/user")
async def update_user(user_update: UserUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    """Обновить профиль пользователя"""
    user = await require_auth(request, db)
    
    if user_update.username:
        # Проверка на уникальность username
        result = await db.execute(
            select(UserModel).where(
                UserModel.username == user_update.username,
                UserModel.id != user.id
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Пользователь с таким никнеймом уже существует")
        user.username = user_update.username
    
    if user_update.description is not None:
        user.description = user_update.description
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "avatar": user.avatar,
        "description": user.description
    }

@app.get("/api/users")
async def get_users(request: Request, db: AsyncSession = Depends(get_db)):
    """Получить список пользователей (для начальника)"""
    user = await require_boss(request, db)
    
    # Возвращаем только подчиненных
    result = await db.execute(select(UserModel).where(UserModel.role == Role.EMPLOYEE))
    employees = result.scalars().all()
    
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "avatar": u.avatar,
            "description": u.description
        }
        for u in employees
    ]

@app.get("/api/user/{user_id}")
async def get_user_by_id(user_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Получить пользователя по ID"""
    await require_auth(request, db)
    
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "avatar": user.avatar,
        "description": user.description
    }

@app.post("/api/tasks")
async def create_task(task_data: TaskCreate, request: Request, db: AsyncSession = Depends(get_db)):
    """Создать задачу (только для начальника)"""
    user = await require_boss(request, db)
    
    # Проверяем, что назначенный пользователь существует и является подчиненным
    result = await db.execute(select(UserModel).where(UserModel.id == task_data.assigned_to_id))
    assigned_user = result.scalar_one_or_none()
    
    if not assigned_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if assigned_user.role != Role.EMPLOYEE:
        raise HTTPException(status_code=400, detail="Можно назначать задачи только подчиненным")
    
    new_task = TaskModel(
        title=task_data.title,
        description=task_data.description,
        created_by_id=user.id,
        assigned_to_id=task_data.assigned_to_id,
        status=TaskStatus.PENDING
    )
    
    db.add(new_task)
    await db.commit()
    await db.refresh(new_task)
    
    return {
        "id": new_task.id,
        "title": new_task.title,
        "description": new_task.description,
        "created_by_id": new_task.created_by_id,
        "assigned_to_id": new_task.assigned_to_id,
        "status": new_task.status,
        "created_at": new_task.created_at
    }

@app.get("/api/tasks")
async def get_tasks(request: Request, db: AsyncSession = Depends(get_db)):
    """Получить задачи пользователя"""
    user = await require_auth(request, db)
    
    if user.role == Role.BOSS:
        result = await db.execute(
            select(TaskModel).where(TaskModel.created_by_id == user.id)
            .options(selectinload(TaskModel.assignee))
        )
    else:
        result = await db.execute(
            select(TaskModel).where(TaskModel.assigned_to_id == user.id)
            .options(selectinload(TaskModel.creator))
        )
    
    tasks = result.scalars().all()
    
    return [
        {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "created_by_id": t.created_by_id,
            "assigned_to_id": t.assigned_to_id,
            "status": t.status,
            "created_at": t.created_at
        }
        for t in tasks
    ]

@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: int, task_update: TaskUpdate, request: Request, db: AsyncSession = Depends(get_db)):
    """Обновить задачу"""
    user = await require_auth(request, db)
    
    result = await db.execute(select(TaskModel).where(TaskModel.id == task_id))
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    
    # Подчиненный может менять только статус своих задач
    if user.role == Role.EMPLOYEE:
        if task.assigned_to_id != user.id:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        if task_update.status is None:
            raise HTTPException(status_code=400, detail="Можно изменить только статус")
        task.status = task_update.status.value
    else:
        # Начальник может менять все поля задачи
        if task.created_by_id != user.id:
            raise HTTPException(status_code=403, detail="Недостаточно прав")
        if task_update.status is not None:
            task.status = task_update.status.value
    
    await db.commit()
    await db.refresh(task)
    
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "created_by_id": task.created_by_id,
        "assigned_to_id": task.assigned_to_id,
        "status": task.status,
        "created_at": task.created_at
    }

# WebSocket соединения для чата
active_connections: List[WebSocket] = []

@app.get("/chat")
async def chat_page(request: Request):
    """Страница чата"""
    async with AsyncSessionLocal() as db:
        user = await require_auth(request, db)
        
        user_dict = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "avatar": user.avatar,
            "description": user.description
        }
    
    return templates.TemplateResponse("chat.html", {
        "request": request,
        "user": user_dict
    })

@app.get("/games")
async def games_page(request: Request):
    """Страница с играми"""
    async with AsyncSessionLocal() as db:
        user = await get_current_user(request, db)
        user_dict = None
        if user:
            user_dict = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "avatar": user.avatar,
                "description": user.description
            }
    
    return templates.TemplateResponse("games.html", {
        "request": request,
        "user": user_dict
    })

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket эндпоинт для чата"""
    await websocket.accept()
    active_connections.append(websocket)
    
    try:
        while True:
            # Ждем сообщения от клиента (для ping/pong или других команд)
            data = await websocket.receive_json()
            # Обрабатываем ping/pong для поддержания соединения
            if data.get('type') == 'ping':
                await websocket.send_json({'type': 'pong'})
            # Основные сообщения отправляются через HTTP POST и рассылаются сервером
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
    except Exception as e:
        print(f"WebSocket ошибка: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)

@app.post("/api/chat/message")
async def send_message(
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """Отправка сообщения в чат"""
    user = await require_auth(request, db)
    
    # Обрабатываем файл
    file_path = None
    message_type = "text"
    
    if file:
        # Определяем тип файла
        if file.content_type.startswith('image/'):
            message_type = "image"
            folder = "chat/images"
        elif file.content_type.startswith('video/'):
            message_type = "video"
            folder = "chat/videos"
        elif file.content_type.startswith('audio/'):
            message_type = "audio"
            folder = "chat/audio"
        else:
            raise HTTPException(status_code=400, detail="Неподдерживаемый тип файла")
        
        # Создаем папку если не существует
        os.makedirs(f"uploads/{folder}", exist_ok=True)
        
        # Сохраняем файл
        file_ext = os.path.splitext(file.filename)[1]
        filename = f"{user.id}_{secrets.token_urlsafe(8)}_{int(datetime.now().timestamp())}{file_ext}"
        file_path_save = os.path.join(f"uploads/{folder}", filename)
        
        # Читаем и сохраняем файл
        content_file = await file.read()
        with open(file_path_save, "wb") as buffer:
            buffer.write(content_file)
        
        file_path = f"/uploads/{folder}/{filename}"
    
    # Создаем сообщение в БД
    message = MessageModel(
        user_id=user.id,
        content=content,
        message_type=message_type,
        file_path=file_path
    )
    
    db.add(message)
    await db.commit()
    await db.refresh(message)
    
    # Получаем информацию о пользователе
    result = await db.execute(select(UserModel).where(UserModel.id == user.id))
    user_obj = result.scalar_one_or_none()
    
    # Отправляем через WebSocket всем подключенным
    message_data = {
        "id": message.id,
        "user_id": user.id,
        "username": user_obj.username,
        "avatar": user_obj.avatar,
        "content": message.content,
        "message_type": message.message_type,
        "file_path": message.file_path,
        "created_at": message.created_at.isoformat()
    }
    
    # Отправляем всем подключенным клиентам (включая отправителя для синхронизации)
    for connection in active_connections:
        try:
            await connection.send_json(message_data)
        except:
            # Если соединение закрыто, удаляем его из списка
            if connection in active_connections:
                active_connections.remove(connection)
    
    return message_data

@app.get("/api/chat/messages")
async def get_messages(request: Request, db: AsyncSession = Depends(get_db)):
    """Получить сообщения чата"""
    await require_auth(request, db)
    
    result = await db.execute(
        select(MessageModel)
        .options(selectinload(MessageModel.user))
        .order_by(MessageModel.created_at.desc())
        .limit(50)
    )
    messages = result.scalars().all()
    
    return [
        {
            "id": msg.id,
            "user_id": msg.user_id,
            "username": msg.user.username,
            "avatar": msg.user.avatar,
            "content": msg.content,
            "message_type": msg.message_type,
            "file_path": msg.file_path,
            "created_at": msg.created_at.isoformat()
        }
        for msg in reversed(messages)
    ]

@app.post("/api/chat/ai")
async def chat_with_ai(
    message: str = Form(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """Отправка сообщения ИИ и получение ответа"""
    user = await require_auth(request, db)
    
    if not openai_client:
        raise HTTPException(
            status_code=503, 
            detail="OpenAI API не настроен. Укажите OPENAI_API_KEY в переменных окружения."
        )
    
    try:
        # Получаем последние сообщения для контекста
        result = await db.execute(
            select(MessageModel)
            .where(MessageModel.message_type == "text")
            .order_by(MessageModel.created_at.desc())
            .limit(10)
        )
        recent_messages = result.scalars().all()
        
        # Формируем контекст из последних сообщений
        context = []
        for msg in reversed(recent_messages):
            result_user = await db.execute(select(UserModel).where(UserModel.id == msg.user_id))
            msg_user = result_user.scalar_one_or_none()
            if msg_user:
                context.append({
                    "role": "user",
                    "content": f"{msg_user.username}: {msg.content}"
                })
        
        # Добавляем текущее сообщение
        context.append({
            "role": "user",
            "content": f"{user.username}: {message}"
        })
        
        # Вызываем OpenAI API (используем o1-mini, если доступен, иначе gpt-4o-mini)
        try:
            response = openai_client.chat.completions.create(
                model="o1-mini",  # Используем o1-mini
                messages=[
                    {
                        "role": "system",
                        "content": "Ты полезный AI-ассистент в корпоративном чате компании Valve. Отвечай кратко, дружелюбно и профессионально. Помогай сотрудникам с вопросами."
                    }
                ] + [
                    {"role": msg["role"], "content": msg["content"]}
                    for msg in context[-5:]  # Берем последние 5 сообщений для контекста
                ],
                max_tokens=500,
                temperature=0.7
            )
        except Exception as e:
            # Если o1-mini недоступен, используем gpt-4o-mini
            if "o1-mini" in str(e).lower():
                response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {
                            "role": "system",
                            "content": "Ты полезный AI-ассистент в корпоративном чате компании Valve. Отвечай кратко, дружелюбно и профессионально. Помогай сотрудникам с вопросами."
                        }
                    ] + [
                        {"role": msg["role"], "content": msg["content"]}
                        for msg in context[-5:]
                    ],
                    max_tokens=500,
                    temperature=0.7
                )
            else:
                raise
        
        ai_response = response.choices[0].message.content
        
        # Сохраняем сообщение пользователя
        user_message = MessageModel(
            user_id=user.id,
            content=message,
            message_type="text"
        )
        db.add(user_message)
        
        # Сохраняем ответ ИИ (создаем виртуального пользователя для ИИ или используем специальный ID)
        ai_message = MessageModel(
            user_id=user.id,  # Временно используем ID текущего пользователя, можно создать отдельного пользователя для ИИ
            content=f"🤖 AI: {ai_response}",
            message_type="text"
        )
        db.add(ai_message)
        await db.commit()
        await db.refresh(ai_message)
        
        # Получаем информацию о пользователе
        result_user = await db.execute(select(UserModel).where(UserModel.id == user.id))
        user_obj = result_user.scalar_one_or_none()
        
        # Отправляем оба сообщения через WebSocket
        user_message_data = {
            "id": user_message.id,
            "user_id": user.id,
            "username": user_obj.username,
            "avatar": user_obj.avatar,
            "content": user_message.content,
            "message_type": "text",
            "file_path": None,
            "created_at": user_message.created_at.isoformat()
        }
        
        ai_message_data = {
            "id": ai_message.id,
            "user_id": user.id,
            "username": "AI Assistant",
            "avatar": None,
            "content": ai_message.content,
            "message_type": "text",
            "file_path": None,
            "created_at": ai_message.created_at.isoformat()
        }
        
        # Отправляем всем подключенным клиентам
        for connection in active_connections:
            try:
                await connection.send_json(user_message_data)
                await connection.send_json(ai_message_data)
            except:
                if connection in active_connections:
                    active_connections.remove(connection)
        
        return {
            "user_message": user_message_data,
            "ai_message": ai_message_data
        }
        
    except Exception as e:
        print(f"Ошибка OpenAI API: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка при обращении к OpenAI API: {str(e)}"
        )

@app.on_event("startup")
async def startup_event():
    """Инициализация БД и создание тестового пользователя при запуске"""
    await init_db()
    async with AsyncSessionLocal() as db:
        await create_test_users(db)

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
