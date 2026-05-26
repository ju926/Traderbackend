const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

/* CLOUDINARY */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* MONGODB */
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

/* SCHEMA */
const ItemSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: String,
  wanted: String,
  image: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Item = mongoose.model("Item", ItemSchema);

/* GET ITEMS */
app.get("/items", async (req, res) => {

  try {

    const items = await Item.find().sort({ createdAt: -1 });

    res.json(items);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* UPLOAD ITEM */
app.post("/items", upload.single("image"), async (req, res) => {

  try {

    let imageURL = "";

    if (req.file) {

      const result = await cloudinary.uploader.upload(req.file.path);

      imageURL = result.secure_url;
    }

    const item = new Item({
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      wanted: req.body.wanted,
      image: imageURL
    });

    await item.save();

    res.status(201).json(item);

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: err.message
    });

  }

});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
