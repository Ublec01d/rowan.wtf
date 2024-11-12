
const canvas = document.getElementById('snake-game');
const ctx = canvas.getContext('2d');
const aiToggleButton = document.getElementById('toggle-mode-button');

// Global game variables
let gridSize, snake, direction, food, score, highScore = 0;
const initialSpeed = 200;
let speed = initialSpeed;
let gameInterval;
let isAIEnabled = false;  // Track AI mode

// Resize canvas to fit within viewport, leaving space for the footer
function resizeCanvas() {
    const width = Math.min(window.innerWidth - 20, 600);
    const height = Math.min(window.innerHeight - 100, 500);  // Leave space for footer
    canvas.width = width;
    canvas.height = height;
    gridSize = Math.floor(Math.min(canvas.width, canvas.height) / 40);  // Ensure consistent grid size
}

// Initialize game settings and elements without triggering resizeCanvas
function initializeGame() {
    resizeCanvas();  // Set up canvas dimensions and grid size
    snake = [{ x: Math.floor(canvas.width / 2 / gridSize) * gridSize, y: Math.floor(canvas.height / 2 / gridSize) * gridSize }];
    direction = { x: 0, y: 0 };
    food = generateRandomPosition();
    score = 0;
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
        aiMakeMove();
    }
    const head = { x: snake[0].x + direction.x * gridSize, y: snake[0].y + direction.y * gridSize };
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score++;
        speed = Math.max(50, speed * 0.95);  // Increase speed slightly
        food = generateRandomPosition();
        updateScore();
    } else {
        snake.pop();  // Remove last segment if no food eaten
    }

    if (checkCollision()) {
        clearInterval(gameInterval);
        alert("Snek ded :(");
        checkAndUpdateHighScore();  // Check if high score needs updating
        initializeGame();
        startGame();
    }
}

// AI logic to move snake toward food
function aiMakeMove() {
    const head = snake[0];
    direction = { x: 0, y: 0 };

    if (food.x > head.x) direction.x = 1;  // Move right
    else if (food.x < head.x) direction.x = -1;  // Move left
    else if (food.y > head.y) direction.y = 1;  // Move down
    else if (food.y < head.y) direction.y = -1;  // Move up
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
    ctx.fillStyle = "lime";
    snake.forEach(segment => ctx.fillRect(segment.x, segment.y, gridSize, gridSize));
    ctx.fillStyle = "red";
    ctx.fillRect(food.x, food.y, gridSize, gridSize);
}

// Game loop
function gameLoop() {
    moveSnake();
    drawGame();
}

// Start the game loop with set interval
function startGame() {
    clearInterval(gameInterval);  // Clear any existing interval
    gameInterval = setInterval(gameLoop, speed);
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
