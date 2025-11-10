// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [labels, setLabels] = useState([]);
    const [newLabelName, setNewLabelName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ++ NEW STATE FOR CLASSIFICATION ++
    const [isClassifying, setIsClassifying] = useState(false);
    const [classificationResult, setClassificationResult] = useState('');

    useEffect(() => {
        axios.get('http://localhost:5000/auth/user')
            .then(res => {
                if (res.data) {
                    setUser(res.data);
                    fetchLabels();
                } else {
                    window.location.href = '/';
                }
            })
            .catch(() => window.location.href = '/');
    }, []);

    const fetchLabels = async () => {
        try {
            const res = await axios.get('http://localhost:5000/api/labels');
            setLabels(res.data.filter(label => label.type === 'user'));
            setLoading(false);
        } catch (err) { setError('Failed to fetch labels.'); setLoading(false); }
    };

    const handleCreateLabel = async (e) => {
        e.preventDefault();
        if (!newLabelName.trim()) return;
        try {
            await axios.post('http://localhost:5000/api/labels', { name: newLabelName });
            setNewLabelName('');
            fetchLabels();
        } catch (err) { setError('Failed to create label.'); }
    };

    const handleDeleteLabel = async (id) => {
        if (window.confirm('Are you sure you want to delete this label?')) {
            try {
                await axios.delete(`http://localhost:5000/api/labels/${id}`);
                fetchLabels();
            } catch (err) { setError('Failed to delete label.'); }
        }
    };

    // ++ NEW FUNCTION TO HANDLE CLASSIFICATION ++
    const handleClassifyEmails = async () => {
        setIsClassifying(true);
        setClassificationResult('Classification in progress, please wait...');
        setError('');
        try {
            const res = await axios.post('http://localhost:5000/api/classify');
            setClassificationResult(res.data.message);
        } catch (err) {
            setError('An error occurred during classification.');
            setClassificationResult('');
        } finally {
            setIsClassifying(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: 'auto' }}>
            {user && <h2>Welcome, {user.profile.displayName}!</h2>}
            <a href="http://localhost:5000/auth/logout">Logout</a>

            {/* ++ NEW CLASSIFICATION SECTION ++ */}
            <div style={{ border: '1px solid #007bff', padding: '15px', margin: '20px 0', backgroundColor: '#f0f8ff' }}>
                <h3>Smart Classification Engine</h3>
                <p>Click the button below to automatically classify your recent unread emails using your custom labels.</p>
                <button onClick={handleClassifyEmails} disabled={isClassifying} style={{ padding: '10px 15px', fontSize: '16px', cursor: 'pointer' }}>
                    {isClassifying ? 'Classifying...' : 'Run Auto-Classification'}
                </button>
                {classificationResult && <p style={{ marginTop: '10px', fontWeight: 'bold' }}>{classificationResult}</p>}
            </div>

            <h3>Manage Your Labels</h3>
            <form onSubmit={handleCreateLabel}>
                <input type="text" value={newLabelName} onChange={(e) => setNewLabelName(e.target.value)} placeholder="New label name" style={{ padding: '8px', marginRight: '10px' }} />
                <button type="submit" style={{ padding: '8px 12px' }}>Create Label</button>
            </form>

            {error && <p style={{ color: 'red' }}>{error}</p>}

            <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
                {labels.map(label => (
                    <li key={label.id} style={{ marginBottom: '10px', border: '1px solid #ccc', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{label.name}</span>
                        <button onClick={() => handleDeleteLabel(label.id)} style={{ backgroundColor: '#ff4d4d', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Dashboard;