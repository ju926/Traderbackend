require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
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

mongoose.connect(process.env.MONGO_URL)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

const User = mongoose.model("User", {
  name: String,
  email: String,
  password: String,
  avatar: String
});

const Item = mongoose.model("Item", {
  title: String,
  description: String,
  category: String,
  wanted: String,
  image: String,
  ownerId: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Message = mongoose.model("Message", {
  chatId: String,
  senderId: String,
  receiverId: String,
  message: String,
  image: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

function auth(req, res, next) {

  try {

    const token = req.headers.authorization;

    if (!token) {
      return res.status(401).send("No token");
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();

  } catch {
    res.status(401).send("Invalid token");
  }
}

app.post("/register", async (req, res) => {

  const hashed = await bcrypt.hash(
    req.body.password,
    10
  );

  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: hashed
  });

  res.json(user);
});

app.post("/login", async (req, res) => {

  const user = await User.findOne({
    email: req.body.email
  });

  if (!user) {
    return res.status(401).json({
      message: "Invalid email"
    });
  }

  const valid = await bcrypt.compare(
    req.body.password,
    user.password
  );

  if (!valid) {
    return res.status(401).json({
      message: "Wrong password"
    });
  }

  const token = jwt.sign(
    {
      id: user._id
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d"
    }
  );

  res.json({
    token,
    userId: user._id,
    name: user.name
  });
});

app.post("/items", auth, async (req, res) => {

  const item = await Item.create({
    ...req.body,
    ownerId: req.user.id
  });

  res.json(item);
});

app.get("/items", async (req, res) => {

  const items = await Item.find().sort({
    createdAt: -1
  });

  res.json(items);
});

app.delete("/items/:id", auth, async (req, res) => {

  await Item.findByIdAndDelete(req.params.id);

  res.json({
    success: true
  });
});

app.get("/messages/:chatId", auth, async (req, res) => {

  const messages = await Message.find({
    chatId: req.params.chatId
  });

  res.json(messages);
});

let onlineUsers = {};

io.on("connection", (socket) => {

  socket.on("joinChat", (chatId) => {
    socket.join(chatId);
  });

  socket.on("userOnline", (userId) => {

    onlineUsers[userId] = socket.id;

    io.emit(
      "onlineUsers",
      Object.keys(onlineUsers)
    );
  });

  socket.on("sendMessage", async (data) => {

    const message = await Message.create(data);

    io.to(data.chatId).emit(
      "receiveMessage",
      message
    );
  });

  socket.on("typing", (chatId) => {
    socket.to(chatId).emit("typing");
  });

  socket.on("disconnect", () => {

    for (let id in onlineUsers) {

      if (onlineUsers[id] === socket.id) {
        delete onlineUsers[id];
      }
    }

    io.emit(
      "onlineUsers",
      Object.keys(onlineUsers)
    );
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log("Server running");
});
