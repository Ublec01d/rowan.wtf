
//  Firebase initialization and script -->

document.addEventListener("DOMContentLoaded", function() {
    // Firebase configuration
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
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

    // Initialize Firebase Authentication
    firebase.auth().signInAnonymously()
    .then(() => {
    console.log("User signed in anonymously");
    })
    .catch((error) => {
    console.error("Error signing in:", error);
    });

    let lastPasteTime = 0;

    // Add event listener for adding text
    document.getElementById("addButton").addEventListener("click", function() {
        addText();
    });

    // Function to add text to Firebase Realtime Database
    function addText() {
        const userInput = document.getElementById("inputBox").value;
        if (!userInput.trim()) return;
    
        const now = Date.now();
        if (now - lastPasteTime < 5000) {
            alert("Please wait a few seconds before submitting again.");
            return;
        }
        lastPasteTime = now;
    
        database.ref('texts').push({
            text: userInput
        }, function(error) {
            if (error) {
                console.error("Error adding text:", error);
            } else {
                document.getElementById("inputBox").value = '';
                loadText();
            }
        });
    }
    

    // Function to load stored texts from Firebase Realtime Database
    function loadText() {
        const displayText = document.getElementById("displayText");
        displayText.innerHTML = ''; // Clear current content

        // Retrieve data from Firebase
        database.ref('texts').once('value', function(snapshot) {
            snapshot.forEach(function(childSnapshot) {
                const childData = childSnapshot.val();
                const newText = document.createElement("p");
                newText.textContent = childData.text;
                displayText.appendChild(newText);
            });
        }, function(error) {
            console.error("Error loading texts:", error);
        });
    }

    // Load the texts when the page is loaded
    loadText();
});
