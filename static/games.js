// Управление играми
let currentGame = null;
let gameInterval = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.games-main')) {
        // Инициализация завершена
    }
});

// Начать игру
function startGame(gameType) {
    currentGame = gameType;
    const gameArea = document.getElementById('game-area');
    const gameContent = document.getElementById('game-content');
    const gameTitle = document.getElementById('current-game-title');
    const gamesGrid = document.querySelector('.games-grid');
    
    // Скрываем сетку игр и показываем игровую область
    if (gamesGrid) gamesGrid.style.display = 'none';
    gameArea.style.display = 'block';
    
    // Очищаем предыдущую игру
    gameContent.innerHTML = '';
    
    // Запускаем выбранную игру
    switch(gameType) {
        case 'tic-tac-toe':
            gameTitle.textContent = '⭕ Крестики-нолики';
            initTicTacToe();
            break;
        case 'snake':
            gameTitle.textContent = '🐍 Змейка';
            initSnake();
            break;
        case 'clicker':
            gameTitle.textContent = '🖱️ Кликер';
            initClicker();
            break;
        case 'platformer':
            gameTitle.textContent = '🎮 Платформер';
            initPlatformer();
            break;
    }
}

// Вернуться к выбору игр
function backToGames() {
    const gameArea = document.getElementById('game-area');
    const gamesGrid = document.querySelector('.games-grid');
    
    gameArea.style.display = 'none';
    if (gamesGrid) gamesGrid.style.display = 'grid';
    
    // Останавливаем игру если нужно
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    if (snakeGame) {
        clearInterval(snakeGame);
        snakeGame = null;
    }
    
    // Удаляем обработчики событий
    document.removeEventListener('keydown', handleSnakeKeyPress);
    document.removeEventListener('keydown', handlePlatformerKeyPress);
    document.removeEventListener('keyup', handlePlatformerKeyUp);
    
    if (platformerGame) {
        cancelAnimationFrame(platformerGame);
        platformerGame = null;
    }
    
    currentGame = null;
}

// ========== КРЕСТИКИ-НОЛИКИ ==========
let ticTacToeBoard = ['', '', '', '', '', '', '', '', ''];
let ticTacToeCurrentPlayer = 'X';
let ticTacToeGameOver = false;

function initTicTacToe() {
    ticTacToeBoard = ['', '', '', '', '', '', '', '', ''];
    ticTacToeCurrentPlayer = 'X';
    ticTacToeGameOver = false;
    
    const gameContent = document.getElementById('game-content');
    const scoreDiv = document.getElementById('game-score');
    scoreDiv.innerHTML = '<span>Ход игрока: <strong id="current-player">X</strong></span>';
    
    gameContent.innerHTML = `
        <div class="tic-tac-toe-board" id="tic-tac-toe-board"></div>
        <div class="tic-tac-toe-info">
            <h3 id="tic-tac-toe-status">Ход игрока: <span id="current-player-display">X</span></h3>
            <button class="btn btn-primary" onclick="resetTicTacToe()">Новая игра</button>
        </div>
    `;
    
    const board = document.getElementById('tic-tac-toe-board');
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'tic-tac-toe-cell';
        cell.dataset.index = i;
        cell.onclick = () => makeMove(i);
        board.appendChild(cell);
    }
}

function makeMove(index) {
    if (ticTacToeGameOver || ticTacToeBoard[index] !== '') {
        return;
    }
    
    ticTacToeBoard[index] = ticTacToeCurrentPlayer;
    updateTicTacToeDisplay();
    
    if (checkTicTacToeWinner()) {
        ticTacToeGameOver = true;
        document.getElementById('tic-tac-toe-status').innerHTML = 
            `<h3 style="color: var(--success);">Игрок ${ticTacToeCurrentPlayer} победил! 🎉</h3>`;
        return;
    }
    
    if (ticTacToeBoard.every(cell => cell !== '')) {
        ticTacToeGameOver = true;
        document.getElementById('tic-tac-toe-status').innerHTML = 
            `<h3 style="color: var(--warning);">Ничья! 🤝</h3>`;
        return;
    }
    
    ticTacToeCurrentPlayer = ticTacToeCurrentPlayer === 'X' ? 'O' : 'X';
    document.getElementById('current-player-display').textContent = ticTacToeCurrentPlayer;
    document.getElementById('current-player').textContent = ticTacToeCurrentPlayer;
}

