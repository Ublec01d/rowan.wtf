// Firebase initialization and anonymous sign-in
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getDatabase, ref, set, get } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBgu0JwZdclSeM9W-7cGjcs7dfxUu23930",
    authDomain: "ublec01d-b32bb.firebaseapp.com",
    databaseURL: "https://ublec01d-b32bb-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ublec01d-b32bb",
    storageBucket: "ublec01d-b32bb.appspot.com",
    messagingSenderId: "695529528296",
    appId: "1:695529528296:web:3e34619f95fdac1fcf625d",
    measurementId: "G-E1DCHYQ91Z"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Authenticate user anonymously
signInAnonymously(auth)
    .then(() => {
        console.log("User signed in anonymously");
        initializeGame();
    })
    .catch((error) => {
        console.error("Error signing in:", error);
    });

// Game variables
let gridSize, snake, direction, food, score, highScore = 0, highScorePlayer = "";
let initialSpeed = 200;
let speed = initialSpeed;
let gameInterval;
let isAIEnabled = false;

function resizeCanvas() {
    const navbarHeight = document.getElementById('navbar')?.offsetHeight || 0;
    const footerHeight = document.getElementById('footer')?.offsetHeight || 0;

    const width = window.innerWidth;
    const height = window.innerHeight - navbarHeight - footerHeight;

    const canvas = document.getElementById('snake-game');
    canvas.width = width;
    canvas.height = height;
    gridSize = Math.floor(Math.min(width, height) / 40);

    document.getElementById('toggle-mode-button').style.position = "relative";
    document.getElementById('restart-button').style.position = "relative";
}

function initializeGame() {
    resizeCanvas();
    snake = [{ x: Math.floor(window.innerWidth / 2 / gridSize) * gridSize, y: Math.floor(window.innerHeight / 2 / gridSize) * gridSize }];
    direction = { x: 0, y: 0 };
    food = generateRandomPosition();
    score = 0;
    speed = initialSpeed;
    updateScore();
    fetchHighScoreFromFirebase();
}

function fetchHighScoreFromFirebase() {
    const highScoreRef = ref(database, 'snakeGame/highScore');
    get(highScoreRef).then((snapshot) => {
        if (snapshot.exists()) {
            const storedHighScore = snapshot.val();
            highScore = storedHighScore.score || 0;
            highScorePlayer = storedHighScore.player || "Unknown";
            document.getElementById('high-score').textContent = `High Score: ${highScore} by ${highScorePlayer}`;
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
        const highScoreRef = ref(database, 'snakeGame/highScore');
        set(highScoreRef, { score: highScore, player: highScorePlayer });
    }
}

function generateRandomPosition() {
    const canvas = document.getElementById('snake-game');
    const x = Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize;
    const y = Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize;
    return { x, y };
}

function updateScore() {
    document.getElementById('score-counter').textContent = `bits: ${score}`;
}

function moveSnake() {
    const canvas = document.getElementById('snake-game');
    const ctx = canvas.getContext('2d');

    const head = { x: snake[0].x + direction.x * gridSize, y: snake[0].y + direction.y * gridSize };
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score++;
        adjustSpeed();
        food = generateRandomPosition();
        updateScore();
        restartGameLoop();
    } else {
        snake.pop();
    }

    if (checkCollision(canvas)) {
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#32CD32';
    snake.forEach(segment => ctx.fillRect(segment.x, segment.y, gridSize, gridSize));
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(food.x, food.y, gridSize, gridSize);
}

function adjustSpeed() {
    if (score <= 30) {
        speed *= 0.95; // 5% speed increase per bit until 30 bits
    } else if (score <= 100) {
        speed *= 0.98; // 2% speed increase per bit from 30 to 100 bits
    } else if (score % 10 === 0) {
        speed *= 0.99; // 1% speed increase every 10 bits after 100 bits
    }
}

function checkCollision(canvas) {
    const head = snake[0];
    if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
        return true;
    }
    return snake.slice(1).some(segment => head.x === segment.x && head.y === segment.y);
}

function restartGameLoop() {
    clearInterval(gameInterval);
    gameInterval = setInterval(moveSnake, speed);
}

function startGame() {
    restartGameLoop();
}

window.onload = () => {
    document.getElementById('toggle-mode-button').addEventListener('click', () => {
        isAIEnabled = !isAIEnabled;
        document.getElementById('toggle-mode-button').textContent = isAIEnabled ? "Switch to Manual Mode" : "Switch to AI Mode";
    });

    window.addEventListener('resize', resizeCanvas);
};
