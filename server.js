const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files from the project directory
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 IT Helpdesk is running locally!`);
  console.log(`👉 Access the Admin Dashboard: http://localhost:${PORT}/index.html`);
  console.log(`👉 Access the User Portal:     http://localhost:${PORT}/portal.html`);
  console.log(`==================================================`);
});
