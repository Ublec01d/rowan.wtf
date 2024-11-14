// AI functions to control the snake movement using A* pathfinding to avoid collisions and make optimal decisions

let speed = 100; // Initial speed in milliseconds
let rounds = 0; // Track the number of rounds

function aiMakeMove(snake, food, direction, gridSize, canvasWidth, canvasHeight) {
    const path = findPathAStar(snake, food, gridSize, canvasWidth, canvasHeight);

    if (path && path.length > 0) {
        // Follow the first step in the path
        console.log("Path found, moving towards food.");
        return path[0];
    } else {
        // If no path is found, fallback to a safe move
        console.log("No path found, attempting a safe move.");
        return findSafeMove(snake, direction, gridSize, canvasWidth, canvasHeight);
    }
}

// A* Search Algorithm to find the shortest path to the food
function findPathAStar(snake, food, gridSize, canvasWidth, canvasHeight) {
    const openSet = [];
    const closedSet = new Set();
    const startNode = {
        position: snake[0],
        g: 0,
        h: heuristic(snake[0], food),
        f: 0,
        parent: null
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    while (openSet.length > 0) {
        // Sort openSet by f value and pick the node with the lowest f
        openSet.sort((a, b) => a.f - b.f);
        const currentNode = openSet.shift();

        // If we reached the food, reconstruct the path
        if (currentNode.position.x === food.x && currentNode.position.y === food.y) {
            console.log("Food reached by A* pathfinding.");
            increaseSpeed();
            return reconstructPath(currentNode, gridSize);
        }

        closedSet.add(`${currentNode.position.x},${currentNode.position.y}`);

        // Explore neighbors
        const directions = [
            { x: 1, y: 0 },  // Right
            { x: -1, y: 0 }, // Left
            { x: 0, y: 1 },  // Down
            { x: 0, y: -1 }  // Up
        ];
        for (const dir of directions) {
            const neighborPosition = {
                x: currentNode.position.x + dir.x * gridSize,
                y: currentNode.position.y + dir.y * gridSize
            };

            if (!isSafePosition(neighborPosition, snake, canvasWidth, canvasHeight) ||
                closedSet.has(`${neighborPosition.x},${neighborPosition.y}`)) {
                continue; // Skip if the neighbor is not safe or already evaluated
            }

            const gScore = currentNode.g + 1;
            let neighborNode = openSet.find(n => n.position.x === neighborPosition.x && n.position.y === neighborPosition.y);

            if (!neighborNode) {
                neighborNode = {
                    position: neighborPosition,
                    g: gScore,
                    h: heuristic(neighborPosition, food),
                    f: 0,
                    parent: currentNode
                };
                neighborNode.f = neighborNode.g + neighborNode.h;
                openSet.push(neighborNode);
            } else if (gScore < neighborNode.g) {
                neighborNode.g = gScore;
                neighborNode.f = neighborNode.g + neighborNode.h;
                neighborNode.parent = currentNode;
            }
        }
    }

    console.log("A* pathfinding failed to find a path.");
    return null;  // No path found
}

// Increase the speed after each round
function increaseSpeed() {
    rounds++;
    if (rounds <= 20) {
        speed *= 0.9; // Increase speed by reducing delay by 10% each round for the first 20 rounds
    } else {
        speed *= 0.95; // After 20 rounds, continue to gradually increase speed by reducing delay by 5% each round
    }
    speed = Math.max(20, speed); // Ensure speed does not go below a 20ms delay
}

// Heuristic function for A* (Manhattan distance)
function heuristic(position, target) {
    return Math.abs(position.x - target.x) + Math.abs(position.y - target.y);
}

// Reconstruct path from the end node to the start node
function reconstructPath(node, gridSize) {
    const path = [];
    let current = node;
    while (current.parent) {
        path.unshift({
            x: (current.position.x - current.parent.position.x) / gridSize,
            y: (current.position.y - current.parent.position.y) / gridSize
        });
        current = current.parent;
    }
    return path;
}

// Find a safe move if no path to the food is available
function findSafeMove(snake, direction, gridSize, canvasWidth, canvasHeight) {
    const directions = [
        { x: 1, y: 0 },  // Right
        { x: -1, y: 0 }, // Left
        { x: 0, y: 1 },  // Down
        { x: 0, y: -1 }  // Up
    ];

    let bestDirection = null;
    let maxSafeMoves = -1;

    for (const dir of directions) {
        const nextPosition = { x: snake[0].x + dir.x * gridSize, y: snake[0].y + dir.y * gridSize };
        if (isSafePosition(nextPosition, snake, canvasWidth, canvasHeight)) {
            const safeMoves = countSafeMoves(nextPosition, snake, gridSize, canvasWidth, canvasHeight);
            if (safeMoves > maxSafeMoves) {
                maxSafeMoves = safeMoves;
                bestDirection = dir;
            }
        }
    }

    if (bestDirection) {
        console.log("Best safe move found: ", bestDirection);
        return bestDirection;
    }

    console.log("No safe move found, continuing in current direction.");
    return direction; // If no safe move found, continue in current direction
}

// Count the number of safe moves from a given position
function countSafeMoves(position, snake, gridSize, canvasWidth, canvasHeight) {
    const directions = [
        { x: 1, y: 0 },  // Right
        { x: -1, y: 0 }, // Left
        { x: 0, y: 1 },  // Down
        { x: 0, y: -1 }  // Up
    ];

    let safeMoveCount = 0;
    for (const dir of directions) {
        const nextPosition = { x: position.x + dir.x * gridSize, y: position.y + dir.y * gridSize };
        if (isSafePosition(nextPosition, snake, canvasWidth, canvasHeight)) {
            safeMoveCount++;
        }
    }
    return safeMoveCount;
}

// Helper function to check if a position is safe for the snake to move
function isSafePosition(position, snake, canvasWidth, canvasHeight) {
    // Check if the position is within bounds
    if (position.x < 0 || position.y < 0 || position.x >= canvasWidth || position.y >= canvasHeight) {
        return false;
    }

    // Check if the position collides with the snake's body
    for (let i = 1; i < snake.length; i++) {
        if (position.x === snake[i].x && position.y === snake[i].y) {
            return false;
        }
    }
    return true;
}

export { aiMakeMove, isSafePosition };
