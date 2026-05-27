require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());

/* =========================
   CLOUDINARY CONFIG
========================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* =========================
   MONGODB
========================= */

mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ MongoDB Error:", err));

/* =========================
   MODELS
========================= */

const User = mongoose.model("User", {
  username: String,
  email: String,
  password: String
});

const Item = mongoose.model("Item", {
  name: String,
  description: String,
  category: String,
  wanted: String,
  imageURL: String,
  userId: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model("Message", {
  from: String,
  to: String,
  text: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/* =========================
   MULTER
========================= */

const storage = multer.memoryStorage();

const upload = multer({
  storage
});

/* =========================
   AUTH
========================= */

function auth(req, res, next) {

  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({
      message: "No token"
    });
  }

  try {

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;

    next();

  } catch {
    return res.status(401).json({
      message: "Invalid token"
    });
  }
}

/* =========================
   REGISTER
========================= */

app.post("/register", async (req, res) => {

  try {

    const user = await User.create(req.body);

    res.json(user);

  } catch (err) {

    res.status(500).json({
      message: err.message
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/login", async (req, res) => {

  try {

    const user = await User.findOne({
      email: req.body.email,
      password: req.body.password
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET
    );

    res.json({
      token,
      user
    });

  } catch (err) {

    res.status(500).json({
      message: err.message
    });
  }
});

/* =========================
   GET ITEMS
========================= */

app.get("/items", async (req, res) => {

  const items = await Item.find().sort({ createdAt: -1 });

  res.json(items);
});

/* =========================
   UPLOAD ITEM + CLOUDINARY
========================= */

app.post(
  "/items",
  auth,
  upload.single("image"),
  async (req, res) => {

    try {

      let imageURL = "";

      if (req.file) {

        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "swaply"
          },
          async (error, result) => {

            if (error) {
              return res.status(500).json({
                message: error.message
              });
            }

            imageURL = result.secure_url;

            const item = await Item.create({
              name: req.body.name,
              description: req.body.description,
              category: req.body.category,
              wanted: req.body.wanted,
              imageURL,
              userId: req.user.id
            });

            res.json(item);
          }
        );

        streamifier.createReadStream(req.file.buffer)
          .pipe(uploadStream);

      } else {

        const item = await Item.create({
          name: req.body.name,
          description: req.body.description,
          category: req.body.category,
          wanted: req.body.wanted,
          imageURL: "",
          userId: req.user.id
        });

        res.json(item);
      }

    } catch (err) {

      res.status(500).json({
        message: err.message
      });
    }
  }
);

/* =========================
   CHAT
========================= */

let onlineUsers = [];

io.on("connection", (socket) => {

  socket.on("join", (userId) => {

    if (!onlineUsers.includes(userId)) {
      onlineUsers.push(userId);
    }

    io.emit("onlineUsers", onlineUsers);
  });

  socket.on("sendMessage", async (data) => {

    await Message.create(data);

    io.emit("newMessage", data);
  });

  socket.on("disconnect", () => {
    io.emit("onlineUsers", onlineUsers);
  });
});

/* =========================
   GET MESSAGES
========================= */

app.get("/messages/:userId", auth, async (req, res) => {

  const messages = await Message.find({
    $or: [
      {
        from: req.user.id,
        to: req.params.userId
      },
      {
        from: req.params.userId,
        to: req.user.id
      }
    ]
  });

  res.json(messages);
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
