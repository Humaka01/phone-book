firebase.auth().onAuthStateChanged((user) => {
    if (user) window.location = "/";
});

document.addEventListener("DOMContentLoaded", () => {
    const loginButton = document.getElementById("loginButton");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    loginButton.addEventListener("click", (e) => {
        e.preventDefault();

        // Clear previous error messages
        clearErrors();

        // Validate email and password
        const email = emailInput.value.trim(); // Trim to remove unnecessary spaces
        const password = passwordInput.value.trim();

        if (!validateEmail(email)) {
            showError("errorEmail", "Please enter a valid email.");
            return;
        }

        if (!validatePassword(password)) {
            showError("errorCredentials", "Password must be at least 6 characters.");
            return;
        }

        // Disable the login button while processing
        loginButton.disabled = true;
        loginButton.textContent = "Please wait...";

        // Proceed with login
        userEmailLogin(email, password);
    });
});

function userEmailLogin(email, password) {
    const loginButton = document.getElementById("loginButton"); // Re-fetch in case of scoping issues
    return firebase
        .auth()
        .signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            window.location.href = "/"; // Redirect on successful login
        })
        .catch((error) => {
            if (error.code === "auth/user-not-found") {
                showError("errorCredentials", "User not found.");
            } else if (error.code === "auth/wrong-password") {
                showError("errorCredentials", "Incorrect password.");
            } else {
                showError("errorCredentials", "An error occurred. Please try again.");
            }

            // Re-enable the login button after processing
            loginButton.disabled = false;
            loginButton.textContent = "Login";
        });
}

function validateEmail(email) {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email);
}

function validatePassword(password) {
    return password.length >= 6; // Minimum password length
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

function clearErrors() {
    const errorElements = document.querySelectorAll(".error-message");
    errorElements.forEach((errorElement) => {
        errorElement.textContent = "";
    });
}
