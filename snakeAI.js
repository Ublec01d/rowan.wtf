
// AI functions to control the snake movement and avoid collisions

function aiMakeMove(snake, food, direction, gridSize, canvasWidth, canvasHeight) {
    const head = snake[0];

    // Determine preferred direction toward the food
    let preferredDirection = { x: 0, y: 0 };
    if (food.x > head.x) preferredDirection.x = 1;  // Move right
    else if (food.x < head.x) preferredDirection.x = -1;  // Move left
    else if (food.y > head.y) preferredDirection.y = 1;  // Move down
    else if (food.y < head.y) preferredDirection.y = -1;  // Move up

    // Check if the preferred direction is safe
    if (isSafeDirection(snake, preferredDirection, gridSize, canvasWidth, canvasHeight)) {
        return preferredDirection;
    } else {
        // Try alternative directions if the preferred direction is not safe
        const alternativeDirections = [
            { x: 1, y: 0 },  // Right
            { x: -1, y: 0 }, // Left
            { x: 0, y: 1 },  // Down
            { x: 0, y: -1 }  // Up
        ].filter(dir => dir.x !== -preferredDirection.x && dir.y !== -preferredDirection.y);  // Exclude opposite direction

        for (const altDir of alternativeDirections) {
            if (isSafeDirection(snake, altDir, gridSize, canvasWidth, canvasHeight)) {
                return altDir;
            }
        }
    }
    return direction;  // If no safe direction, continue in current direction
}

// Helper function to check if a direction is safe for the snake to move
function isSafeDirection(snake, dir, gridSize, canvasWidth, canvasHeight) {
    const nextHeadPosition = { x: snake[0].x + dir.x * gridSize, y: snake[0].y + dir.y * gridSize };

    // Check if the next position is within bounds
    if (nextHeadPosition.x < 0 || nextHeadPosition.y < 0 ||
        nextHeadPosition.x >= canvasWidth || nextHeadPosition.y >= canvasHeight) {
        return false;
    }

    // Check if the next position collides with the snake's body
    for (let i = 1; i < snake.length; i++) {
        if (nextHeadPosition.x === snake[i].x && nextHeadPosition.y === snake[i].y) {
            return false;
        }
    }
    return true;
}

export { aiMakeMove, isSafeDirection };
