const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected ✔"))
  .catch(err => console.log(err));

// Schema
const Item = mongoose.model("Item", {
  name: String,
  description: String,
  category: String,
  wanted: String,
  imageURL: String,
  createdAt: { type: Date, default: Date.now }
});

// ROUTES

// Create item
app.post("/items", async (req, res) => {
  try {
    const item = new Item(req.body);
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get items
app.get("/items", async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.json(items);
});

// Home route (Render test)
app.get("/", (req, res) => {
  res.send("Swaply API running 🚀");
});

// PORT (VERY IMPORTANT FOR RENDER)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