function updateTicTacToeDisplay() {
    const cells = document.querySelectorAll('.tic-tac-toe-cell');
    cells.forEach((cell, index) => {
        cell.textContent = ticTacToeBoard[index];
        if (ticTacToeBoard[index] !== '') {
            cell.classList.add('disabled');
        }
    });
}

function checkTicTacToeWinner() {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Горизонтальные
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Вертикальные
        [0, 4, 8], [2, 4, 6] // Диагональные
    ];
    
    return winPatterns.some(pattern => {
        const [a, b, c] = pattern;
        return ticTacToeBoard[a] !== '' && 
               ticTacToeBoard[a] === ticTacToeBoard[b] && 
               ticTacToeBoard[a] === ticTacToeBoard[c];
    });
}

function resetTicTacToe() {
    initTicTacToe();
}

// ========== ЗМЕЙКА ==========
let snakeGame = null;
let snakeCanvas = null;
let snakeCtx = null;
let snake = [{x: 10, y: 10}];
let snakeDirection = {x: 1, y: 0};
let snakeFood = {x: 15, y: 15};
let snakeScore = 0;
let snakeGameRunning = false;
const GRID_SIZE = 20;
const TILE_COUNT = 20;

function initSnake() {
    snake = [{x: 10, y: 10}];
    snakeDirection = {x: 1, y: 0};
    snakeScore = 0;
    snakeGameRunning = false;
    
    if (gameInterval) {
        clearInterval(gameInterval);
        gameInterval = null;
    }
    if (snakeGame) {
        clearInterval(snakeGame);
        snakeGame = null;
    }
    
    const gameContent = document.getElementById('game-content');
    const scoreDiv = document.getElementById('game-score');
    scoreDiv.innerHTML = `<span>Счет: <strong id="snake-score">0</strong></span>`;
    
    gameContent.innerHTML = `
        <div class="snake-game-container">
            <canvas id="snake-canvas" class="snake-canvas" width="400" height="400"></canvas>
            <div class="snake-info">
                <p>Используйте стрелки или кнопки для управления</p>
                <button class="btn btn-primary" id="snake-start-btn" onclick="startSnakeGame()">Начать игру</button>
            </div>
            <div class="snake-controls">
                <div class="snake-controls-row">
                    <button class="snake-btn" onclick="changeSnakeDirection(0, -1)">↑</button>
                </div>
                <div class="snake-controls-row">
                    <button class="snake-btn" onclick="changeSnakeDirection(-1, 0)">←</button>
                    <button class="snake-btn" onclick="changeSnakeDirection(1, 0)">→</button>
                </div>
                <div class="snake-controls-row">
                    <button class="snake-btn" onclick="changeSnakeDirection(0, 1)">↓</button>
                </div>
            </div>
        </div>
    `;
    
    snakeCanvas = document.getElementById('snake-canvas');
    snakeCtx = snakeCanvas.getContext('2d');
    
    // Обработка клавиатуры
    document.addEventListener('keydown', handleSnakeKeyPress);
    
    generateSnakeFood();
    drawSnake();
}

function handleSnakeKeyPress(event) {
    if (!snakeGameRunning) return;
    
    switch(event.key) {
        case 'ArrowUp':
            event.preventDefault();
            changeSnakeDirection(0, -1);
            break;
        case 'ArrowDown':
            event.preventDefault();
            changeSnakeDirection(0, 1);
            break;
        case 'ArrowLeft':
            event.preventDefault();
            changeSnakeDirection(-1, 0);
            break;
        case 'ArrowRight':
            event.preventDefault();
            changeSnakeDirection(1, 0);
            break;
    }
}

function changeSnakeDirection(x, y) {
    // Не позволяем двигаться в противоположном направлении
    if (snakeDirection.x === -x && snakeDirection.y === -y) {
        return;
    }
    snakeDirection = {x, y};
}

function startSnakeGame() {
    if (snakeGameRunning) return;
    
    snakeGameRunning = true;
    document.getElementById('snake-start-btn').style.display = 'none';
    
    snakeGame = setInterval(() => {
        updateSnake();
        drawSnake();
    }, 150);
}

