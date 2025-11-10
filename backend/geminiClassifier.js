// backend/geminiClassifier.js
// geminiClassifier.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// geminiClassifier.js - NEW, CORRECTED CODE

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
async function classifyEmailWithGemini(emailContent, availableLabels) {
    if (!emailContent || !emailContent.body) {
        return "NONE";
    }

    const labelString = availableLabels.map(l => l.name).join(", ");

    const prompt = `
        You are an intelligent email classification assistant for a business.
        Analyze the following email and determine which single label is the most appropriate from the available list.

        Available labels: [${labelString}]

        Email Content:
        - From: ${emailContent.from}
        - Subject: ${emailContent.subject}
        - Body Snippet: ${emailContent.body.substring(0, 1500)}

        Based on the content, which single label best fits this email?
        If no label from the list is appropriate, respond with the exact word "NONE".
        Respond with only the name of the label from the list. Do not add any extra text or punctuation.
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const suggestedLabelName = response.text().trim();

        // Find the label object that matches the name Gemini returned
        const matchedLabel = availableLabels.find(l => l.name === suggestedLabelName);

        if (matchedLabel) {
            return matchedLabel; // Return the full label object {id, name}
        } else {
            return "NONE";
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return "NONE";
    }
}

module.exports = { classifyEmailWithGemini };