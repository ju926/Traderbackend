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
const Groq = require("groq-sdk");

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

/* =========================================
   GROQ AI
========================================= */

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/* =========================================
   MIDDLEWARE
========================================= */

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
  },

  isAdmin: {
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

  senderName: String,

  receiverId: String,

  text: String,

  image: String,

  replyTo: {
    type: String,
    default: ""
  },

  replyText: {
    type: String,
    default: ""
  },

  isAdminReply: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

/* =========================================
   AUTH
========================================= */

function auth(req, res, next){

  try {

    const token =
    req.headers.authorization;

    if(!token){

      return res.status(401).json({
        message:"No token"
      });

    }

    const verified =
    jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = verified;

    next();

  } catch(err){

    res.status(401).json({
      message:"Invalid token"
    });

  }

}

/* =========================================
   REGISTER
========================================= */

app.post("/register", async(req,res)=>{

  try {

    const {
      username,
      email,
      password
    } = req.body;

    const existing =
    await User.findOne({
      email
    });

    if(existing){

      return res.status(400).json({
        message:"User already exists"
      });

    }

    const hashed =
    await bcrypt.hash(
      password,
      10
    );

    const user =
    await User.create({

      username,

      email,

      password: hashed

    });

    res.json({

      success:true,

      user

    });

  } catch(err){

    res.status(500).json({
      message:"Registration failed"
    });

  }

});

/* =========================================
   LOGIN
========================================= */

app.post("/login", async(req,res)=>{

  try {

    const {
      email,
      password
    } = req.body;

    const user =
    await User.findOne({
      email
    });

    if(!user){

      return res.status(401).json({
        message:"Invalid credentials"
      });

    }

    const valid =
    await bcrypt.compare(
      password,
      user.password
    );

    if(!valid){

      return res.status(401).json({
        message:"Invalid credentials"
      });

    }

    user.online = true;

    await user.save();

    const token =
    jwt.sign({

      id:user._id,

      email:user.email,

      username:user.username,

      isAdmin:user.isAdmin

    },
    process.env.JWT_SECRET,
    {
      expiresIn:"30d"
    });

    res.json({

      token,

      user:{

        id:user._id,

        username:user.username,

        email:user.email,

        avatar:user.avatar,

        online:user.online,

        isAdmin:user.isAdmin

      }

    });

  } catch(err){

    res.status(500).json({
      message:"Login failed"
    });

  }

});

/* =========================================
   LOGOUT
========================================= */

app.post("/logout", auth, async(req,res)=>{

  try {

    await User.findByIdAndUpdate(
      req.user.id,
      {
        online:false
      }
    );

    res.json({
      success:true
    });

  } catch(err){

    res.status(500).json({
      message:"Logout failed"
    });

  }

});

/* =========================================
   USERS
========================================= */

app.get("/users", async(req,res)=>{

  try {

    const users =
    await User.find()
    .select("-password")
    .sort({ online:-1 });

    res.json(users);

  } catch(err){

    res.status(500).json({
      message:"Failed to fetch users"
    });

  }

});

/* =========================================
   CREATE ITEM
========================================= */

app.post(
"/upload",
upload.single("image"),
async(req,res)=>{

  try {

    let imageUrl = "";

    if(req.file){

      const base64 =
      `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

      const uploaded =
      await cloudinary.uploader.upload(base64,{
        folder:"swaply"
      });

      imageUrl =
      uploaded.secure_url;

    }

    const item =
    await Item.create({

      name:req.body.name,

      description:req.body.description,

      category:req.body.category,

      price:req.body.price,

      wanted:req.body.wanted,

      sellerName:req.body.sellerName,

      sellerPhone:req.body.sellerPhone,

      image:imageUrl

    });

    res.json(item);

  } catch(err){

    console.log(err);

    res.status(500).json({
      message:"Upload failed"
    });

  }

});

/* =========================================
   GET ITEMS
========================================= */

app.get("/items", async(req,res)=>{

  try {

    const items =
    await Item.find()
    .sort({ createdAt:-1 });

    res.json(items);

  } catch(err){

    res.status(500).json({
      message:"Failed to fetch items"
    });

  }

});

/* =========================================
   DELETE ITEM
========================================= */

app.delete("/items/:id", async(req,res)=>{

  try {

    await Item.findByIdAndDelete(
      req.params.id
    );

    res.json({
      success:true
    });

  } catch(err){

    res.status(500).json({
      message:"Delete failed"
    });

  }

});

/* =========================================
   GET MESSAGES
========================================= */

app.get("/messages", async(req,res)=>{

  try {

    const messages =
    await Message.find()
    .sort({ createdAt:1 });

    res.json(messages);

  } catch(err){

    res.status(500).json({
      message:"Failed"
    });

  }

});

/* =========================================
   SOCKET.IO
========================================= */

io.on("connection", socket => {

  console.log("🟢 User Connected");

  /* =========================================
     SEND MESSAGE
  ========================================= */

  socket.on("send_message", async data => {

    try {

      /* SAVE USER MESSAGE */

      const message =
      await Message.create({

        senderId:data.senderId,

        senderName:data.senderName,

        receiverId:data.receiverId,

        text:data.text,

        image:data.image || "",

        replyTo:data.replyTo || "",

        replyText:data.replyText || ""

      });

      /* SEND TO EVERYONE */

      io.emit(
        "receive_message",
        message
      );

      /* =========================================
         AI RESPONSE
      ========================================= */

      if(
        data.text
        .toLowerCase()
        .includes("@ai")
      ){

        try {

          const cleanedText =
          data.text
          .replace(/@ai/gi,"")
          .trim();

          const completion =
          await groq.chat.completions.create({

            messages:[

              {
                role:"system",

                content:`
You are Swaply AI.

You help users:
- negotiate prices
- buy products
- sell products
- answer marketplace questions

Rules:
- keep replies short
- friendly
- smart
- modern
`
              },

              {
                role:"user",
                content: cleanedText
              }

            ],

            model:"llama-3.1-8b-instant",

            temperature:0.7,

            max_tokens:150

          });

          const aiReply =
          completion.choices[0]
          .message.content;

          /* SAVE AI MESSAGE */

          const aiMessage =
          await Message.create({

            senderId:"AI",

            senderName:"AI Assistant",

            receiverId:data.senderId,

            text:aiReply,

            replyTo:data.senderName,

            replyText:data.text

          });

          /* SEND AI MESSAGE */

          setTimeout(() => {

            io.emit(
              "receive_message",
              aiMessage
            );

          },1000);

        } catch(err){

          console.log(
            "GROQ ERROR:",
            err.message
          );

        }

      }

      /* =========================================
         ADMIN RESPONSE
      ========================================= */

      if(
        data.text
        .toLowerCase()
        .includes("@admin")
      ){

        const adminMessage =
        await Message.create({

          senderId:"ADMIN",

          senderName:"Admin",

          receiverId:data.senderId,

          text:
          "👑 Admin has seen your message and may respond shortly.",

          replyTo:data.senderName,

          replyText:data.text

        });

        setTimeout(() => {

          io.emit(
            "receive_message",
            adminMessage
          );

        },1000);

      }

    } catch(err){

      console.log(
        "MESSAGE ERROR:",
        err.message
      );

    }

  });

  /* =========================================
     USER ONLINE
  ========================================= */

  socket.on("user_online", async userId => {

    try {

      await User.findByIdAndUpdate(
        userId,
        {
          online:true
        }
      );

      io.emit(
        "refresh_users"
      );

    } catch(err){

      console.log(err);

    }

  });

  /* =========================================
     LOGOUT
  ========================================= */

  socket.on("logout", async userId => {

    try {

      await User.findByIdAndUpdate(
        userId,
        {
          online:false
        }
      );

      io.emit(
        "refresh_users"
      );

    } catch(err){

      console.log(err);

    }

  });

  /* =========================================
     DISCONNECT
  ========================================= */

  socket.on("disconnect", () => {

    console.log("🔴 User Disconnected");

  });

});

/* =========================================
   ROOT
========================================= */

app.get("/", (req,res)=>{

  res.send(
    "🚀 Swaply Backend Running"
  );

});

/* =========================================
   SERVER
========================================= */

const PORT =
process.env.PORT || 5000;

server.listen(PORT, () => {

  console.log(
    `🚀 Server running on port ${PORT}`
  );

});
