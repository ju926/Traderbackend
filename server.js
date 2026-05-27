require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const compression = require("compression");

const app = express();

app.use(cors());
app.use(express.json());
app.use(compression());

// =====================
// MONGO DB CONNECTION
// =====================
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// =====================
// MODELS
// =====================
const User = mongoose.model("User", {
  name: String,
  email: String,
  password: String,
  createdAt: { type: Date, default: Date.now }
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

const Chat = mongoose.model("Chat", {
  participants: [String], // buyer + seller
  messages: [
    {
      senderId: String,
      text: String,
      image: String,
      time: { type: Date, default: Date.now }
    }
  ]
});

// =====================
// AUTH MIDDLEWARE
// =====================
function auth(req, res, next) {
  try {
    const token = req.headers.authorization;

    if (!token) return res.status(401).json({ message: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
}

// =====================
// AUTH ROUTES
// =====================

// REGISTER
app.post("/register", async (req, res) => {
  try {
    const hashed = await bcrypt.hash(req.body.password, 10);

    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: hashed
    });

    res.json({ message: "User created", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) return res.status(401).json({ message: "User not found" });

    const ok = await bcrypt.compare(req.body.password, user.password);

    if (!ok) return res.status(401).json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================
// ITEMS
// =====================

// GET ALL ITEMS
app.get("/items", async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.json(items);
});

// CREATE ITEM (AUTH REQUIRED)
app.post("/items", auth, async (req, res) => {
  try {
    const item = await Item.create({
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      wanted: req.body.wanted,
      imageURL: req.body.imageURL,
      userId: req.user.id
    });

    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ITEM
app.delete("/items/:id", auth, async (req, res) => {
  await Item.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// =====================
// CHAT SYSTEM (BASIC)
// =====================

// CREATE OR GET CHAT
app.post("/chat/start", auth, async (req, res) => {
  const { sellerId } = req.body;

  let chat = await Chat.findOne({
    participants: { $all: [req.user.id, sellerId] }
  });

  if (!chat) {
    chat = await Chat.create({
      participants: [req.user.id, sellerId],
      messages: []
    });
  }

  res.json(chat);
});

// SEND MESSAGE
app.post("/chat/send", auth, async (req, res) => {
  const { chatId, text, image } = req.body;

  const chat = await Chat.findById(chatId);

  chat.messages.push({
    senderId: req.user.id,
    text,
    image
  });

  await chat.save();

  res.json(chat);
});

// GET USER CHATS
app.get("/chat/my", auth, async (req, res) => {
  const chats = await Chat.find({
    participants: req.user.id
  });

  res.json(chats);
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
