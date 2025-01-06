firebase.auth().onAuthStateChanged((user) => {
    // If the user is not authenticated and is not already on the login page
    if (!user && window.location.pathname !== "/login.html") window.location = "/login.html";
});
