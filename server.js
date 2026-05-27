const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// ================= DB =================
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("DB Error", err));

// ================= MODELS =================
const User = mongoose.model("User", {
  email: String,
  password: String,
  online: { type: Boolean, default: false }
});

const Item = mongoose.model("Item", {
  name: String,
  description: String,
  category: String,
  wanted: String,
  imageURL: String,
  userId: String,
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", {
  from: String,
  to: String,
  text: String,
  image: String,
  createdAt: { type: Date, default: Date.now }
});

// ================= AUTH =================
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).send("No token");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).send("Invalid token");
  }
}

// ================= AUTH ROUTES =================
app.post("/register", async (req, res) => {
  const user = await User.create(req.body);
  res.json(user);
});

app.post("/login", async (req, res) => {
  const user = await User.findOne(req.body);
  if (!user) return res.status(401).json({ message: "Invalid" });

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token, user });
});

// ================= ITEMS =================
app.get("/items", async (req, res) => {
  res.json(await Item.find().sort({ createdAt: -1 }));
});

app.post("/items", auth, async (req, res) => {
  const item = await Item.create({
    ...req.body,
    userId: req.user.id
  });

  res.json(item);
});

// ================= CHAT =================
app.get("/messages/:userId", auth, async (req, res) => {
  const me = req.user.id;
  const other = req.params.userId;

  const msgs = await Message.find({
    $or: [
      { from: me, to: other },
      { from: other, to: me }
    ]
  }).sort({ createdAt: 1 });

  res.json(msgs);
});

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: { origin: "*" }
});

const onlineUsers = new Map();

io.on("connection", (socket) => {

  socket.on("join", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("onlineUsers", [...onlineUsers.keys()]);
  });

  socket.on("sendMessage", async (data) => {
    const msg = await Message.create(data);

    const receiverSocket = onlineUsers.get(data.to);

    if (receiverSocket) {
      io.to(receiverSocket).emit("newMessage", msg);
    }

    socket.emit("newMessage", msg);
  });

  socket.on("disconnect", () => {
    for (let [userId, id] of onlineUsers.entries()) {
      if (id === socket.id) {
        onlineUsers.delete(userId);
      }
    }
    io.emit("onlineUsers", [...onlineUsers.keys()]);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log("Server running on", PORT));
