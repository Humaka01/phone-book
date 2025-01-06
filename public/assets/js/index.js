var currentUser;
var customerPhoneNumber;
var customerRecord;
var customerUid;

firebase.auth().onAuthStateChanged((user) => {
    if (user) currentUser = user;
    else window.location = "/login.html";
});

document.addEventListener("DOMContentLoaded", () => {
    closeInteractionDetailsPopupButton.addEventListener("click", closeDetailsPopup);
    reportFraudulent.addEventListener("change", handleReportFraudulentChange);
    serviceType.addEventListener("change", unlockBudgetField);
    submitInteractionButton.addEventListener("click", submitInteraction);
    cancelInteractionButton.addEventListener("click", hideAddInteractionPopup);
    addInteractionButton.addEventListener("click", showAddInteractionPopup);
    closePopupButton.addEventListener("click", hideGenericPopup);

    registerNewCustomerForm.addEventListener("submit", (event) => {
        event.preventDefault();
        saveCustomer();
        hideAndClearAll();
        beginSearch(customerPhoneNumber);
    });
    logoutButton.addEventListener("click", logOut);
    searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        beginSearch();
    });
    // Restrict phone number input to only numbers and one "+" sign at the beginning
    phoneNumberInput.addEventListener("input", validatePhoneNumberInput);
});

async function saveCustomer() {
    try {
        // Collect customer data
        const customerData = {
            first_name: customerFirstNameInput.value.trim().toLowerCase(),
            last_name: customerLastNameInput.value.trim().toLowerCase(),
            phone_number: customerPhoneNumber,
        };

        // Reference to the customer collection in the database
        const customerRef = firebase.database().ref("/customer");

        // Push the new customer data to the database
        const newCustomerRef = customerRef.push();
        await newCustomerRef.set(customerData);

        // Confirmation message and cleanup
        showPopup("Success", "Customer saved successfully");
    } catch (error) {
        showPopup("Error", "An error occurred while saving the customer");
        console.error("Error in saveCustomer(): ", error);
    }
}

async function beginSearch(phoneNumber) {
    hideAndClearAll();
    searchButton.disabled = true;
    searchButton.textContent = "Searching...";
    if (checkPhoneNumber()) {
        let customerData = await getCustomerData(phoneNumber);
        if (customerData) updateCustomerUI();
        else notFoundSection.style.display = "block";
    }
    searchButton.disabled = false;
    searchButton.textContent = "Search";
}

function checkPhoneNumber() {
    const phoneNumber = phoneNumberInput.value.trim();
    // Check if the phone number is not empty and is valid
    if (phoneNumber === "" || !/^(\+?\d{8,15})$/.test(phoneNumber)) {
        errorPhoneNumber.textContent = "Please enter a valid phone number.";
        return false;
    }
    errorPhoneNumber.textContent = ""; // Clear the error message
    customerPhoneNumber = phoneNumber;
    return true;
}

function logOut() {
    firebase
        .auth()
        .signOut()
        .then(() => {
            window.location = "/login.html";
        })
        .catch((error) => {
            console.error("Error signing out: ", error);
        });
}

function validatePhoneNumberInput(event) {
    let value = event.target.value;
    value = value.replace(/[^+\d]/g, "");

    if (value.indexOf("+") === 0) value = "+" + value.slice(1).replace(/\+/g, "");
    if (value.length > 15) value = value.substring(0, 15);

    event.target.value = value;
}

async function getCustomerData(phoneNumber) {
    try {
        const customerRef = firebase.database().ref("/customer");
        let query;
        if (phoneNumber) query = customerRef.orderByChild("phone_number").equalTo(phoneNumber);
        else query = customerRef.orderByChild("phone_number").equalTo(phoneNumberInput.value);

        const snapshot = await query.once("value");

        if (snapshot.exists()) {
            const customerData = snapshot.val();
            const uid = Object.keys(customerData)[0];
            customerUid = uid;
            customerRecord = customerData[uid];
            return customerRecord;
        } else return null;
    } catch (error) {
        console.error("Error fetching customer data:", error);
        return null;
    }
}