function updateSnake() {
    const head = {x: snake[0].x + snakeDirection.x, y: snake[0].y + snakeDirection.y};
    
    // Проверка столкновения со стенами
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        gameOverSnake();
        return;
    }
    
    // Проверка столкновения с собой
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        gameOverSnake();
        return;
    }
    
    snake.unshift(head);
    
    // Проверка поедания еды
    if (head.x === snakeFood.x && head.y === snakeFood.y) {
        snakeScore++;
        document.getElementById('snake-score').textContent = snakeScore;
        generateSnakeFood();
    } else {
        snake.pop();
    }
}

function generateSnakeFood() {
    let attempts = 0;
    do {
        snakeFood = {
            x: Math.floor(Math.random() * TILE_COUNT),
            y: Math.floor(Math.random() * TILE_COUNT)
        };
        attempts++;
        if (attempts > 100) break; // Защита от бесконечного цикла
    } while (snake.some(segment => segment.x === snakeFood.x && segment.y === snakeFood.y));
}

function drawSnake() {
    if (!snakeCtx) return;
    
    // Очистка
    snakeCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    snakeCtx.fillRect(0, 0, snakeCanvas.width, snakeCanvas.height);
    
    // Рисуем змейку
    snakeCtx.fillStyle = '#28a745';
    snake.forEach((segment, index) => {
        if (index === 0) {
            snakeCtx.fillStyle = '#ff6b35'; // Голова
        } else {
            snakeCtx.fillStyle = '#28a745'; // Тело
        }
        snakeCtx.fillRect(segment.x * GRID_SIZE, segment.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
    });
    
    // Рисуем еду
    snakeCtx.fillStyle = '#dc3545';
    snakeCtx.beginPath();
    snakeCtx.arc(
        snakeFood.x * GRID_SIZE + GRID_SIZE / 2,
        snakeFood.y * GRID_SIZE + GRID_SIZE / 2,
        GRID_SIZE / 2 - 2,
        0,
        2 * Math.PI
    );
    snakeCtx.fill();
}

function gameOverSnake() {
    snakeGameRunning = false;
    clearInterval(snakeGame);
    
    const gameContent = document.getElementById('game-content');
    gameContent.innerHTML = `
        <div class="snake-game-container">
            <h2 style="color: var(--danger);">Игра окончена!</h2>
            <p style="font-size: 1.5rem; margin: 20px 0;">Ваш счет: <strong>${snakeScore}</strong></p>
            <button class="btn btn-primary" onclick="initSnake()">Играть снова</button>
        </div>
    `;
    
    document.removeEventListener('keydown', handleSnakeKeyPress);
}

// ========== КЛИКЕР ==========
let clickerScore = 0;
let clickerPerClick = 1;
let clickerPerSecond = 0;
let clickerUpgrades = {
    doubleClick: { cost: 10, owned: 0, multiplier: 2 },
    tripleClick: { cost: 50, owned: 0, multiplier: 3 },
    autoClicker: { cost: 100, owned: 0, perSecond: 1 },
    megaClicker: { cost: 500, owned: 0, perSecond: 5 }
};

function initClicker() {
    clickerScore = 0;
    clickerPerClick = 1;
    clickerPerSecond = 0;
    clickerUpgrades = {
        doubleClick: { cost: 10, owned: 0, multiplier: 2 },
        tripleClick: { cost: 50, owned: 0, multiplier: 3 },
        autoClicker: { cost: 100, owned: 0, perSecond: 1 },
        megaClicker: { cost: 500, owned: 0, perSecond: 5 }
    };
    
    const gameContent = document.getElementById('game-content');
    const scoreDiv = document.getElementById('game-score');
    scoreDiv.innerHTML = `<span>Очки: <strong id="clicker-score">0</strong></span>`;
    
    gameContent.innerHTML = `
        <div class="clicker-game">
            <button class="clicker-button" id="clicker-btn" onclick="clickerClick()">
                Кликни меня!
            </button>
            
            <div class="clicker-stats">
                <div class="clicker-stat-card">
                    <h4>Очков за клик</h4>
                    <p id="clicker-per-click">1</p>
                </div>
                <div class="clicker-stat-card">
                    <h4>Очков в секунду</h4>
                    <p id="clicker-per-second">0</p>
                </div>
            </div>
            
            <div class="clicker-upgrades">
                <div class="clicker-upgrade" id="upgrade-double" onclick="buyUpgrade('doubleClick')">
                    <h4>Двойной клик</h4>
                    <p>Удваивает очки за клик</p>
                    <p class="upgrade-cost">Стоимость: <span id="cost-double">10</span></p>
                </div>
                <div class="clicker-upgrade" id="upgrade-triple" onclick="buyUpgrade('tripleClick')">
                    <h4>Тройной клик</h4>
                    <p>Утраивает очки за клик</p>
                    <p class="upgrade-cost">Стоимость: <span id="cost-triple">50</span></p>
                </div>
                <div class="clicker-upgrade" id="upgrade-auto" onclick="buyUpgrade('autoClicker')">
                    <h4>Автокликер</h4>
                    <p>+1 очко в секунду</p>
                    <p class="upgrade-cost">Стоимость: <span id="cost-auto">100</span></p>
                </div>
                <div class="clicker-upgrade" id="upgrade-mega" onclick="buyUpgrade('megaClicker')">
                    <h4>Мега-кликер</h4>
                    <p>+5 очков в секунду</p>
                    <p class="upgrade-cost">Стоимость: <span id="cost-mega">500</span></p>
                </div>
            </div>
        </div>
    `;
    
    // Запускаем авто-кликер
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(() => {
        if (clickerPerSecond > 0) {
            clickerScore += clickerPerSecond;
            updateClickerDisplay();
        }
    }, 1000);
    
    updateClickerDisplay();
}

function clickerClick() {
    clickerScore += clickerPerClick;
    updateClickerDisplay();
    
    // Анимация кнопки
    const btn = document.getElementById('clicker-btn');
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        btn.style.transform = 'scale(1)';
    }, 100);
}

