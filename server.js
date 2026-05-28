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
cors:{
origin:"*",
methods:["GET","POST"]
}
});

/* =========================
CONFIG
========================= */

const PORT =
process.env.PORT || 5000;

const JWT_SECRET =
process.env.JWT_SECRET || "swaplysecret";

/* =========================
MIDDLEWARE
========================= */

app.use(cors());

app.use(express.json({
limit:"50mb"
}));

app.use(express.urlencoded({
extended:true,
limit:"50mb"
}));

app.use(
"/uploads",
express.static(
path.join(__dirname,"uploads")
)
);

/* =========================
UPLOAD FOLDER
========================= */

if(!fs.existsSync("uploads")){

fs.mkdirSync("uploads");

}

/* =========================
MONGODB
========================= */

mongoose.connect(
process.env.MONGO_URI
)
.then(() => {

console.log("✅ MongoDB Connected");

})
.catch(err => {

console.log(err);

});

/* =========================
SCHEMAS
========================= */

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

bio:{
type:String,
default:""
},

followers:[String],

verified:{
type:Boolean,
default:false
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

sellerId:String,

image:String,

likes:[String],

views:{
type:Number,
default:0
},

featured:{
type:Boolean,
default:false
},

createdAt:{
type:Date,
default:Date.now
}

});

const messageSchema =
new mongoose.Schema({

username:String,

message:String,

senderId:String,

receiverId:String,

roomId:String,

admin:{
type:Boolean,
default:false
},

ai:{
type:Boolean,
default:false
},

replyTo:{
type:Object,
default:null
},

image:{
type:String,
default:""
},

time:String,

createdAt:{
type:Date,
default:Date.now
}

});

const notificationSchema =
new mongoose.Schema({

userId:String,

text:String,

read:{
type:Boolean,
default:false
},

createdAt:{
type:Date,
default:Date.now
}

});

const offerSchema =
new mongoose.Schema({

itemId:String,

buyerId:String,

sellerId:String,

amount:String,

status:{
type:String,
default:"pending"
},

createdAt:{
type:Date,
default:Date.now
}

});

const storySchema =
new mongoose.Schema({

userId:String,

image:String,

text:String,

createdAt:{
type:Date,
default:Date.now,
expires:86400
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

const Notification =
mongoose.model(
"Notification",
notificationSchema
);

const Offer =
mongoose.model(
"Offer",
offerSchema
);

const Story =
mongoose.model(
"Story",
storySchema
);

/* =========================
MULTER
========================= */

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

/* =========================
AUTH
========================= */

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

/* =========================
REGISTER
========================= */

app.post(
"/register",
async(req,res) => {

try{

const {
username,
email,
password
} = req.body;

const existing =
await User.findOne({
$or:[
{email},
{username}
]
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

/* =========================
LOGIN
========================= */

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

const isAdmin =

email === "admin@swaply.com"

&&

password === "JULIAN254";

const token =
jwt.sign({

id:user._id,

username:user.username,

role:isAdmin ? "admin" : user.role

},
JWT_SECRET
);

res.json({

token,

user:{
id:user._id,
username:user.username,
email:user.email,
role:isAdmin ? "admin" : user.role,
avatar:user.avatar,
verified:user.verified
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

/* =========================
UPLOAD ITEM
========================= */

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

sellerId:req.body.sellerId,

image:req.file
?
`${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
:
""

});

await item.save();

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

/* =========================
GET ITEMS
========================= */

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

/* =========================
SINGLE ITEM
========================= */

app.get(
"/items/:id",
async(req,res) => {

try{

const item =
await Item.findById(
req.params.id
);

if(item){

item.views += 1;

await item.save();
}

res.json(item);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* =========================
LIKE ITEM
========================= */

app.post(
"/items/:id/like",
async(req,res) => {

try{

const item =
await Item.findById(
req.params.id
);

if(
!item.likes.includes(
req.body.userId
)
){

item.likes.push(
req.body.userId
);

}

await item.save();

res.json(item);

}catch(err){

console.log(err);

res.status(500).json({
message:"Like failed"
});

}

}
);

/* =========================
OFFERS
========================= */

app.post(
"/offers",
async(req,res) => {

try{

const offer =
new Offer(req.body);

await offer.save();

res.json(offer);

}catch(err){

console.log(err);

res.status(500).json({
message:"Offer failed"
});

}

}
);

/* =========================
GET USERS
========================= */

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

/* =========================
GET MESSAGES
========================= */

app.get(
"/messages",
async(req,res) => {

try{

const messages =
await Message.find()
.sort({
createdAt:1
})
.limit(500);

res.json(messages);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* =========================
DELETE USER
========================= */

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

/* =========================
DELETE ITEM
========================= */

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

/* =========================
DELETE MESSAGE
========================= */

app.delete(
"/messages/:id",
async(req,res) => {

try{

await Message.findByIdAndDelete(
req.params.id
);

res.json({
message:"Deleted"
});

}catch(err){

console.log(err);

res.status(500).json({
message:"Delete failed"
});

}

}
);

/* =========================
ONLINE USERS
========================= */

let onlineUsers = [];

/* =========================
SOCKET IO
========================= */

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

/* JOIN ROOM */

socket.on(
"joinRoom",
roomId => {

socket.join(roomId);

}
);

/* SEND MESSAGE */

socket.on(
"sendMessage",
async(data) => {

try{

const msg =
new Message({

username:data.username,

message:data.message,

senderId:data.senderId,

receiverId:data.receiverId,

roomId:data.roomId,

replyTo:data.replyTo,

admin:data.admin || false,

ai:data.ai || false,

image:data.image || "",

time:data.time

});

await msg.save();

/* COMMUNITY */

if(!data.roomId){

io.emit(
"receiveMessage",
msg
);

}

/* PRIVATE ROOM */

else{

io.to(data.roomId).emit(
"receivePrivateMessage",
msg
);

}

/* NOTIFICATION */

if(data.receiverId){

const notification =
new Notification({

userId:data.receiverId,

text:`${data.username} sent you a message`

});

await notification.save();

}

}catch(err){

console.log(err);

}

}
);

/* TYPING */

socket.on(
"typing",
username => {

socket.broadcast.emit(
"userTyping",
username
);

}
);

/* ADMIN REPLY */

socket.on(
"adminReply",
async(data) => {

try{

const msg =
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

await msg.save();

io.emit(
"receiveMessage",
msg
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

/* =========================
HOME
========================= */

app.get("/", (req,res) => {

res.send(
"🚀 Swaply Backend Running"
);

});

/* =========================
START
========================= */

server.listen(PORT, () => {

console.log(
`🚀 Server running on port ${PORT}`
);

});
