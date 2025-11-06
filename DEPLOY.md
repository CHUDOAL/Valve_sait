# Инструкция по деплою на хостинг

## Варианты хостинга

### 1. Render.com (Рекомендуется - бесплатный план)

#### Шаги:

1. **Создайте аккаунт на [Render.com](https://render.com)**

2. **Подготовьте файлы для деплоя:**

   Файлы уже созданы в проекте:
   - `render.yaml` - конфигурация для Render
   - `.python-version` - версия Python (3.11)
   - `requirements.txt` - зависимости
   
   Если нужно создать вручную, файл `render.yaml`:
   ```yaml
   services:
     - type: web
       name: valve-portal
       env: python
       runtime: python-3.11
       buildCommand: pip install --upgrade pip && pip install -r requirements.txt
       startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
   
   И файл `.python-version` с содержимым: `3.11`

3. **Загрузите проект на GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/ваш-username/valve-portal.git
   git push -u origin main
   ```

4. **На Render.com:**
   - Нажмите "New +" → "Web Service"
   - Подключите ваш GitHub репозиторий
   - Выберите репозиторий
   - Настройки:
     - **Name:** valve-portal
     - **Environment:** Python 3
     - **Python Version:** 3.11 (важно! Не используйте 3.13)
     - **Build Command:** `pip install --upgrade pip && pip install -r requirements.txt`
     - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Нажмите "Create Web Service"

5. **Важно для Render:**
   - **ОБЯЗАТЕЛЬНО укажите Python 3.11 в настройках!** (не 3.13)
   - В настройках сервиса найдите "Python Version" и выберите 3.11
   - Или создайте файл `.python-version` с содержимым `3.11` (уже создан)
   - Render автоматически назначает порт через переменную `$PORT`
   - SQLite будет работать, но данные могут теряться при перезапуске
   - Для постоянного хранения используйте PostgreSQL (бесплатный план)
   
6. **Если возникает ошибка с pydantic-core:**
   - Убедитесь, что используется Python 3.11 (не 3.13)
   - Проверьте, что файл `.python-version` содержит `3.11`
   - В настройках Render явно укажите Python 3.11

---

### 2. Railway.app (Простой деплой)

#### Шаги:

1. **Создайте аккаунт на [Railway.app](https://railway.app)**

2. **Установите Railway CLI:**
   ```bash
   npm i -g @railway/cli
   railway login
   ```

3. **Деплой:**
   ```bash
   railway init
   railway up
   ```

4. **Или через веб-интерфейс:**
   - Нажмите "New Project"
   - Выберите "Deploy from GitHub repo"
   - Подключите репозиторий
   - Railway автоматически определит Python и запустит приложение

5. **Настройте переменные окружения:**
   - В настройках проекта добавьте переменные если нужно

---

### 3. PythonAnywhere (Бесплатный план)

#### Шаги:

1. **Создайте аккаунт на [PythonAnywhere.com](https://www.pythonanywhere.com)**

2. **Загрузите файлы:**
   - Используйте встроенный файловый менеджер
   - Или загрузите через Git:
     ```bash
     git clone https://github.com/ваш-username/valve-portal.git
     ```

3. **Настройте веб-приложение:**
   - Перейдите в раздел "Web"
   - Нажмите "Add a new web app"
   - Выберите "Manual configuration"
   - Выберите Python 3.10
   - В "Source code" укажите путь к проекту

4. **Настройте WSGI файл:**
   Создайте файл `valve_portal_wsgi.py`:
   ```python
   import sys
   import os
   
   path = '/home/ваш-username/valve-portal'
   if path not in sys.path:
       sys.path.insert(0, path)
   
   os.chdir(path)
   
   from main import app
   application = app
   ```

5. **Установите зависимости:**
   - Откройте Bash консоль
   - Выполните: `pip3.10 install --user -r requirements.txt`

6. **Настройте статические файлы:**
   - В настройках Web app:
     - Static files: `/static` → `/home/ваш-username/valve-portal/static`
     - Static files: `/uploads` → `/home/ваш-username/valve-portal/uploads`

7. **Перезагрузите приложение**

**Ограничения PythonAnywhere:**
- WebSocket не поддерживается на бесплатном плане
- Нужно будет отключить чат или использовать только HTTP

---

### 4. Heroku (Платный, но простой)

#### Шаги:

1. **Установите Heroku CLI:**
   ```bash
   # Windows
   # Скачайте с https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Создайте файлы для Heroku:**

   `Procfile`:
   ```
   web: uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

   `runtime.txt`:
   ```
   python-3.11.0
   ```

3. **Деплой:**
   ```bash
   heroku login
   heroku create valve-portal
   git push heroku main
   heroku open
   ```

---

### 5. VPS (DigitalOcean, AWS, Hetzner)

#### Шаги:

1. **Создайте VPS сервер** (Ubuntu 22.04)

2. **Подключитесь по SSH:**
   ```bash
   ssh root@ваш-ip
   ```

3. **Установите зависимости:**
   ```bash
   apt update
   apt install python3 python3-pip nginx supervisor git -y
   ```

4. **Клонируйте проект:**
   ```bash
   cd /var/www
   git clone https://github.com/ваш-username/valve-portal.git
   cd valve-portal
   pip3 install -r requirements.txt
   ```

5. **Настройте systemd сервис:**

   Создайте `/etc/systemd/system/valve-portal.service`:
   ```ini
   [Unit]
   Description=Valve Portal FastAPI Application
   After=network.target

   [Service]
   User=www-data
   Group=www-data
   WorkingDirectory=/var/www/valve-portal
   Environment="PATH=/usr/bin:/usr/local/bin"
   ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

6. **Запустите сервис:**
   ```bash
   systemctl daemon-reload
   systemctl enable valve-portal
   systemctl start valve-portal
   ```

7. **Настройте Nginx:**

   Создайте `/etc/nginx/sites-available/valve-portal`:
   ```nginx
   server {
       listen 80;
       server_name ваш-домен.com;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       location /ws {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }

       location /static {
           alias /var/www/valve-portal/static;
       }

       location /uploads {
           alias /var/www/valve-portal/uploads;
       }
   }
   ```

8. **Активируйте конфигурацию:**
   ```bash
   ln -s /etc/nginx/sites-available/valve-portal /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

9. **Настройте SSL (Let's Encrypt):**
   ```bash
   apt install certbot python3-certbot-nginx -y
   certbot --nginx -d ваш-домен.com
   ```

---

## Важные замечания

### 1. База данных SQLite
- SQLite работает локально
- На некоторых хостингах данные могут теряться
- Для продакшена лучше использовать PostgreSQL

### 2. Загруженные файлы
- Папка `uploads/` должна сохраняться между перезапусками
- На некоторых хостингах нужно использовать внешнее хранилище (S3, Cloudinary)

### 3. WebSocket
- Не все хостинги поддерживают WebSocket на бесплатном плане
- Проверьте поддержку перед деплоем

### 4. Переменные окружения
- Создайте файл `.env` для локальной разработки
- На хостинге настройте переменные окружения через панель управления

### 5. Безопасность
- Измените секретный ключ для сессий
- Используйте HTTPS в продакшене
- Настройте CORS если нужно

---

## Миграция на PostgreSQL (рекомендуется для продакшена)

Если хотите использовать PostgreSQL вместо SQLite:

1. **Измените `database.py`:**
   ```python
   from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
   from sqlalchemy.orm import sessionmaker
   import os
   from dotenv import load_dotenv

   load_dotenv()

   DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost/dbname")

   engine = create_async_engine(DATABASE_URL, echo=True)
   AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
   ```

2. **Обновите `requirements.txt`:**
   ```
   asyncpg>=0.29.0
   ```

3. **Настройте переменную окружения `DATABASE_URL` на хостинге**

---

## Быстрый старт (Render.com)

1. Загрузите проект на GitHub
2. Зайдите на Render.com
3. Создайте новый Web Service
4. Подключите GitHub репозиторий
5. Используйте настройки из раздела выше
6. Дождитесь деплоя
7. Готово! 🎉

---

## Поддержка

Если возникли проблемы:
1. Проверьте логи на хостинге
2. Убедитесь, что все зависимости установлены
3. Проверьте переменные окружения
4. Убедитесь, что порт настроен правильно

