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
    var a = 10 + 35 + 38 + 69 + 100; // this could also be found on my website if you tried.. maybe you'll find where it's hidden with this hint.
    var w8w = prompt("Enter code: XXX ");


    if (w8w === a.toString()) {
        window.location.href = "https://github.com/Ublec01d/test-website"; // target URL
    } else {
        alert("INCORRECT CODE! it doesn't add up.. ಠ_ಠ ");
    }
}

