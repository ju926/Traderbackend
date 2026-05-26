const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ================= MONGODB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// ================= MODEL =================
const Item = mongoose.model("Item", {
  name: String,
  description: String,
  price: Number,
  wanted: String,
  image: String,
  sold: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// ================= MULTER =================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ================= UPLOAD IMAGE TO CLOUDINARY =================
function uploadToCloudinary(fileBuffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "swaply" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
}

// ================= ROUTES =================

// GET ALL ITEMS
app.get("/items", async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.json(items);
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
    console.log(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// UPDATE ITEM (ADMIN)
app.put("/items/:id", async (req, res) => {
  const updated = await Item.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updated);
});

// DELETE ITEM (ADMIN)
app.delete("/items/:id", async (req, res) => {
  await Item.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
