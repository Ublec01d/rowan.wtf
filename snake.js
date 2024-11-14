import { aiMakeMove } from './snakeAI.js';

const canvas = document.getElementById('snake-game');
const ctx = canvas.getContext('2d');
const aiToggleButton = document.getElementById('toggle-mode-button');
const restartButton = document.getElementById('restart-button');
const navbar = document.getElementById('navbar');  // Reference to the navigation bar
const footer = document.getElementById('footer');  // Assumes a footer element with this ID

// Global game variables
let gridSize, snake, direction, food, score, highScore = 0;
let initialSpeed = 200;
let speed = initialSpeed;
let gameInterval;
let isAIEnabled = false;  // Track AI mode

// Resize canvas to fill the screen area between navbar and footer with exact placement
function resizeCanvas() {
    const navbarHeight = navbar ? navbar.offsetHeight : 0;
    const footerHeight = footer ? footer.offsetHeight : 0;

    // Set the height and width of the canvas based on the available window dimensions
    const width = window.innerWidth;
    const height = window.innerHeight - navbarHeight - footerHeight;
    
    // Adjust canvas size
    canvas.width = width;
    canvas.height = height;
    gridSize = Math.floor(Math.min(width, height) / 40);
    
    // Position the canvas below the navbar
    canvas.style.position = "absolute";
    canvas.style.top = `${navbarHeight}px`;
    canvas.style.bottom = `${footerHeight}px`;
    canvas.style.left = "0px";

    // Position and center the floating buttons
    aiToggleButton.style.position = "relative";
    aiToggleButton.style.bottom = "auto";
    aiToggleButton.style.left = "auto";
    aiToggleButton.style.transform = "none";
    
    restartButton.style.position = "relative";
    restartButton.style.bottom = "auto";
    restartButton.style.left = "auto";
    restartButton.style.transform = "none";

}

// Initialize game settings and elements without triggering resizeCanvas
function initializeGame() {
    resizeCanvas();  // Set up canvas dimensions and grid size
    snake = [{ x: Math.floor(canvas.width / 2 / gridSize) * gridSize, y: Math.floor(canvas.height / 2 / gridSize) * gridSize }];
    direction = { x: 0, y: 0 };
    food = generateRandomPosition();
    score = 0;
    speed = initialSpeed;  // Reset speed to initial value on game restart
    updateScore();
    fetchHighScoreFromFirebase();  // Fetch the high score on load
}

// Fetch high score using external function `getHighScoreFromFirebase`
function fetchHighScoreFromFirebase() {
    getHighScoreFromFirebase().then((storedHighScore) => {
        highScore = storedHighScore || 0;
        document.getElementById('high-score').textContent = `High Score: ${highScore}`;
    }).catch((error) => {
        console.error('Error fetching high score:', error);
    });
}

// Update high score if the current score exceeds it
function checkAndUpdateHighScore() {
    if (score > highScore) {
        highScore = score;
        document.getElementById('high-score').textContent = `High Score: ${highScore}`;
        updateHighScoreInFirebase(highScore);  // Update high score using external function
    }
}

// Generate a random position for the food, aligned to the grid
function generateRandomPosition() {
    const x = Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize;
    const y = Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize;
    return { x, y };
}

// Update score display
function updateScore() {
    document.getElementById('score-counter').textContent = `bits: ${score}`;
}

// Move the snake based on direction or AI logic
function moveSnake() {
    if (isAIEnabled) {
        direction = aiMakeMove(snake, food, direction, gridSize, canvas.width, canvas.height);
    }
    const head = { x: snake[0].x + direction.x * gridSize, y: snake[0].y + direction.y * gridSize };
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score++;
        speed = Math.max(1, speed * 0.95);  // Increase speed by reducing interval, no ceiling
        food = generateRandomPosition();
        updateScore();
        restartGameLoop();  // Restart the game loop to apply new speed
    } else {
        snake.pop();  // Remove last segment if no food eaten
    }

    if (checkCollision()) {
        clearInterval(gameInterval);
        alert(`snek died :( You ate ${score} bits`);
        checkAndUpdateHighScore();  // Check if high score needs updating
        initializeGame();
        startGame();
    }
}

// Check for wall or self-collision
function checkCollision() {
    const head = snake[0];
    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
        return true;  // Collision with wall
    }
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) return true;  // Collision with self
    }
    return false;
}

// Draw the game elements (snake and food)
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set color for the snake's head (darker green for the head, lighter for the body)
    const headColor = '#006400';  // Dark green for head
    const bodyColor = '#32CD32';  // Lime green for body

    // Draw the head
    ctx.fillStyle = headColor;
    ctx.fillRect(snake[0].x, snake[0].y, gridSize, gridSize);

    // Draw the rest of the body
    ctx.fillStyle = bodyColor;
    for (let i = 1; i < snake.length; i++) {
        ctx.fillRect(snake[i].x, snake[i].y, gridSize, gridSize);
    }

    // Draw the food in red
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(food.x, food.y, gridSize, gridSize);
}

// Restart the game loop with updated speed
function restartGameLoop() {
    clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, speed);
}

// Game loop
function gameLoop() {
    moveSnake();
    drawGame();
}

// Start the game loop with set interval
function startGame() {
    restartGameLoop();  // Start the game loop
}

// Handle keyboard and touch controls
function setupControls() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' && direction.y === 0) direction = { x: 0, y: -1 };
        else if (e.key === 'ArrowDown' && direction.y === 0) direction = { x: 0, y: 1 };
        else if (e.key === 'ArrowLeft' && direction.x === 0) direction = { x: -1, y: 0 };
        else if (e.key === 'ArrowRight' && direction.x === 0) direction = { x: 1, y: 0 };
    });

    // Touch controls for mobile devices with `preventDefault` to prevent scrolling
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
            if (deltaX > 0 && direction.x === 0) direction = { x: 1, y: 0 };  // Swipe Right
            else if (deltaX < 0 && direction.x === 0) direction = { x: -1, y: 0 };  // Swipe Left
        } else {
            if (deltaY > 0 && direction.y === 0) direction = { x: 0, y: 1 };  // Swipe Down
            else if (deltaY < 0 && direction.y === 0) direction = { x: 0, y: -1 };  // Swipe Up
        }
    });
}

// Toggle AI mode when the button is clicked
aiToggleButton.addEventListener('click', () => {
    isAIEnabled = !isAIEnabled;
    aiToggleButton.textContent = isAIEnabled ? "Switch to Manual Mode" : "Switch to AI Mode";
});

// Initialize and start the game on load
window.onload = () => {
    initializeGame();  // Initialize the game without triggering resizeCanvas again
    setupControls();
    startGame();
};

window.addEventListener('resize', resizeCanvas);  // Resize only, without reinitializing the game