function hideAndClearAll() {
    notFoundSection.style.display = "none";
    fraudulentBehavior.style.display = "none";
    customerInformationSection.style.display = "none";
    customerNameSpan.textContent = "";
    customerPhoneNumberSpan.textContent = "";
    customerCooperationSpan.textContent = "";
    customerFinancialStatusSpan.textContent = "";
    customerStatusSpan.textContent = "";
    customerFirstNameInput.textContent = "";
    customerLastNameInput.textContent = "";
}

async function updateCustomerUI() {
    try {
        // Ensure we have a valid customerRecord
        if (!customerRecord) {
            showPopup("Error", "An error has occurred while getting customer data");
            console.error("Customer record is missing.");
        }

        // Update the Customer Profile section
        customerNameSpan.textContent = `${
            capitalizeFirstLetters(customerRecord.first_name) || "N/A"
        } ${capitalizeFirstLetters(customerRecord.last_name) || "N/A"}`;
        customerPhoneNumberSpan.textContent = customerRecord.phone_number || "N/A";
        customerFinancialStatusSpan.textContent = customerRecord.financial_status || "Unknown";

        // Check for fraudulent behavior
        const customerFraudulentFlag = customerRecord.is_fraudulent || false;

        let interactionFraudulentFlag = false;
        const customerInteractions = customerRecord.interactions || {}; // Default to an empty object

        const interactionsCount = Object.keys(customerInteractions).length; // Get the number of interactions
        let interactionsTotal = 0;

        // Check if any interaction is marked as fraudulent
        for (const key in customerInteractions) {
            if (customerInteractions[key]?.is_fraudulent) {
                interactionFraudulentFlag = true;
            }
            interactionsTotal += parseFloat(customerInteractions[key].interaction_rating) || 0;
        }

        // Calculate the interaction score (handle division by zero)
        let interactionScore = "N/A";
        if (interactionsCount > 0)
            interactionScore = (interactionsTotal / interactionsCount).toFixed(1);

        let interactionColor;

        if (interactionScore < 2.5) interactionColor = "var(--error-color)";
        else if (interactionScore >= 2.5 && interactionScore < 4)
            interactionColor = "var(--warning-color)";
        else if (interactionScore >= 4) interactionColor = "green";

        if (interactionScore !== "N/A") {
            customerCooperationSpan.style.color = interactionColor;
            customerCooperationSpan.style.fontWeight = "bold";
        }

        customerCooperationSpan.textContent = interactionScore;

        // Combine both flags to determine if the customer is fraudulent
        const isFraudulent = customerFraudulentFlag || interactionFraudulentFlag;

        // Display fraudulent behavior section based on combined flag
        fraudulentBehavior.style.display = isFraudulent ? "block" : "none";

        // Determine the status of the customer based on previous interactions
        customerStatusSpan.textContent = "N/A";
        if (isFraudulent) {
            customerStatusSpan.textContent = "POOR"; // Fraudulent and low interaction score
            customerStatusSpan.style.color = "var(--error-color)";
            customerStatusSpan.style.fontWeight = "bold";
        } else if (!isFraudulent && interactionScore && parseFloat(interactionScore) >= 3) {
            customerStatusSpan.textContent = "HEALTHY"; // Not fraudulent and good interaction score
            customerStatusSpan.style.color = "green";
            customerStatusSpan.style.fontWeight = "bold";
        } else if (!isFraudulent && interactionScore && parseFloat(interactionScore) < 3) {
            customerStatusSpan.textContent = "NEUTRAL"; // Not fraudulent and poor interaction score
            customerStatusSpan.style.color = "var(--warning-color)";
            customerStatusSpan.style.fontWeight = "bold";
        }

        // Update the Interactions Section
        await populateInteractionsList(customerInteractions);

        // Show the customer information section
        customerInformationSection.style.display = "block";
    } catch (error) {
        showPopup("Error", "Error updating customer information!");
        console.error("Error updating customer UI:", error);
    }
}

function showAddInteractionPopup() {
    interactionsPopupOverlay.style.display = "block";
    addInteractionPopup.style.display = "flex";
}

function hideAddInteractionPopup() {
    interactionsPopupOverlay.style.display = "none";
    addInteractionPopup.style.display = "none";
    clearAddInteractionPopup();
}

