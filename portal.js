document.addEventListener("DOMContentLoaded", () => {
    console.log("🌀 portal.js loaded");

    const portal = document.createElement("img");
    portal.src = "images/portal.gif";
    portal.alt = "Back to top";
    portal.title = "🌀 Teleport to top";
    portal.id = "scrollPortal";

    Object.assign(portal.style, {
        position: "fixed",
        bottom: "40px",
        right: "20px",
        width: "60px",
        zIndex: "999",
        cursor: "pointer",
        display: "block"
    });

    portal.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("🌀 teleporting to top");
    
        document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
        document.body.scrollTo({ top: 0, behavior: "smooth" }); // ← important
    });
    
    

    document.body.appendChild(portal);
});
