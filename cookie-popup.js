document.addEventListener("DOMContentLoaded", () => {
    // Create the popup container
    const popup = document.createElement("div");
    popup.id = "cookie-popup";
    popup.innerHTML = `
        <div class="cookie-content">
            <p>This site uses cookies to ensure the best user experience. By continuing, you accept the use of cookies.</p>
            <div class="cookie-buttons">
                <button id="accept-cookies">Accept</button>
                <button id="decline-cookies">Decline</button>
            </div>
        </div>
    `;
    document.body.appendChild(popup);

    // Check cookie consent
    const cookieConsent = localStorage.getItem("cookieConsent");

    if (cookieConsent === "declined") {
        // Redirect to the error page if cookies were previously declined
        window.location.href = "/error.html";
    } else if (!cookieConsent) {
        // Show popup if consent has not been given
        popup.style.display = "flex";
    }

    // Button actions
    document.getElementById("accept-cookies").addEventListener("click", () => {
        localStorage.setItem("cookieConsent", "accepted");
        popup.style.display = "none";
    });

    document.getElementById("decline-cookies").addEventListener("click", () => {
        localStorage.setItem("cookieConsent", "declined");
        window.location.href = "/error.html"; // Redirect to an error page
    });
});
