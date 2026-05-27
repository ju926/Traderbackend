const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ========================
// DB CONNECTION (FIXED)
// ========================
const MONGO_URL = process.env.MONGO_URI || process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("❌ MongoDB URI is missing in environment variables");
  process.exit(1);
}

mongoose.connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err));

// ========================
// MODELS
// ========================
const User = mongoose.model("User", {
  email: String,
  password: String
});

const Item = mongoose.model("Item", {
  name: String,
  description: String,
  category: String,
  wanted: String,
  imageURL: String,
  userId: String
});

// ========================
// AUTH MIDDLEWARE
// ========================
function auth(req, res, next) {
  try {
    const token = req.headers.authorization;

    if (!token) return res.status(401).json({ message: "No token" });

    const data = jwt.verify(token, "secret");
    req.user = data;

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// ========================
// REGISTER
// ========================
app.post("/register", async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// LOGIN
// ========================
app.post("/login", async (req, res) => {
  try {
    const user = await User.findOne(req.body);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, "secret", {
      expiresIn: "7d"
    });

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// GET ITEMS
// ========================
app.get("/items", async (req, res) => {
  const items = await Item.find();
  res.json(items);
});

// ========================
// CREATE ITEM (PROTECTED)
// ========================
app.post("/items", auth, async (req, res) => {
  const item = await Item.create({
    ...req.body,
    userId: req.user.id
  });

  res.json(item);
});

// ========================
// DELETE ITEM (ADMIN OR OWNER)
// ========================
app.delete("/items/:id", auth, async (req, res) => {
  const item = await Item.findById(req.params.id);

  if (!item) return res.status(404).json({ message: "Not found" });

  // only owner can delete (future admin upgrade possible)
  if (item.userId !== req.user.id) {
    return res.status(403).json({ message: "Not allowed" });
  }

  await Item.findByIdAndDelete(req.params.id);

  res.json({ success: true });
});

// ========================
// START SERVER
// ========================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
