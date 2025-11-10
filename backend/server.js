// backend/server.js
// server.js
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');
const session = require('express-session');
const cookieSession = require('cookie-session');
const cors = require('cors');
const { classifyEmailWithGemini } = require('./geminiClassifier'); // Import the new module
require('dotenv').config();

const app = express();

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieSession({ name: 'gmail-label-session', keys: [process.env.COOKIE_KEY], maxAge: 24 * 60 * 60 * 1000 }));
app.use(passport.initialize());
app.use(passport.session());

// --- Auth Check Middleware ---
const isLoggedIn = (req, res, next) => req.user ? next() : res.sendStatus(401);

// --- Passport.js Setup ---
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    // ++ UPDATED SCOPE ++
    scope: ['profile', 'https://www.googleapis.com/auth/gmail.modify']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, { profile, accessToken, refreshToken });
}));

// --- Auth Routes ---
app.get('/auth/google', passport.authenticate('google'));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => res.redirect('http://localhost:3000/dashboard'));
app.get('/auth/logout', (req, res) => { req.session = null; req.logout(); res.redirect('http://localhost:3000/'); });
app.get('/auth/user', (req, res) => res.send(req.user));

// --- Helper Functions ---
function getGmailClient(user) {
    const oAuth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, "/auth/google/callback");
    oAuth2Client.setCredentials({ access_token: user.accessToken });
    return google.gmail({ version: 'v1', auth: oAuth2Client });
}

// --- Gmail API Routes ---
app.get('/api/labels', isLoggedIn, async (req, res) => {
    try {
        const gmail = getGmailClient(req.user);
        const response = await gmail.users.labels.list({ userId: 'me' });
        res.json(response.data.labels);
    } catch (error) { res.status(500).send('Error fetching labels'); }
});

app.post('/api/labels', isLoggedIn, async (req, res) => {
    try {
        const gmail = getGmailClient(req.user);
        const response = await gmail.users.labels.create({
            userId: 'me',
            requestBody: { name: req.body.name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
        });
        res.json(response.data);
    } catch (error) { res.status(500).send('Error creating label'); }
});

app.delete('/api/labels/:id', isLoggedIn, async (req, res) => {
    try {
        const gmail = getGmailClient(req.user);
        await gmail.users.labels.delete({ userId: 'me', id: req.params.id });
        res.status(204).send();
    } catch (error) { res.status(500).send('Error deleting label'); }
});

// +++ NEW CLASSIFICATION ENDPOINT +++
app.post('/api/classify', isLoggedIn, async (req, res) => {
    try {
        const gmail = getGmailClient(req.user);
        let classifiedCount = 0;

        // 1. Get user-created labels
        const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
        const userLabels = labelsResponse.data.labels.filter(l => l.type === 'user');
        if (userLabels.length === 0) {
            return res.json({ message: "No custom labels found to classify with. Please create some labels first.", count: 0 });
        }

        // 2. Find recent, unlabeled emails
        const messagesResponse = await gmail.users.messages.list({
            userId: 'me',
            q: 'in:inbox -category:{promotions,social,updates,forums} is:unread', // Example query: Unread, not in a category
            maxResults: 20, // Limit to 20 emails per run to avoid long waits
        });
        const messages = messagesResponse.data.messages || [];

        // 3. Loop and classify each email
        for (const messageHeader of messages) {
            const message = await gmail.users.messages.get({ userId: 'me', id: messageHeader.id, format: 'full' });
            const headers = message.data.payload.headers;
            const emailContent = {
                from: headers.find(h => h.name === 'From').value,
                subject: headers.find(h => h.name === 'Subject').value,
                body: message.data.snippet, // Snippet is usually enough and much faster
            };

            const suggestedLabel = await classifyEmailWithGemini(emailContent, userLabels);

            if (suggestedLabel !== "NONE") {
                // 4. Apply the label
                await gmail.users.messages.modify({
                    userId: 'me',
                    id: messageHeader.id,
                    requestBody: {
                        addLabelIds: [suggestedLabel.id],
                    },
                });
                classifiedCount++;
            }
        }

        res.json({ message: `Classification complete. Applied labels to ${classifiedCount} emails.`, count: classifiedCount });

    } catch (error) {
        console.error('Error during classification:', error);
        res.status(500).send('An error occurred during classification.');
    }
});


// --- Server Start ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server listening on port ${PORT}`));