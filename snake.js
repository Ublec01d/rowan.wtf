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

const scoreCounter = document.getElementById('score-counter');
const restartButton = document.getElementById('restart-button');
let highScore = 0;  // Track high score

// Fetch high score from HTML (set via Firebase in the HTML)
window.onload = function () {
    highScore = parseInt(document.getElementById('high-score').textContent.split(": ")[1]) || 0;
};

function gameLoop() {
    setTimeout(() => {
        moveSnake();
        if (checkCollision()) {
            endGame();
        } else {
            if (checkFoodCollision()) {
                snake.push({ ...snake[snake.length - 1] });
                food = generateRandomPosition();
                score++;
                updateScore();
                speed = Math.max(30, speed - 10);  // Speed increases after each food
                checkAndUpdateHighScore();  // Check if we need to update the high score
            }
            drawGame();
            requestAnimationFrame(gameLoop);
        }
    }, speed);
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
    scoreCounter.textContent = `noms: ${score}`;
}

function checkAndUpdateHighScore() {
    if (score > highScore) {
        highScore = score;
        document.getElementById('high-score').textContent = `High Score: ${highScore}`;
        window.updateHighScore(highScore);  // Call the Firebase function from the HTML to update the high score
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

function handleDirectionChange(e) {
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
