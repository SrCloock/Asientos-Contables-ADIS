const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Credenciales hardcodeadas
const validCredentials = {
  username: "admin",
  password: "admin"
};

// Endpoint de login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === validCredentials.username && password === validCredentials.password) {
    res.json({ success: true, message: "Login exitoso" });
  } else {
    res.status(401).json({ success: false, message: "Credenciales inválidas" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});