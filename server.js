const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

dotenv.config();

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= ERROR HANDLERS (IMPORTANT FOR RENDER) =================
process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION:", err);
});

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= MONGODB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB error:", err));

// ================= ITEM MODEL =================
const Item = mongoose.model("Item", {
  name: String,
  description: String,
  price: Number,
  wanted: String,
  image: String,
  sold: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// ================= MULTER (memory storage for Cloudinary) =================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ================= CLOUDINARY UPLOAD FUNCTION =================
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "swaply" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// ================= ROUTES =================

// GET ALL ITEMS
app.get("/items", async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE ITEM (WITH IMAGE UPLOAD)
app.post("/items", upload.single("image"), async (req, res) => {
  try {

    let imageUrl = "";

    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer);
    }

    const newItem = new Item({
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      wanted: req.body.wanted,
      image: imageUrl
    });

    await newItem.save();

    res.json(newItem);

  } catch (err) {
    console.log("UPLOAD ERROR:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// UPDATE ITEM (ADMIN)
app.put("/items/:id", async (req, res) => {
  try {
    const updated = await Item.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updated);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ITEM (ADMIN)
app.delete("/items/:id", async (req, res) => {
  try {
    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("Swaply API is running 🚀");
});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
