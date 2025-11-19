const express = require("express");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

const USERS_FILE = path.join(__dirname, "users.json");
const MESSAGES_FILE = path.join(__dirname, "messages.json");

// --- Fonctions utilitaires ---
function getUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function getMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) return [];
  return JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8"));
}

function saveMessages(messages) {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

// --- Routes ---
app.post("/signup", (req, res) => {
  const { nom, age, email, password } = req.body;
  if (!nom || !age || !email || !password)
    return res.status(400).json({ message: "Champs manquants" });

  const users = getUsers();
  if (users.find(u => u.email === email))
    return res.status(400).json({ message: "Email déjà utilisé" });

  users.push({ nom, age, email, password });
  saveUsers(users);
  res.json({ message: "Inscription réussie !" });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const users = getUsers();

  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ message: "Email ou mot de passe incorrect" });

  res.json({ message: "Connexion réussie", user });
});

// --- Socket.io (chat en temps réel) ---
io.on("connection", (socket) => {
  console.log("🟢 Un utilisateur s'est connecté.");
  let username = "Anonyme";

  // Envoyer l'historique au nouvel utilisateur
  socket.emit("load messages", getMessages());

  socket.on("register", (nom) => {
    username = nom;
    io.emit("system", `${username} a rejoint le chat.`);
  });

  socket.on("chat message", (msg) => {
    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    const messageData = { user: username, text: msg, time };

    // Enregistrer le message
    const messages = getMessages();
    messages.push(messageData);
    saveMessages(messages);

    io.emit("chat message", messageData);
  });

  socket.on("disconnect", () => {
    io.emit("system", `${username} s'est déconnecté.`);
    console.log("🔴 Un utilisateur s'est déconnecté.");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
});

