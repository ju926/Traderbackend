const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// =======================
// MIDDLEWARE
// =======================

app.use(cors());
app.use(express.json());

// =======================
// DATABASE
// =======================

mongoose.connect(process.env.MONGO_URL)
.then(() => {
  console.log("✅ MongoDB Connected");
})
.catch((err) => {
  console.log("❌ MongoDB Error:", err);
});

// =======================
// CLOUDINARY
// =======================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "swaply-items",
    allowed_formats: ["jpg", "jpeg", "png", "webp"]
  }
});

const upload = multer({ storage });

// =======================
// MODELS
// =======================

const User = mongoose.model("User", {

  username: String,

  email: {
    type: String,
    unique: true
  },

  password: String,

  profileImage: {
    type: String,
    default: "https://cdn-icons-png.flaticon.com/512/149/149071.png"
  },

  online: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

const Item = mongoose.model("Item", {

  name: String,

  description: String,

  category: String,

  wanted: String,

  imageURL: String,

  sellerId: String,

  sellerName: String,

  likes: {
    type: Number,
    default: 0
  },

  views: {
    type: Number,
    default: 0
  },

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

// =======================
// JWT AUTH
// =======================

function auth(req, res, next){

  try{

    const token = req.headers.authorization;

    if(!token){

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

  }catch(err){

    res.status(401).json({
      message: "Invalid token"
    });

  }

}

// =======================
// HOME
// =======================

app.get("/", (req,res)=>{

  res.json({
    message: "🚀 Swaply Backend Running"
  });

});

// =======================
// REGISTER
// =======================

app.post("/register", async(req,res)=>{

  try{

    const { username, email, password } = req.body;

    const exists = await User.findOne({ email });

    if(exists){

      return res.status(400).json({
        message: "Email already exists"
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
      message: "Registration successful"
    });

  }catch(err){

    console.log(err);

    res.status(500).json({
      message: "Registration failed"
    });

  }

});

// =======================
// LOGIN
// =======================

app.post("/login", async(req,res)=>{

  try{

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if(!user){

      return res.status(401).json({
        message: "Invalid credentials"
      });

    }

    const valid = await bcrypt.compare(
      password,
      user.password
    );

    if(!valid){

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
      expiresIn: "7d"
    });

    user.online = true;

    await user.save();

    res.json({

      token,

      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profileImage: user.profileImage
      }

    });

  }catch(err){

    console.log(err);

    res.status(500).json({
      message: "Login failed"
    });

  }

});

// =======================
// UPLOAD ITEM
// =======================

app.post(
  "/upload",
  auth,
  upload.single("image"),
  async(req,res)=>{

  try{

    const item = await Item.create({

      name: req.body.name,

      description: req.body.description,

      category: req.body.category,

      wanted: req.body.wanted,

      imageURL: req.file.path,

      sellerId: req.user.id,

      sellerName: req.body.sellerName || "Swaply Seller"

    });

    res.json(item);

  }catch(err){

    console.log(err);

    res.status(500).json({
      message: "Upload failed"
    });

  }

});

// =======================
// GET ITEMS
// =======================

app.get("/items", async(req,res)=>{

  try{

    const items = await Item.find()
    .sort({ createdAt: -1 });

    res.json(items);

  }catch(err){

    console.log(err);

    res.status(500).json({
      message: "Failed to fetch items"
    });

  }

});

// =======================
// DELETE ITEM
// =======================

app.delete("/items/:id", auth, async(req,res)=>{

  try{

    await Item.findByIdAndDelete(req.params.id);

    res.json({
      success: true
    });

  }catch(err){

    console.log(err);

    res.status(500).json({
      message: "Delete failed"
    });

  }

});

// =======================
// SEND MESSAGE
// =======================

app.post("/messages", auth, async(req,res)=>{

  try{

    const message = await Message.create({

      senderId: req.user.id,

      receiverId: req.body.receiverId,

      text: req.body.text,

      image: req.body.image || ""

    });

    io.emit("new_message", message);

    res.json(message);

  }catch(err){

    console.log(err);

    res.status(500).json({
      message: "Message failed"
    });

  }

});

// =======================
// GET MESSAGES
// =======================

app.get("/messages/:user1/:user2", async(req,res)=>{

  try{

    const messages = await Message.find({

      $or: [

        {
          senderId: req.params.user1,
          receiverId: req.params.user2
        },

        {
          senderId: req.params.user2,
          receiverId: req.params.user1
        }

      ]

    }).sort({ createdAt: 1 });

    res.json(messages);

  }catch(err){

    console.log(err);

    res.status(500).json({
      message: "Failed to load messages"
    });

  }

});

// =======================
// SOCKET.IO
// =======================

io.on("connection", (socket)=>{

  console.log("🟢 User connected");

  socket.on("send_message", async(data)=>{

    io.emit("receive_message", data);

  });

  socket.on("disconnect", ()=>{

    console.log("🔴 User disconnected");

  });

});

// =======================
// START SERVER
// =======================

const PORT = process.env.PORT || 5000;

server.listen(PORT, ()=>{

  console.log(`🚀 Server running on port ${PORT}`);

});
