const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.status(200).type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Demo CI/CD Project</title>
  <style>
    body { font-family: sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1rem; color: #222; }
    h1 { margin-bottom: 0.25rem; }
    .badge { display: inline-block; background: #0b3d2e; color: #fff; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.85rem; }
  </style>
</head>
<body>
  <span class="badge">status: ok</span>
  <h1>Demo CI/CD Project</h1>
  <p>
    This pagee is served by a Node.js (Express) app running in the
    <strong>demo</strong> namespace on DigitalOcean Kubernetes, deployed via
    a Jenkins pipeline that builds a Docker image, tags it with the git
    commit SHA, pushes it to DigitalOcean Container Registry, and rolls it
    out with <code>kubectl set image</code>.
  </p>
  <p>Health checks live at <a href="/health">/health</a>.</p>
</body>
</html>`);
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.listen(PORT, () => {
  console.log(`demo-app listening on port ${PORT}`);
});

module.exports = app;