function buyUpgrade(upgradeName) {
    const upgrade = clickerUpgrades[upgradeName];
    if (clickerScore < upgrade.cost) {
        showNotification('Недостаточно очков!', 'error');
        return;
    }
    
    clickerScore -= upgrade.cost;
    upgrade.owned++;
    
    if (upgradeName === 'doubleClick' || upgradeName === 'tripleClick') {
        clickerPerClick = 1;
        if (clickerUpgrades.doubleClick.owned > 0) {
            clickerPerClick *= Math.pow(clickerUpgrades.doubleClick.multiplier, clickerUpgrades.doubleClick.owned);
        }
        if (clickerUpgrades.tripleClick.owned > 0) {
            clickerPerClick *= Math.pow(clickerUpgrades.tripleClick.multiplier, clickerUpgrades.tripleClick.owned);
        }
    } else if (upgradeName === 'autoClicker' || upgradeName === 'megaClicker') {
        clickerPerSecond = 0;
        clickerPerSecond += clickerUpgrades.autoClicker.owned * clickerUpgrades.autoClicker.perSecond;
        clickerPerSecond += clickerUpgrades.megaClicker.owned * clickerUpgrades.megaClicker.perSecond;
    }
    
    upgrade.cost = Math.floor(upgrade.cost * 1.5);
    updateClickerDisplay();
}

function updateClickerDisplay() {
    document.getElementById('clicker-score').textContent = Math.floor(clickerScore);
    document.getElementById('clicker-per-click').textContent = clickerPerClick;
    document.getElementById('clicker-per-second').textContent = clickerPerSecond;
    
    // Обновляем стоимость апгрейдов
    document.getElementById('cost-double').textContent = clickerUpgrades.doubleClick.cost;
    document.getElementById('cost-triple').textContent = clickerUpgrades.tripleClick.cost;
    document.getElementById('cost-auto').textContent = clickerUpgrades.autoClicker.cost;
    document.getElementById('cost-mega').textContent = clickerUpgrades.megaClicker.cost;
    
    // Обновляем доступность апгрейдов
    const upgradeIds = {
        'doubleClick': 'upgrade-double',
        'tripleClick': 'upgrade-triple',
        'autoClicker': 'upgrade-auto',
        'megaClicker': 'upgrade-mega'
    };
    
    Object.keys(upgradeIds).forEach(name => {
        const upgrade = clickerUpgrades[name];
        const element = document.getElementById(upgradeIds[name]);
        if (element) {
            if (clickerScore >= upgrade.cost) {
                element.classList.remove('disabled');
            } else {
                element.classList.add('disabled');
            }
        }
    });
}

// ========== ПЛАТФОРМЕР ==========
let platformerCanvas = null;
let platformerCtx = null;
let platformerGame = null;
let platformerRunning = false;
let platformerScore = 0;
let platformerLives = 3;

// Игрок
let player = {
    x: 50,
    y: 300,
    width: 30,
    height: 30,
    velocityX: 0,
    velocityY: 0,
    speed: 5,
    jumpPower: -15,
    onGround: false,
    color: '#ff6b35'
};

