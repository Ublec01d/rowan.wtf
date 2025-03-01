// Top banner functions

document.addEventListener('DOMContentLoaded', function() {
    const changeTextLink = document.getElementById('change-text-link');

    // Toggle the text of the link when clicked
    changeTextLink.addEventListener('click', function(event) {
        event.preventDefault(); // Prevent the default link behavior
        
        // Toggle the text between 'links' and 'rechts'
        if (this.textContent === 'links') {
            this.textContent = 'rechts';
        } else {
            this.textContent = 'links';
        }
    });
});

function askPassword() {
    var short = "MjUy";
    var src = "aHR0cHM6Ly9naXRodWIuY29tL1VibGVjMDFkL3Rlc3Qtd2Vic2l0ZQ==";
    var a = atob(short);
    var dest = atob(src);

    // Prompt user for the code
    var cod = prompt("Enter code: XXX ");

    if (cod === a) {
        window.location.href = dest;
    } else {
        alert("INCORRECT CODE!"); // alert for incorrect code
    }
}
