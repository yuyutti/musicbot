const express = require('express');
const app = express();

app.get('/data', (req, res) => {
    if (!process.customData) {
        return res.status(503).json({ message: 'No data available' });
    }
    res.json(process.customData);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});