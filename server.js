const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= CLOUDINARY =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ================= MONGODB =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("DB error:", err));

// ================= MODELS =================

// USERS
const User = mongoose.model("User", {
  name: String,
  email: String,
  password: String
});

// ITEMS
const Item = mongoose.model("Item", {
  name: String,
  description: String,
  category: String,
  wanted: String,
  image: String,
  ownerId: String,
  sold: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// CHATS
const Chat = mongoose.model("Chat", {
  roomId: String,
  messages: [
    {
      sender: String,
      text: String,
      time: { type: Date, default: Date.now }
    }
  ]
});

// ================= MULTER =================
const upload = multer({ storage: multer.memoryStorage() });

// ================= CLOUDINARY UPLOAD =================
function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "swaply" },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// ================= AUTH =================
app.post("/register", async (req, res) => {
  const user = await User.create(req.body);
  res.json(user);
});

app.post("/login", async (req, res) => {
  const user = await User.findOne(req.body);
  if (!user) return res.status(400).json({ error: "Invalid login" });
  res.json(user);
});

// ================= ITEMS =================

// GET ITEMS
app.get("/items", async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.json(items);
});

// CREATE ITEM
app.post("/items", upload.single("image"), async (req, res) => {
  try {
    let imageUrl = "";

    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer);
    }

    const item = await Item.create({
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      wanted: req.body.wanted,
      ownerId: req.body.ownerId,
      image: imageUrl
    });

    res.json(item);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// UPDATE ITEM (ADMIN)
app.put("/items/:id", async (req, res) => {
  const updated = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
});

// DELETE ITEM (ADMIN)
app.delete("/items/:id", async (req, res) => {
  await Item.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

// ================= CHAT SOCKET =================
io.on("connection", (socket) => {

  socket.on("joinRoom", ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on("sendMessage", async ({ roomId, sender, text }) => {

    const msg = { sender, text };

    await Chat.findOneAndUpdate(
      { roomId },
      {
        $push: { messages: msg },
        $setOnInsert: { roomId }
      },
      { upsert: true }
    );

    io.to(roomId).emit("receiveMessage", msg);
  });

});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
