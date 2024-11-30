import { aiMakeMove } from './snakeAI.js';

const canvas = document.getElementById('snake-game');
const ctx = canvas.getContext('2d');
const aiToggleButton = document.getElementById('toggle-mode-button');
const restartButton = document.getElementById('restart-button');
const navbar = document.getElementById('navbar');
const footer = document.getElementById('footer');

// Global game variables
let gridSize, snake, direction, food, score, highScore = 0, highScorePlayer = "";
let initialSpeed = 200;
let speed = initialSpeed;
let gameInterval;
let isAIEnabled = false;

function resizeCanvas() {
    const navbarHeight = navbar ? navbar.offsetHeight : 0;
    const footerHeight = footer ? footer.offsetHeight : 0;

    const width = window.innerWidth;
    const height = window.innerHeight - navbarHeight - footerHeight;

    canvas.width = width;
    canvas.height = height;
    gridSize = Math.floor(Math.min(width, height) / 40);

    canvas.style.position = "absolute";
    canvas.style.top = `${navbarHeight}px`;
    canvas.style.bottom = `${footerHeight}px`;
    canvas.style.left = "0px";

    aiToggleButton.style.position = "relative";
    restartButton.style.position = "relative";
}

function initializeGame() {
    resizeCanvas();
    snake = [{ x: Math.floor(canvas.width / 2 / gridSize) * gridSize, y: Math.floor(canvas.height / 2 / gridSize) * gridSize }];
    direction = { x: 0, y: 0 };
    food = generateRandomPosition();
    score = 0;
    speed = initialSpeed;
    updateScore();
    fetchHighScoreFromFirebase();
}

function fetchHighScoreFromFirebase() {
    getHighScoreFromFirebase().then((storedHighScore) => {
        if (storedHighScore) {
            highScore = storedHighScore.score || 0;
            highScorePlayer = storedHighScore.player || "Unknown";
            document.getElementById('high-score').textContent = `High Score: ${highScore} by ${highScorePlayer}`;
        } else {
            highScore = 0;
            highScorePlayer = "Unknown";
            document.getElementById('high-score').textContent = `High Score: ${highScore}`;
        }
    }).catch((error) => {
        console.error('Error fetching high score:', error);
    });
}

function checkAndUpdateHighScore() {
    if (score > highScore) {
        const playerName = prompt("New High Score! Enter your name (max 6 characters):", "Player").slice(0, 6) || "Player";
        highScore = score;
        highScorePlayer = playerName;

        document.getElementById('high-score').textContent = `High Score: ${highScore} by ${highScorePlayer}`;
        updateHighScoreInFirebase({ score: highScore, player: highScorePlayer });
    }
}

function generateRandomPosition() {
    const x = Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize;
    const y = Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize;
    return { x, y };
}

function updateScore() {
    document.getElementById('score-counter').textContent = `bits: ${score}`;
}

function moveSnake() {
    if (isAIEnabled) {
        direction = aiMakeMove(snake, food, direction, gridSize, canvas.width, canvas.height);
    }
    const head = { x: snake[0].x + direction.x * gridSize, y: snake[0].y + direction.y * gridSize };
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score++;
        speed = Math.max(1, speed * 0.95);
        food = generateRandomPosition();
        updateScore();
        restartGameLoop();
    } else {
        snake.pop();
    }

    if (checkCollision()) {
        clearInterval(gameInterval);
        if (score > highScore) {
            alert(`Congratulations! New High Score: ${score}`);
            checkAndUpdateHighScore();
        } else {
            alert(`snek died :( You ate ${score} bits`);
        }
        initializeGame();
        startGame();
    }
}

function checkCollision() {
    const head = snake[0];
    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
        return true;
    }
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) return true;
    }
    return false;
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#006400';
    ctx.fillRect(snake[0].x, snake[0].y, gridSize, gridSize);

    ctx.fillStyle = '#32CD32';
    for (let i = 1; i < snake.length; i++) {
        ctx.fillRect(snake[i].x, snake[i].y, gridSize, gridSize);
    }

    ctx.fillStyle = '#FF0000';
    ctx.fillRect(food.x, food.y, gridSize, gridSize);
}

function restartGameLoop() {
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, speed);
}

function gameLoop() {
    moveSnake();
    drawGame();
}

function startGame() {
    restartGameLoop();
}

function setupControls() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' && direction.y === 0) direction = { x: 0, y: -1 };
        else if (e.key === 'ArrowDown' && direction.y === 0) direction = { x: 0, y: 1 };
        else if (e.key === 'ArrowLeft' && direction.x === 0) direction = { x: -1, y: 0 };
        else if (e.key === 'ArrowRight' && direction.x === 0) direction = { x: 1, y: 0 };
    });

    let touchStartX, touchStartY;
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const deltaX = e.touches[0].clientX - touchStartX;
        const deltaY = e.touches[0].clientY - touchStartY;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0 && direction.x === 0) direction = { x: 1, y: 0 };
            else if (deltaX < 0 && direction.x === 0) direction = { x: -1, y: 0 };
        } else {
            if (deltaY > 0 && direction.y === 0) direction = { x: 0, y: 1 };
            else if (deltaY < 0 && direction.y === 0) direction = { x: 0, y: -1 };
        }
    });
}

aiToggleButton.addEventListener('click', () => {
    isAIEnabled = !isAIEnabled;
    aiToggleButton.textContent = isAIEnabled ? "Switch to Manual Mode" : "Switch to AI Mode";
});

window.onload = () => {
    initializeGame();
    setupControls();
    startGame();
};

window.addEventListener('resize', resizeCanvas);