async function submitInteraction() {
    submitInteractionButton.disabled = true;
    cancelInteractionButton.disabled = true;
    submitInteractionButton.textContent = "Submitting...";
    if (checkInteractionForm()) {
        const interactionData = getInteractionData();

        try {
            await firebase
                .database()
                .ref(`customer/${customerUid}/interactions`)
                .push(interactionData);

            hideAddInteractionPopup();
            showPopup("Success", "Customer interaction saved successfully");
            await beginSearch();
            submitInteractionButton.disabled = false;
            cancelInteractionButton.disabled = false;
            submitInteractionButton.textContent = "Submit";
        } catch (error) {
            console.error("Error saving interaction data:", error);
            showPopup("Error", "Failed to save the interaction. Please try again.");
            submitInteractionButton.disabled = false;
            cancelInteractionButton.disabled = false;
            submitInteractionButton.textContent = "Submit";
        }
    } else {
        showPopup("Hold on!", "Please make sure all required fields are filled");
        submitInteractionButton.disabled = false;
        cancelInteractionButton.disabled = false;
        submitInteractionButton.textContent = "Submit";
    }
}

function clearAddInteractionPopup() {
    customerIntent.value = "";
    serviceType.value = "";
    propertyValue.value = "";
    rentValue.value = "";
    interactionDetails.value = "";
    horribleInteraction.checked = false;
    badInteraction.checked = false;
    neutralInteraction.checked = false;
    goodInteraction.checked = false;
    excellentInteraction.checked = false;
    reportFraudulent.checked = false;
    propertyValue.disabled = true;
    rentValue.placeholder = "";
    rentValue.disabled = true;
    propertyValue.placeholder = "";
}

function showPopup(title, content) {
    popupTitle.textContent = title;
    popupContent.textContent = content;
    genericPopup.style.display = "block";
    genericPopupOverlay.style.display = "block";
}

function hideGenericPopup() {
    popupTitle.textContent = "";
    popupContent.textContent = "";
    genericPopup.style.display = "none";
    genericPopupOverlay.style.display = "none";
}

function unlockBudgetField() {
    if (serviceType.value === "sale") {
        rentValue.disabled = true;
        rentValue.placeholder = "";
        propertyValue.disabled = false;
        propertyValue.placeholder = "Enter amount in EUR";
    } else if (serviceType.value === "rent") {
        propertyValue.disabled = true;
        rentValue.disabled = false;
        propertyValue.placeholder = "";
        rentValue.placeholder = "Enter amount in EUR";
    }
    propertyValue.value = "";
    rentValue.value = "";
}

function handleReportFraudulentChange() {
    if (reportFraudulent.checked) reportFraudulentLabel.style.fontWeight = "bold";
    else reportFraudulentLabel.style.fontWeight = "normal";
}

function checkInteractionForm() {
    let isValid = true;
    if (customerIntent.value === "") {
        customerIntent.style.borderColor = "var(--error-color)";
        customerIntentLabel.style.color = "var(--error-color)";
        customerIntentLabel.style.fontWeight = "bold";
        isValid = false;
    } else {
        customerIntent.style.borderColor = "var(--light-color)";
        customerIntentLabel.style.color = "var(--light-color)";
        customerIntentLabel.style.fontWeight = "normal";
    }

    if (serviceType.value === "") {
        serviceType.style.borderColor = "var(--error-color)";
        serviceTypeLabel.style.color = "var(--error-color)";
        serviceTypeLabel.style.fontWeight = "bold";
        isValid = false;
    } else {
        serviceType.style.borderColor = "var(--light-color)";
        serviceTypeLabel.style.color = "var(--light-color)";
        serviceTypeLabel.style.fontWeight = "normal";
    }

    if (serviceType.value === "sale" && propertyValue.value === "") {
        propertyValue.style.borderColor = "var(--error-color)";
        propertyValueLabel.style.color = "var(--error-color)";
        propertyValueLabel.style.fontWeight = "bold";
        isValid = false;
    } else {
        propertyValue.style.borderColor = "var(--light-color)";
        propertyValueLabel.style.color = "var(--light-color)";
        propertyValueLabel.style.fontWeight = "normal";
    }

    if (serviceType.value === "rent" && rentValue.value === "") {
        rentValue.style.borderColor = "var(--error-color)";
        rentValueLabel.style.color = "var(--error-color)";
        rentValueLabel.style.fontWeight = "bold";
        isValid = false;
    } else {
        rentValue.style.borderColor = "var(--light-color)";
        rentValueLabel.style.color = "var(--light-color)";
        rentValueLabel.style.fontWeight = "normal";
    }

    if (reportFraudulent.checked === true && interactionDetails.value === "") {
        interactionDetails.style.borderColor = "var(--error-color)";
        interactionDetailsLabel.style.color = "var(--error-color)";
        interactionDetailsLabel.style.fontWeight = "bold";
        isValid = false;
    } else {
        interactionDetails.style.borderColor = "var(--light-color)";
        interactionDetailsLabel.style.color = "var(--light-color)";
        interactionDetailsLabel.style.fontWeight = "normal";
    }

    if (
        !horribleInteraction.checked &&
        !badInteraction.checked &&
        !neutralInteraction.checked &&
        !goodInteraction.checked &&
        !excellentInteraction.checked
    ) {
        interactionFeedbackLabel.style.color = "var(--error-color)";
        interactionFeedbackLabel.style.fontWeight = "bold";
        isValid = false;
    } else {
        interactionFeedbackLabel.style.color = "var(--dark-color)";
        interactionFeedbackLabel.style.fontWeight = "normal";
    }

    return isValid;
}

