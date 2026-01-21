const express = require('express');
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({status: 'Phase 0 Complete!'}));
app.listen(3001, () => console.log('Server on 3001'));