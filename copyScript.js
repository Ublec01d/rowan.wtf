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