function getInteractionData() {
    let interactionRating;
    const selectedRating = document.querySelector('input[name="interactionFeedback"]:checked');
    if (selectedRating) interactionRating = selectedRating.value;

    const interaction = {
        intent: customerIntent.value || null,
        service: serviceType.value || null,
        property_budget: propertyValue.value || null,
        rent_budget: rentValue.value || null,
        interaction_details: interactionDetails.value || null,
        interaction_rating: interactionRating || null,
        is_fraudulent: reportFraudulent.checked,
        created_by: currentUser.uid || null,
        created_at: firebase.database.ServerValue.TIMESTAMP,
    };

    return interaction;
}

async function populateInteractionsList(interactions) {
    // Reference the table body
    const tableBody = document.querySelector("#customerInteractions tbody");

    // Clear existing rows
    tableBody.innerHTML = "";

    const interactionKeys = Object.keys(interactions);

    if (interactionKeys.length > 0) {
        // Sort interactions by timestamp in descending order (newest first)
        const sortedInteractions = interactionKeys.sort(
            (a, b) => interactions[b].created_at - interactions[a].created_at
        );

        // Populate the table with rows
        sortedInteractions.forEach((key) => {
            const interaction = interactions[key];
            const row = document.createElement("tr");

            // Timestamp cell
            const timestampCell = document.createElement("td");
            timestampCell.textContent = new Date(interaction.created_at).toLocaleString();

            // Intent cell
            const intentCell = document.createElement("td");
            intentCell.textContent = interaction.intent
                ? interaction.intent.charAt(0).toUpperCase() + interaction.intent.slice(1)
                : "N/A";
            row.appendChild(intentCell);

            // Service cell
            const serviceCell = document.createElement("td");
            serviceCell.textContent = interaction.service
                ? interaction.service.charAt(0).toUpperCase() + interaction.service.slice(1)
                : "N/A";
            row.appendChild(serviceCell);

            // Rating cell
            const feedbackIcons = {
                1: "😠 Horrible",
                2: "😞 Bad",
                3: "😐 Neutral",
                4: "😊 Good",
                5: "😁 Excellent",
            };

            const ratingCell = document.createElement("td");
            ratingCell.textContent = feedbackIcons[interaction.interaction_rating] || "N/A";

            if (
                interaction.interaction_rating &&
                (interaction.interaction_rating < 1 ||
                    interaction.interaction_rating > 5 ||
                    !Number.isInteger(Number(interaction.interaction_rating)))
            ) {
                showPopup("Error", "This page contains an error");
                console.error(
                    `Interaction "${key}" has a rating that is out of the acceptable range`
                );
            }

            // Fraud cell
            const fraudCell = document.createElement("td");
            if (interaction.is_fraudulent) {
                row.classList.add("fraudulent");
                fraudCell.textContent = "Yes";
                fraudCell.style.color = "red";
            } else fraudCell.textContent = "No";

            // Details cell
            const detailsCell = document.createElement("td");
            const detailsLink = document.createElement("a");
            detailsLink.id = key;
            detailsLink.title = "More details";

            // Add the SVG icon
            const detailsIcon = document.createElement("img");
            detailsIcon.src = "/assets/images/details-block.svg";
            detailsIcon.alt = "More details";
            detailsIcon.style.width = "16px";
            detailsIcon.style.height = "16px";

            // Append the icon to the link
            detailsLink.appendChild(detailsIcon);

            // Attach click event to call showInteraction
            detailsLink.addEventListener("click", () => showInteractionPopup(key));

            // Append the link to the cell
            detailsCell.appendChild(detailsLink);

            // Append cells to the row
            row.appendChild(timestampCell);
            row.appendChild(intentCell);
            row.appendChild(serviceCell);
            row.appendChild(ratingCell);
            row.appendChild(fraudCell);
            row.appendChild(detailsCell);

            // Append the row to the table body
            tableBody.appendChild(row);
        });
    } else {
        // Show a "no interactions" row
        const noInteractionsRow = document.createElement("tr");
        const noInteractionsCell = document.createElement("td");
        noInteractionsCell.colSpan = 6;
        noInteractionsCell.textContent = "There are no recorded interactions with this customer";
        noInteractionsRow.appendChild(noInteractionsCell);
        tableBody.appendChild(noInteractionsRow);
    }
}

