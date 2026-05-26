const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// DB
mongoose.connect(process.env.MONGO_URL);

// MODELS
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

// AUTH MIDDLEWARE
function auth(req, res, next) {
  try {
    const token = req.headers.authorization;
    if (!token) return res.status(401).send("No token");

    const data = jwt.verify(token, "secret");
    req.user = data;
    next();
  } catch {
    res.status(401).send("Invalid token");
  }
}

// REGISTER
app.post("/register", async (req, res) => {
  const user = await User.create(req.body);
  res.json(user);
});

// LOGIN
app.post("/login", async (req, res) => {
  const user = await User.findOne(req.body);

  if (!user) return res.status(401).json({ message: "Invalid" });

  const token = jwt.sign({ id: user._id }, "secret");
  res.json({ token });
});

// ITEMS GET
app.get("/items", async (req, res) => {
  const items = await Item.find();
  res.json(items);
});

// ITEMS POST (protected)
app.post("/items", auth, async (req, res) => {
  const item = await Item.create({
    ...req.body,
    userId: req.user.id
  });

  res.json(item);
});

// DELETE ITEM (admin future)
app.delete("/items/:id", auth, async (req, res) => {
  await Item.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.listen(5000, () => console.log("Server running"));
