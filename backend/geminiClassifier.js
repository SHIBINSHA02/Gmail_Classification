// backend/geminiClassifier.js

const { GoogleGenAI } = require("@google/genai");

// Initialize the client. We do this inside the function or lazily to ensure 
// process.env.API_KEY is loaded if dotenv is configured late in server.js, 
// though best practice is to load dotenv at the top of the entry file.

async function classifyEmailWithGemini(emailContent, availableLabels) {
    // Ensure API Key is available
    if (!process.env.GEMINI_API_KEY) {
        console.error("ERROR: process.env.API_KEY is missing. Check your .env file.");
        return "NONE";
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // --- 2. LOG INPUTS ---
    console.log("--- classifyEmailWithGemini ACTIVATED ---");
    console.log("INPUT: emailContent:", emailContent);
    console.log("INPUT: availableLabels:", availableLabels);
    console.log("-----------------------------------------");

    if (!emailContent || !emailContent.body) {
        // --- 3. LOG EARLY EXIT ---
        console.log("OUTPUT: Early Exit - Missing emailContent or body. Returning 'NONE'.");
        return "NONE";
    }

    const labelString = availableLabels.map(l => l.name).join(", ");

    // UPDATED PROMPT: Force selection of the closest label
    const prompt = `
        You are an intelligent email classification assistant for a business.
        Analyze the following email and determine which single label is the CLOSEST match from the available list.

        Available labels: [${labelString}]

        Email Content:
        - From: ${emailContent.from}
        - Subject: ${emailContent.subject}
        - Body Snippet: ${emailContent.body.substring(0, 1500)}

        Task:
        1. Analyze the email content carefully.
        2. Select the single label from the list that is semantically closest to the email's topic.
        3. You MUST select a label. Do NOT return "NONE". If no label is a perfect match, pick the one that is the best approximation or "closest" fit.
        4. Respond with ONLY the exact name of the selected label.
    `;

    // --- 4. LOG PROMPT ---
    console.log("PROMPT SENT TO GEMINI:", prompt);
    console.log("-----------------------------------------");

    try {
        // UPDATED: Use ai.models.generateContent with thinkingConfig
        // thinkingBudget allows the model to "wait" and reason to find the best fit
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                thinkingConfig: {
                    thinkingBudget: 2048, // Allocate thinking tokens to improve decision quality
                }
            }
        });

        // UPDATED: Access text property directly
        const suggestedLabelName = response.text ? response.text.trim() : "";

        // --- 5. LOG RAW RESPONSE ---
        console.log("RAW GEMINI RESPONSE TEXT:", suggestedLabelName);

        // Find the label object that matches the name Gemini returned
        const matchedLabel = availableLabels.find(l => l.name.toLowerCase() === suggestedLabelName.toLowerCase());

        if (matchedLabel) {
            // --- 6. LOG SUCCESSFUL MATCH ---
            console.log("OUTPUT: Successfully matched label:", matchedLabel);
            return matchedLabel; // Return the full label object {id, name}
        } else {
            // --- 7. LOG NO MATCH ---
            // Even with the forced prompt, if it returns something weird, we handle it.
            console.log(`OUTPUT: No label matched the raw response "${suggestedLabelName}". Returning 'NONE'.`);
            return "NONE";
        }
    } catch (error) {
        // --- 8. LOG API ERROR ---
        console.error("Error calling Gemini API:", error);
        console.log("OUTPUT: API Error. Returning 'NONE'.");
        return "NONE";
    } finally {
        console.log("--- classifyEmailWithGemini FINISHED ---");
    }
}

module.exports = { classifyEmailWithGemini };
