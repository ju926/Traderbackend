require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
cors: {
origin: "*",
methods: ["GET", "POST"]
}
});

/* ======================
CONFIG
====================== */

const PORT =
process.env.PORT || 5000;

const JWT_SECRET =
process.env.JWT_SECRET || "swaplysecret";

/* ======================
MIDDLEWARE
====================== */

app.use(cors());

app.use(express.json({
limit:"50mb"
}));

app.use(express.urlencoded({
extended:true,
limit:"50mb"
}));

app.use("/uploads",
express.static(
path.join(__dirname, "uploads")
));

/* ======================
UPLOADS FOLDER
====================== */

if(!fs.existsSync("uploads")){

fs.mkdirSync("uploads");

}

/* ======================
MONGODB
====================== */

mongoose.connect(
process.env.MONGO_URI
)
.then(() => {

console.log("✅ MongoDB Connected");

})
.catch(err => {

console.log(err);

});

/* ======================
SCHEMAS
====================== */

const userSchema =
new mongoose.Schema({

username:{
type:String,
required:true,
unique:true
},

email:{
type:String,
required:true,
unique:true
},

password:{
type:String,
required:true
},

avatar:{
type:String,
default:""
},

role:{
type:String,
default:"user"
},

createdAt:{
type:Date,
default:Date.now
}

});

const itemSchema =
new mongoose.Schema({

name:String,

description:String,

category:String,

price:String,

wanted:String,

location:String,

sellerPhone:String,

sellerName:String,

image:String,

createdAt:{
type:Date,
default:Date.now
}

});

const messageSchema =
new mongoose.Schema({

username:String,

message:String,

admin:{
type:Boolean,
default:false
},

ai:{
type:Boolean,
default:false
},

replyTo:String,

time:String,

createdAt:{
type:Date,
default:Date.now
}

});

const User =
mongoose.model(
"User",
userSchema
);

const Item =
mongoose.model(
"Item",
itemSchema
);

const Message =
mongoose.model(
"Message",
messageSchema
);

/* ======================
MULTER
====================== */

const storage =
multer.diskStorage({

destination:function(req,file,cb){

cb(null,"uploads/");

},

filename:function(req,file,cb){

cb(
null,
Date.now() +
path.extname(file.originalname)
);

}

});

const upload =
multer({
storage
});

/* ======================
AUTH MIDDLEWARE
====================== */

function auth(req,res,next){

const token =
req.headers.authorization;

if(!token){

return res.status(401).json({
message:"No token"
});

}

try{

const decoded =
jwt.verify(
token,
JWT_SECRET
);

req.user = decoded;

next();

}catch(err){

res.status(401).json({
message:"Invalid token"
});

}

}

/* ======================
REGISTER
====================== */

app.post(
"/register",
async(req,res) => {

try{

const {
username,
email,
password
} = req.body;

const existingUser =
await User.findOne({
$or:[
{email},
{username}
]
});

if(existingUser){

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
new User({

username,
email,
password:hashed

});

await user.save();

const token =
jwt.sign({

id:user._id,
username:user.username,
role:user.role

},
JWT_SECRET
);

res.json({

token,

user:{
id:user._id,
username:user.username,
email:user.email,
role:user.role,
avatar:user.avatar
}

});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* ======================
LOGIN
====================== */

app.post(
"/login",
async(req,res) => {

try{

const {
email,
password
} = req.body;

const user =
await User.findOne({
email
});

if(!user){

return res.status(400).json({
message:"Invalid credentials"
});

}

const valid =
await bcrypt.compare(
password,
user.password
);

if(!valid){

return res.status(400).json({
message:"Invalid credentials"
});

}

const token =
jwt.sign({

id:user._id,
username:user.username,
role:user.role

},
JWT_SECRET
);

res.json({

token,

user:{
id:user._id,
username:user.username,
email:user.email,
role:user.role,
avatar:user.avatar
}

});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* ======================
UPLOAD ITEM
====================== */

app.post(
"/upload",
upload.single("image"),
async(req,res) => {

try{

const item =
new Item({

name:req.body.name,

description:req.body.description,

category:req.body.category,

price:req.body.price,

wanted:req.body.wanted,

location:req.body.location,

sellerPhone:req.body.sellerPhone,

sellerName:req.body.sellerName,

image:req.file
?
`${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
:
""

});

await item.save();

/* REALTIME */

io.emit(
"newItem",
item
);

res.json({
message:"Uploaded",
item
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Upload failed"
});

}

}
);

/* ======================
GET ITEMS
====================== */

app.get(
"/items",
async(req,res) => {

try{

const items =
await Item.find()
.sort({
createdAt:-1
});

res.json(items);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* ======================
GET USERS
====================== */

app.get(
"/users",
async(req,res) => {

try{

const users =
await User.find()
.select("-password");

res.json(users);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* ======================
DELETE USER
====================== */

app.delete(
"/users/:id",
async(req,res) => {

try{

await User.findByIdAndDelete(
req.params.id
);

res.json({
message:"User deleted"
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Delete failed"
});

}

}
);

/* ======================
DELETE ITEM
====================== */

app.delete(
"/items/:id",
async(req,res) => {

try{

await Item.findByIdAndDelete(
req.params.id
);

res.json({
message:"Item deleted"
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Delete failed"
});

}

}
);

/* ======================
MESSAGES
====================== */

app.get(
"/messages",
async(req,res) => {

try{

const messages =
await Message.find()
.sort({
createdAt:1
})
.limit(300);

res.json(messages);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* ======================
DELETE MESSAGE
====================== */

app.delete(
"/messages/:id",
async(req,res) => {

try{

await Message.findByIdAndDelete(
req.params.id
);

res.json({
message:"Message deleted"
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Delete failed"
});

}

}
);

/* ======================
ONLINE USERS
====================== */

let onlineUsers = [];

/* ======================
SOCKET
====================== */

io.on(
"connection",
socket => {

console.log("🟢 User Connected");

/* ONLINE */

socket.on(
"userOnline",
username => {

if(
!onlineUsers.includes(username)
){

onlineUsers.push(username);

}

io.emit(
"onlineUsers",
onlineUsers
);

}
);

/* SEND MESSAGE */

socket.on(
"sendMessage",
async(data) => {

try{

const message =
new Message({

username:data.username,

message:data.message,

admin:data.admin || false,

ai:data.ai || false,

replyTo:data.replyTo || "",

time:data.time

});

await message.save();

io.emit(
"receiveMessage",
message
);

}catch(err){

console.log(err);

}

}
);

/* ADMIN REPLY */

socket.on(
"adminReply",
async(data) => {

try{

const message =
new Message({

username:"ADMIN",

message:data.message,

admin:true,

time:new Date()
.toLocaleTimeString([],{
hour:"2-digit",
minute:"2-digit"
})

});

await message.save();

io.emit(
"receiveMessage",
message
);

}catch(err){

console.log(err);

}

}
);

/* DISCONNECT */

socket.on(
"disconnect",
() => {

console.log("🔴 User Disconnected");

}
);

}
);

/* ======================
HOME
====================== */

app.get("/", (req,res) => {

res.send("🚀 Swaply Backend Running");

});

/* ======================
START SERVER
====================== */

server.listen(PORT, () => {

console.log(
`🚀 Server running on port ${PORT}`
);

});
