// frontend/src/Components/Login.jsx
// src/components/Login.js
import React from 'react';

const Login = () => {
    const handleLogin = () => {
        // Redirect to the backend authentication route
        window.location.href = 'http://localhost:5000/auth/google';
    };

    return (
        <div style={{ textAlign: 'center', marginTop: '100px' }}>
            <h1>Gmail Label Manager</h1>
            <p>Please log in with your Google account to continue.</p>
            <button onClick={handleLogin} style={{ padding: '10px 20px', fontSize: '16px' }}>
                Login with Google
            </button>
        </div>
    );
};

export default Login;