async function showInteractionPopup(interactionId) {
    try {
        // Get interaction data
        const interactionData = await getInteractionDetails(interactionId);

        // Check if data is retrieved successfully
        if (!interactionData) {
            console.error("No interaction data found.");
            return;
        }

        // Populate Interaction Date
        const interactionDate = new Date(interactionData.created_at).toLocaleString(); // Convert timestamp to readable date
        detailsDate.innerText = interactionDate;

        // Populate Customer’s Intent
        detailsCustomerIntent.innerText = capitalizeFirstLetters(interactionData.intent) || "N/A";

        // Populate Service Type
        detailsServiceType.innerText = capitalizeFirstLetters(interactionData.service) || "N/A";

        // Populate Value / Budget
        if (interactionData.rent_budget)
            detailsValue.innerText = interactionData.rent_budget + " EURO";
        else if (interactionData.property_budget)
            detailsValue.innerText = interactionData.property_budget + " EURO";
        else detailsValue.innerText = "N/A";

        // Populate Interaction Details
        if (interactionData.interaction_details) {
            detailsInteractionDetails.innerText = interactionData.interaction_details;
            detailsInteractionDetails.style.display = "block";
            detailsNoInteractionDetails.style.display = "none";
        } else {
            detailsNoInteractionDetails.textContent = "N/A";
            detailsNoInteractionDetails.style.display = "block";
            detailsInteractionDetails.style.display = "none";
        }

        // Populate Interaction Feedback
        const feedbackIcons = {
            1: "😠 Horrible",
            2: "😞 Bad",
            3: "😐 Neutral",
            4: "😊 Good",
            5: "😁 Excellent",
        };
        detailsInteractionFeedback.innerText =
            feedbackIcons[interactionData.interaction_rating] || "N/A";

        // Populate Report Fraudulent
        const isFraudulent = interactionData.is_fraudulent ? "Yes" : "No";
        detailsReportedFraudulent.innerText = isFraudulent;

        // Show Popup
        interactionsDetailsPopupOverlay.style.display = "block";
        interactionDetailsPopup.style.display = "block";
    } catch (error) {
        console.error("Error showing interaction popup:", error);
    }
}

async function getInteractionDetails(interactionId) {
    try {
        // Construct the path to the interaction data
        const interactionPath = `customer/${customerUid}/interactions/${interactionId}`;

        // Retrieve the data from the database
        const interactionRef = firebase.database().ref(interactionPath);
        const snapshot = await interactionRef.once("value");

        // Check if the data exists
        if (!snapshot.exists())
            throw new Error(`Interaction with ID ${interactionId} does not exist.`);

        // Return the interaction data
        return snapshot.val();
    } catch (error) {
        showPopup("Error", "Error retrieving interaction information");
        console.error("Error in getInteractionDetails(interactionId):", error);
    }
}

function closeDetailsPopup() {
    interactionDetailsPopup.style.display = "none";
    interactionsDetailsPopupOverlay.style.display = "none";
    detailsCustomerIntent.textContent = "";
    detailsServiceType.textContent = "";
    detailsValue.textContent = "";
    detailsInteractionDetails.textContent = "";
    detailsInteractionFeedback.innerHTML = "";
    detailsReportedFraudulent.textContent = "";
}

function capitalizeFirstLetters(string) {
    if (!string) return null;
    return string
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
