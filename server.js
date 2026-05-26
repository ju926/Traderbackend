const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/swaply")
  .then(() => console.log("MongoDB connected ✔"))
  .catch(err => console.log(err));

// Schema
const Item = mongoose.model("Item", {
  name: String,
  description: String,
  createdAt: { type: Date, default: Date.now }
});

// POST item
app.post("/items", async (req, res) => {
  const item = new Item(req.body);
  await item.save();
  res.json(item);
});

// GET items
app.get("/items", async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.json(items);
});

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
