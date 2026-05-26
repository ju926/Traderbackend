const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(cors());
app.use(express.json());

// ================= CLOUDINARY CONFIG =================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// ================= MULTER (memory upload) =================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ================= MONGO =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// ================= ITEM MODEL =================
const Item = mongoose.model("Item", {
  name: String,
  description: String,
  category: String,
  wanted: String,
  image: String,
  sellerId: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ================= ROUTES =================

// GET ITEMS
app.get("/items", async (req, res) => {
  const items = await Item.find().sort({ createdAt: -1 });
  res.json(items);
});

// POST ITEM (WITH IMAGE UPLOAD)
app.post("/items", upload.single("image"), async (req, res) => {
  try {

    let imageUrl = "";

    if (req.file) {
      const result = await cloudinary.uploader.upload_stream(
        { folder: "swaply" },
        (error, result) => {
          if (result) {
            imageUrl = result.secure_url;
          }
        }
      );

      // workaround for buffer upload
      const streamifier = require("streamifier");
      await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "swaply" },
          (error, result) => {
            if (result) {
              imageUrl = result.secure_url;
              resolve();
            } else {
              reject(error);
            }
          }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    }

    const item = new Item({
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      wanted: req.body.wanted,
      image: imageUrl,
      sellerId: req.body.sellerId || "unknown"
    });

    await item.save();

    res.json(item);

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// DELETE ITEM (ADMIN USE)
app.delete("/items/:id", async (req, res) => {
  await Item.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

// ================= SOCKET CHAT =================
io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  socket.on("joinRoom", ({ roomId }) => {
    socket.join(roomId);
  });

  socket.on("sendMessage", ({ roomId, sender, text }) => {
    io.to(roomId).emit("receiveMessage", {
      sender,
      text,
      time: new Date()
    });
  });

});

// ================= START SERVER =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