// Платформы
let platforms = [
    {x: 0, y: 400, width: 200, height: 20},
    {x: 250, y: 350, width: 150, height: 20},
    {x: 450, y: 300, width: 150, height: 20},
    {x: 650, y: 250, width: 150, height: 20},
    {x: 850, y: 200, width: 150, height: 20},
    {x: 1050, y: 150, width: 150, height: 20},
    {x: 1250, y: 100, width: 150, height: 20},
    {x: 1450, y: 400, width: 200, height: 20},
    {x: 1700, y: 350, width: 150, height: 20},
    {x: 1900, y: 300, width: 150, height: 20}
];

// Монеты
let coins = [
    {x: 300, y: 320, width: 20, height: 20, collected: false},
    {x: 500, y: 270, width: 20, height: 20, collected: false},
    {x: 700, y: 220, width: 20, height: 20, collected: false},
    {x: 900, y: 170, width: 20, height: 20, collected: false},
    {x: 1100, y: 120, width: 20, height: 20, collected: false},
    {x: 1300, y: 70, width: 20, height: 20, collected: false},
    {x: 1500, y: 370, width: 20, height: 20, collected: false},
    {x: 1750, y: 320, width: 20, height: 20, collected: false},
    {x: 1950, y: 270, width: 20, height: 20, collected: false}
];

// Враги
let enemies = [
    {x: 300, y: 380, width: 25, height: 25, velocityX: -2, color: '#dc3545'},
    {x: 600, y: 280, width: 25, height: 25, velocityX: -2, color: '#dc3545'},
    {x: 1000, y: 180, width: 25, height: 25, velocityX: -2, color: '#dc3545'},
    {x: 1500, y: 380, width: 25, height: 25, velocityX: -2, color: '#dc3545'},
    {x: 1800, y: 330, width: 25, height: 25, velocityX: -2, color: '#dc3545'}
];

// Камера
let camera = {
    x: 0,
    y: 0
};

// Управление
let keys = {
    left: false,
    right: false,
    up: false
};

const GRAVITY = 0.8;
const FRICTION = 0.9;

function initPlatformer() {
    player = {
        x: 50,
        y: 300,
        width: 30,
        height: 30,
        velocityX: 0,
        velocityY: 0,
        speed: 5,
        jumpPower: -15,
        onGround: false,
        color: '#ff6b35'
    };
    
    platformerScore = 0;
    platformerLives = 3;
    platformerRunning = false;
    
    // Сброс монет и врагов
    coins.forEach(coin => coin.collected = false);
    enemies = [
        {x: 300, y: 380, width: 25, height: 25, velocityX: -2, color: '#dc3545'},
        {x: 600, y: 280, width: 25, height: 25, velocityX: -2, color: '#dc3545'},
        {x: 1000, y: 180, width: 25, height: 25, velocityX: -2, color: '#dc3545'},
        {x: 1500, y: 380, width: 25, height: 25, velocityX: -2, color: '#dc3545'},
        {x: 1800, y: 330, width: 25, height: 25, velocityX: -2, color: '#dc3545'}
    ];
    
    camera = {x: 0, y: 0};
    keys = {left: false, right: false, up: false};
    
    if (platformerGame) {
        cancelAnimationFrame(platformerGame);
        platformerGame = null;
    }
    
    const gameContent = document.getElementById('game-content');
    const scoreDiv = document.getElementById('game-score');
    scoreDiv.innerHTML = `
        <span>Счет: <strong id="platformer-score">0</strong> | 
        Жизни: <strong id="platformer-lives">3</strong></span>
    `;
    
    gameContent.innerHTML = `
        <div class="platformer-game-container">
            <canvas id="platformer-canvas" class="platformer-canvas" width="800" height="450"></canvas>
            <div class="platformer-info">
                <p>Используйте стрелки или WASD для управления</p>
                <p>Пробел или W/↑ для прыжка</p>
                <button class="btn btn-primary" id="platformer-start-btn" onclick="startPlatformerGame()">Начать игру</button>
            </div>
        </div>
    `;
    
    platformerCanvas = document.getElementById('platformer-canvas');
    platformerCtx = platformerCanvas.getContext('2d');
    
    // Обработка клавиатуры
    document.addEventListener('keydown', handlePlatformerKeyPress);
    document.addEventListener('keyup', handlePlatformerKeyUp);
    
    drawPlatformer();
}

