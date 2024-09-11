// copy functionality

function copyScript(scriptId) {
    const scriptText = document.getElementById(scriptId).innerText;
    const textArea = document.createElement("textarea");
    textArea.value = scriptText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    alert("Script copied to clipboard!");
}


// text movement

document.addEventListener('keydown', function(event) {
    const title = document.getElementById('main-title');
    const currentLeft = parseInt(window.getComputedStyle(title).left, 10);
    const currentTop = parseInt(window.getComputedStyle(title).top, 10);
    const step = 10; // Amount of pixels to move

    // Move left and right
    if (event.key === 'ArrowRight') {
        title.style.left = currentLeft + step + 'px';
    } else if (event.key === 'ArrowLeft') {
        title.style.left = currentLeft - step + 'px';
    }
    // Move up and down
    else if (event.key === 'ArrowUp') {
        title.style.top = currentTop - step + 'px';
    } else if (event.key === 'ArrowDown') {
        title.style.top = currentTop + step + 'px';
    }
});
