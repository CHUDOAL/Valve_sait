from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

# URL подключения к SQLite
# SQLite - файловая база данных, не требует отдельного сервера
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./valve_portal.db"
)

# Создаем движок базы данных
# Для SQLite нужны специальные параметры для работы с async
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
engine = create_async_engine(DATABASE_URL, echo=True, connect_args=connect_args)

# Создаем фабрику сессий
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Базовый класс для моделей
Base = declarative_base()


# Функция для получения сессии БД
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Функция для создания таблиц
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