function handlePlatformerKeyPress(event) {
    if (!platformerRunning) return;
    
    switch(event.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
            event.preventDefault();
            keys.left = true;
            break;
        case 'arrowright':
        case 'd':
            event.preventDefault();
            keys.right = true;
            break;
        case 'arrowup':
        case 'w':
        case ' ':
            event.preventDefault();
            if (player.onGround && !keys.up) {
                player.velocityY = player.jumpPower;
                player.onGround = false;
            }
            keys.up = true;
            break;
    }
}

function handlePlatformerKeyUp(event) {
    switch(event.key.toLowerCase()) {
        case 'arrowleft':
        case 'a':
            keys.left = false;
            break;
        case 'arrowright':
        case 'd':
            keys.right = false;
            break;
        case 'arrowup':
        case 'w':
        case ' ':
            keys.up = false;
            break;
    }
}

function startPlatformerGame() {
    if (platformerRunning) return;
    
    platformerRunning = true;
    document.getElementById('platformer-start-btn').style.display = 'none';
    
    function gameLoop() {
        if (!platformerRunning) return;
        
        updatePlatformer();
        drawPlatformer();
        
        platformerGame = requestAnimationFrame(gameLoop);
    }
    
    gameLoop();
}

function updatePlatformer() {
    // Движение игрока
    if (keys.left) {
        player.velocityX = -player.speed;
    } else if (keys.right) {
        player.velocityX = player.speed;
    } else {
        player.velocityX *= FRICTION;
    }
    
    // Гравитация
    player.velocityY += GRAVITY;
    
    // Обновление позиции
    player.x += player.velocityX;
    player.y += player.velocityY;
    
    // Проверка столкновений с платформами
    player.onGround = false;
    for (let platform of platforms) {
        if (checkCollision(player, platform)) {
            // Столкновение сверху платформы
            if (player.velocityY > 0 && player.y < platform.y) {
                player.y = platform.y - player.height;
                player.velocityY = 0;
                player.onGround = true;
            }
            // Столкновение снизу платформы
            else if (player.velocityY < 0 && player.y > platform.y + platform.height) {
                player.y = platform.y + platform.height;
                player.velocityY = 0;
            }
            // Столкновение с боков
            else {
                if (player.velocityX > 0) {
                    player.x = platform.x - player.width;
                } else if (player.velocityX < 0) {
                    player.x = platform.x + platform.width;
                }
                player.velocityX = 0;
            }
        }
    }
    
    // Обновление врагов
    enemies.forEach(enemy => {
        enemy.x += enemy.velocityX;
        
        // Проверка столкновения с платформами (враги падают)
        let onPlatform = false;
        for (let platform of platforms) {
            if (enemy.x + enemy.width > platform.x && 
                enemy.x < platform.x + platform.width &&
                enemy.y + enemy.height >= platform.y &&
                enemy.y < platform.y + 10) {
                enemy.y = platform.y - enemy.height;
                onPlatform = true;
                break;
            }
        }
        
        if (!onPlatform && enemy.y < 400) {
            enemy.y += 3; // Падение врагов
        }
        
        // Ограничение врагов
        if (enemy.x < -50) {
            enemy.x = 2000;
        }
    });
    
    // Проверка сбора монет
    coins.forEach(coin => {
        if (!coin.collected && checkCollision(player, coin)) {
            coin.collected = true;
            platformerScore += 10;
            document.getElementById('platformer-score').textContent = platformerScore;
        }
    });
    
    // Проверка столкновения с врагами
    enemies.forEach(enemy => {
        if (checkCollision(player, enemy)) {
            // Игрок прыгнул на врага
            if (player.velocityY > 0 && player.y < enemy.y) {
                enemy.x = -100; // Удаляем врага
                player.velocityY = -10; // Отскок
                platformerScore += 5;
                document.getElementById('platformer-score').textContent = platformerScore;
            } else {
                // Игрок получил урон
                platformerLives--;
                document.getElementById('platformer-lives').textContent = platformerLives;
                
                if (platformerLives <= 0) {
                    gameOverPlatformer();
                    return;
                }
                
                // Респавн игрока
                player.x = 50;
                player.y = 300;
                player.velocityX = 0;
                player.velocityY = 0;
            }
        }
    });
    
    // Проверка падения игрока
    if (player.y > 500) {
        platformerLives--;
        document.getElementById('platformer-lives').textContent = platformerLives;
        
        if (platformerLives <= 0) {
            gameOverPlatformer();
            return;
        }
        
        // Респавн игрока
        player.x = 50;
        player.y = 300;
        player.velocityX = 0;
        player.velocityY = 0;
    }
    
    // Обновление камеры
    camera.x = player.x - 400;
    if (camera.x < 0) camera.x = 0;
    
    // Проверка победы (все монеты собраны)
    if (coins.every(coin => coin.collected)) {
        platformerScore += 100;
        document.getElementById('platformer-score').textContent = platformerScore;
        winPlatformer();
    }
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function drawPlatformer() {
    if (!platformerCtx) return;
    
    // Очистка
    platformerCtx.fillStyle = '#87CEEB'; // Небо
    platformerCtx.fillRect(0, 0, platformerCanvas.width, platformerCanvas.height);
    
    // Земля
    platformerCtx.fillStyle = '#8B4513';
    platformerCtx.fillRect(0, 420, platformerCanvas.width, 30);
    
    // Сохраняем контекст для камеры
    platformerCtx.save();
    platformerCtx.translate(-camera.x, 0);
    
    // Рисуем платформы
    platformerCtx.fillStyle = '#228B22';
    platforms.forEach(platform => {
        platformerCtx.fillRect(platform.x, platform.y, platform.width, platform.height);
        // Текстура платформы
        platformerCtx.strokeStyle = '#006400';
        platformerCtx.lineWidth = 2;
        platformerCtx.strokeRect(platform.x, platform.y, platform.width, platform.height);
    });
    
    // Рисуем монеты
    coins.forEach(coin => {
        if (!coin.collected) {
            platformerCtx.fillStyle = '#FFD700';
            platformerCtx.beginPath();
            platformerCtx.arc(
                coin.x + coin.width / 2,
                coin.y + coin.height / 2,
                coin.width / 2,
                0,
                2 * Math.PI
            );
            platformerCtx.fill();
            platformerCtx.strokeStyle = '#FFA500';
            platformerCtx.lineWidth = 2;
            platformerCtx.stroke();
        }
    });
    
    // Рисуем врагов
    enemies.forEach(enemy => {
        if (enemy.x > -100) {
            platformerCtx.fillStyle = enemy.color;
            platformerCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
            // Глаза врага
            platformerCtx.fillStyle = '#000';
            platformerCtx.fillRect(enemy.x + 5, enemy.y + 5, 5, 5);
            platformerCtx.fillRect(enemy.x + 15, enemy.y + 5, 5, 5);
        }
    });
    
    // Рисуем игрока
    platformerCtx.fillStyle = player.color;
    platformerCtx.fillRect(player.x, player.y, player.width, player.height);
    // Глаза игрока
    platformerCtx.fillStyle = '#000';
    platformerCtx.fillRect(player.x + 8, player.y + 8, 5, 5);
    platformerCtx.fillRect(player.x + 17, player.y + 8, 5, 5);
    
    platformerCtx.restore();
}

function gameOverPlatformer() {
    platformerRunning = false;
    if (platformerGame) {
        cancelAnimationFrame(platformerGame);
        platformerGame = null;
    }
    
    const gameContent = document.getElementById('game-content');
    gameContent.innerHTML = `
        <div class="platformer-game-container">
            <h2 style="color: var(--danger);">Игра окончена!</h2>
            <p style="font-size: 1.5rem; margin: 20px 0;">Ваш счет: <strong>${platformerScore}</strong></p>
            <button class="btn btn-primary" onclick="initPlatformer()">Играть снова</button>
        </div>
    `;
}

function winPlatformer() {
    platformerRunning = false;
    if (platformerGame) {
        cancelAnimationFrame(platformerGame);
        platformerGame = null;
    }
    
    const gameContent = document.getElementById('game-content');
    gameContent.innerHTML = `
        <div class="platformer-game-container">
            <h2 style="color: var(--success);">Победа! 🎉</h2>
            <p style="font-size: 1.5rem; margin: 20px 0;">Вы собрали все монеты!</p>
            <p style="font-size: 1.2rem; margin: 20px 0;">Ваш счет: <strong>${platformerScore}</strong></p>
            <button class="btn btn-primary" onclick="initPlatformer()">Играть снова</button>
        </div>
    `;
}

