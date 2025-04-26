const path = require('path');

const express = require('express');
const app = express();

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/data', (req, res) => {
    res.json(process.customData);
});

app.get('/dashboard-data', (req, res) => {
    res.json(process.dashboardData);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});