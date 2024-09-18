const canvas = document.getElementById('snake-game');
const ctx = canvas.getContext('2d');

// Set the initial canvas size
canvas.width = 600;  // Change this to your preferred canvas width
canvas.height = 600; // Change this to your preferred canvas height

// Dynamically calculate grid size relative to canvas size
const gridSize = canvas.width / 40;  // Ensure the grid scales proportionally

let speed = 200;
let score = 0;
let snake = [{ x: gridSize * 10, y: gridSize * 10 }];
let direction = { x: 0, y: 0 };
let food = generateRandomPosition();
let isAIEnabled = false; // Track whether the game is in AI mode or manual mode

const scoreCounter = document.getElementById('score-counter');
const restartButton = document.getElementById('restart-button');
const toggleModeButton = document.getElementById('toggle-mode-button'); // Button to toggle between AI and manual
let highScore = 0;  // Track high score globally

// Fetch high score from Firebase (set via Firebase in the HTML)
window.onload = function () {
    // Ensure we fetch the high score from Firebase when the page loads
    fetchHighScoreFromFirebase();
};

function fetchHighScoreFromFirebase() {
    // Fetch the high score from Firebase (function defined in the HTML file)
    getHighScoreFromFirebase().then((storedHighScore) => {
        highScore = storedHighScore || 0; // Ensure we always have a number
        document.getElementById('high-score').textContent = `High Score: ${highScore}`;
    }).catch((error) => {
        console.error('Error fetching high score:', error);
    });
}

function gameLoop() {
    setTimeout(() => {
        if (isAIEnabled) {
            aiMakeMove();  // If AI is enabled, let AI decide the direction
        }
        moveSnake();
        if (checkCollision()) {
            endGame();
        } else {
            if (checkFoodCollision()) {
                snake.push({ ...snake[snake.length - 1] });
                food = generateRandomPosition();
                score++;
                updateScore();
                speed = Math.max(0.1, speed * 0.98);  // Slower increase (reduce by 2% each time)
                checkAndUpdateHighScore();  // Check if we need to update the high score
            }
            drawGame();
            requestAnimationFrame(gameLoop);
        }
    }, speed);
}

function aiMakeMove() {
    const head = snake[0];
    const foodDirection = { x: 0, y: 0 };

    // Determine the direction to move toward the food
    if (food.x > head.x) {
        foodDirection.x = 1;  // Move right
    } else if (food.x < head.x) {
        foodDirection.x = -1;  // Move left
    }

    if (food.y > head.y) {
        foodDirection.y = 1;  // Move down
    } else if (food.y < head.y) {
        foodDirection.y = -1;  // Move up
    }

    // Prioritize horizontal movement (for example)
    if (foodDirection.x !== 0 && !checkCollisionInDirection(foodDirection.x, 0)) {
        direction = { x: foodDirection.x, y: 0 };
    } else if (foodDirection.y !== 0 && !checkCollisionInDirection(0, foodDirection.y)) {
        direction = { x: 0, y: foodDirection.y };
    } else {
        // Handle cases where the AI is about to collide
        avoidCollision();
    }
}

function checkCollisionInDirection(xDir, yDir) {
    const head = { x: snake[0].x + xDir * gridSize, y: snake[0].y + yDir * gridSize };

    // Check for wall collisions
    if (head.x < 0 || head.y < 0 || head.x >= canvas.width || head.y >= canvas.height) {
        return true;
    }

    // Check for body collisions
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }
    return false;
}

function avoidCollision() {
    // Try moving in a random direction or pick the first valid direction
    const possibleDirections = [
        { x: 1, y: 0 },  // Move right
        { x: -1, y: 0 }, // Move left
        { x: 0, y: 1 },  // Move down
        { x: 0, y: -1 }  // Move up
    ];

    for (let dir of possibleDirections) {
        if (!checkCollisionInDirection(dir.x, dir.y)) {
            direction = dir;
            return;
        }
    }
}

function moveSnake() {
    const head = { x: snake[0].x + direction.x * gridSize, y: snake[0].y + direction.y * gridSize };
    snake.unshift(head);
    snake.pop();
}

function checkCollision() {
    const head = snake[0];
    // Check canvas boundaries
    if (head.x < 0 || head.y < 0 || head.x >= canvas.width || head.y >= canvas.height) {
        return true;
    }
    // Check snake body collisions
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }
    return false;
}

function checkFoodCollision() {
    const head = snake[0];
    return head.x === food.x && head.y === food.y;
}

function generateRandomPosition() {
    const randomX = Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize;
    const randomY = Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize;
    return { x: randomX, y: randomY };
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw snake in green
    ctx.fillStyle = '#00FF00';
    snake.forEach(part => {
        ctx.fillRect(part.x, part.y, gridSize, gridSize);
    });

    // Draw food in red
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(food.x, food.y, gridSize, gridSize);
}

function updateScore() {
    scoreCounter.textContent = `bits: ${score}`;
}

// Ensure we update the high score only if the new score is higher
function checkAndUpdateHighScore() {
    if (score > highScore) {
        highScore = score;
        document.getElementById('high-score').textContent = `High Score: ${highScore}`;
        updateHighScoreInFirebase(highScore);  // Call Firebase update function
    }
}

function endGame() {
    restartButton.style.display = 'block';  // Show the restart button
    canvas.style.opacity = 0.5;  // Dim the canvas to indicate game over
    document.removeEventListener('keydown', handleDirectionChange);
}

function resetGame() {
    snake = [{ x: gridSize * 10, y: gridSize * 10 }];
    direction = { x: 0, y: 0 };
    food = generateRandomPosition();
    score = 0;
    speed = 200;
    updateScore();
    canvas.style.opacity = 1;  // Restore canvas opacity
    restartButton.style.display = 'none';  // Hide restart button
    document.addEventListener('keydown', handleDirectionChange);  // Re-enable controls
    gameLoop();
}

// Restart button functionality
restartButton.addEventListener('click', resetGame);

// Add functionality to toggle between AI and manual mode
toggleModeButton.addEventListener('click', () => {
    isAIEnabled = !isAIEnabled;
    const modeText = isAIEnabled ? "AI Mode" : "Manual Mode";
    toggleModeButton.textContent = `Switch to ${isAIEnabled ? "Manual" : "AI"} Mode`;
    console.log(`Switched to ${modeText}`);
});

function handleDirectionChange(e) {
    if (isAIEnabled) return; // Prevent manual control in AI mode

    switch (e.key) {
        case 'ArrowUp':
            if (direction.y === 0) direction = { x: 0, y: -1 };
            break;
        case 'ArrowDown':
            if (direction.y === 0) direction = { x: 0, y: 1 };
            break;
        case 'ArrowLeft':
            if (direction.x === 0) direction = { x: -1, y: 0 };
            break;
        case 'ArrowRight':
            if (direction.x === 0) direction = { x: 1, y: 0 };
            break;
    }
}

// Start the game
document.addEventListener('keydown', handleDirectionChange);
gameLoop();
