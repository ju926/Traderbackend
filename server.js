const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

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

/* DATABASE */

mongoose.connect(process.env.MONGO_URL)

.then(() => {

  console.log("✅ MongoDB Connected");

})

.catch((err) => {

  console.log("❌ MongoDB Error:", err);

});

/* ITEM MODEL */

const Item = mongoose.model("Item", {

  title: String,

  description: String,

  category: String,

  price: Number,

  image: String,

  location: String,

  createdAt: {
    type: Date,
    default: Date.now
  }

});

/* MESSAGE MODEL */

const Message = mongoose.model("Message", {

  itemId: String,

  sender: String,

  text: String,

  createdAt: {
    type: Date,
    default: Date.now
  }

});

/* ROUTES */

/* HOME */

app.get("/", (req, res) => {

  res.send("🚀 Swaply Marketplace Backend Running");

});

/* GET ITEMS */

app.get("/items", async (req, res) => {

  try {

    const items = await Item.find()
    .sort({ createdAt: -1 });

    res.json(items);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* ADD ITEM */

app.post("/items", async (req, res) => {

  try {

    const item = await Item.create(req.body);

    res.json(item);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* DELETE ITEM */

app.delete("/items/:id", async (req, res) => {

  try {

    await Item.findByIdAndDelete(req.params.id);

    res.json({
      success: true
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* GET CHAT */

app.get("/messages/:itemId", async (req, res) => {

  try {

    const messages = await Message.find({
      itemId: req.params.itemId
    });

    res.json(messages);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

/* SOCKET.IO */

io.on("connection", (socket) => {

  console.log("🟢 User Connected");

  socket.on("joinRoom", (itemId) => {

    socket.join(itemId);

  });

  socket.on("sendMessage", async (data) => {

    const message = await Message.create(data);

    io.to(data.itemId).emit("newMessage", message);

  });

  socket.on("disconnect", () => {

    console.log("🔴 User Disconnected");

  });

});

/* START */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {

  console.log(`🚀 Server running on port ${PORT}`);

});
