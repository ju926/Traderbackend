require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const http = require("http");
const { Server } = require("socket.io");
const compression = require("compression");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());
app.use(compression());

/* =========================================
   CLOUDINARY
========================================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* =========================================
   MULTER
========================================= */

const storage = multer.memoryStorage();

const upload = multer({
  storage
});

/* =========================================
   DATABASE
========================================= */

mongoose.connect(process.env.MONGO_URL)
.then(() => {
  console.log("✅ MongoDB Connected");
})
.catch(err => {
  console.log("❌ MongoDB Error:", err);
});

/* =========================================
   MODELS
========================================= */

const User = mongoose.model("User", {

  username: String,

  email: String,

  password: String,

  avatar: {
    type: String,
    default:
      "https://cdn-icons-png.flaticon.com/512/149/149071.png"
  },

  online: {
    type: Boolean,
    default: false
  }

});

const Item = mongoose.model("Item", {

  name: String,

  description: String,

  category: String,

  price: String,

  wanted: String,

  image: String,

  sellerName: String,

  sellerPhone: String,

  createdAt: {
    type: Date,
    default: Date.now
  }

});

const Message = mongoose.model("Message", {

  senderId: String,

  receiverId: String,

  text: String,

  image: String,

  createdAt: {
    type: Date,
    default: Date.now
  }

});

/* =========================================
   JWT AUTH
========================================= */

function auth(req, res, next) {

  try {

    const token = req.headers.authorization;

    if (!token) {

      return res.status(401).json({
        message: "No token"
      });

    }

    const verified = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = verified;

    next();

  } catch(err) {

    res.status(401).json({
      message: "Invalid token"
    });

  }

}

/* =========================================
   REGISTER
========================================= */

app.post("/register", async (req, res) => {

  try {

    const { username, email, password } = req.body;

    const existing = await User.findOne({ email });

    if (existing) {

      return res.status(400).json({
        message: "User already exists"
      });

    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({

      username,

      email,

      password: hashed

    });

    res.json({
      success: true,
      user
    });

  } catch(err) {

    res.status(500).json({
      message: "Registration failed"
    });

  }

});

/* =========================================
   LOGIN
========================================= */

app.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {

      return res.status(401).json({
        message: "Invalid credentials"
      });

    }

    const valid = await bcrypt.compare(
      password,
      user.password
    );

    if (!valid) {

      return res.status(401).json({
        message: "Invalid credentials"
      });

    }

    const token = jwt.sign({

      id: user._id,
      email: user.email

    },
    process.env.JWT_SECRET,
    {
      expiresIn: "30d"
    });

    res.json({

      token,

      user: {

        id: user._id,

        username: user.username,

        email: user.email,

        avatar: user.avatar

      }

    });

  } catch(err) {

    res.status(500).json({
      message: "Login failed"
    });

  }

});

/* =========================================
   CREATE ITEM WITH CLOUDINARY
========================================= */

app.post(
  "/upload",
  upload.single("image"),
  async (req, res) => {

  try {

    let imageUrl = "";

    if (req.file) {

      const base64 =
        `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      const uploaded =
        await cloudinary.uploader.upload(base64, {
          folder: "swaply"
        });

      imageUrl = uploaded.secure_url;

    }

    const item = await Item.create({

      name: req.body.name,

      description: req.body.description,

      category: req.body.category,

      price: req.body.price,

      wanted: req.body.wanted,

      sellerName: req.body.sellerName,

      sellerPhone: req.body.sellerPhone,

      image: imageUrl

    });

    res.json(item);

  } catch(err) {

    console.log(err);

    res.status(500).json({
      message: "Upload failed"
    });

  }

});

/* =========================================
   GET ITEMS
========================================= */

app.get("/items", async (req, res) => {

  try {

    const items = await Item.find()
    .sort({ createdAt: -1 });

    res.json(items);

  } catch(err) {

    res.status(500).json({
      message: "Failed to fetch items"
    });

  }

});

/* =========================================
   DELETE ITEM
========================================= */

app.delete("/items/:id", async (req, res) => {

  try {

    await Item.findByIdAndDelete(req.params.id);

    res.json({
      success: true
    });

  } catch(err) {

    res.status(500).json({
      message: "Delete failed"
    });

  }

});

/* =========================================
   CHAT MESSAGES
========================================= */

app.get("/messages", async (req, res) => {

  try {

    const messages = await Message.find()
    .sort({ createdAt: 1 });

    res.json(messages);

  } catch(err) {

    res.status(500).json({
      message: "Failed"
    });

  }

});

/* =========================================
   SOCKET.IO LIVE CHAT
========================================= */

io.on("connection", socket => {

  console.log("🟢 User Connected");

  socket.on("send_message", async data => {

    const message = await Message.create({

      senderId: data.senderId,

      receiverId: data.receiverId,

      text: data.text,

      image: data.image || ""

    });

    io.emit("receive_message", message);

  });

  socket.on("disconnect", () => {

    console.log("🔴 User Disconnected");

  });

});

/* =========================================
   ROOT
========================================= */

app.get("/", (req, res) => {

  res.send("🚀 Swaply Backend Running");

});

/* =========================================
   SERVER
========================================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {

  console.log(`🚀 Server running on port ${PORT}`);

});
