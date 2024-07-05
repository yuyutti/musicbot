const express = require('express');
const app = express();

app.get('/data', (req, res) => {
    res.json(process.customData);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});