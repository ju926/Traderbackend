require("dotenv").config();

const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const helmet = require("helmet");
const compression = require("compression");

const app = express();

const server = http.createServer(app);

const io = new Server(server,{
cors:{
origin:"*",
methods:["GET","POST"]
}
});

/* =====================================
CONFIG
===================================== */

const PORT =
process.env.PORT || 5000;

const JWT_SECRET =
process.env.JWT_SECRET || "swaplysecret";

/* =====================================
MIDDLEWARE
===================================== */

app.use(cors());

app.use(express.json());

app.use(helmet());

app.use(compression());

/* =====================================
MONGODB
===================================== */

mongoose.connect(
process.env.MONGO_URI
)
.then(() => {

console.log("✅ MongoDB Connected");

})
.catch(err => {

console.log(err);

});

/* =====================================
USER SCHEMA
===================================== */

const userSchema =
new mongoose.Schema({

username:{
type:String,
required:true
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

location:{
type:String,
default:"Kenya"
},

followers:{
type:Number,
default:0
},

following:{
type:Number,
default:0
},

verified:{
type:Boolean,
default:false
},

role:{
type:String,
default:"user"
},

online:{
type:Boolean,
default:false
},

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

/* =====================================
PRODUCT SCHEMA
===================================== */

const productSchema =
new mongoose.Schema({

title:String,

price:String,

description:String,

category:String,

condition:String,

location:String,

images:[String],

sellerId:String,

sellerName:String,

sellerAvatar:String,

likes:{
type:Number,
default:0
},

views:{
type:Number,
default:0
},

featured:{
type:Boolean,
default:false
},

sold:{
type:Boolean,
default:false
},

createdAt:{
type:Date,
default:Date.now
}

});

const Product =
mongoose.model(
"Product",
productSchema
);

/* =====================================
CHAT SCHEMA
===================================== */

const messageSchema =
new mongoose.Schema({

username:String,

message:String,

avatar:String,

replyTo:Object,

room:{
type:String,
default:"public"
},

isAdmin:{
type:Boolean,
default:false
},

isAI:{
type:Boolean,
default:false
},

image:{
type:String,
default:""
},

seen:{
type:Boolean,
default:false
},

createdAt:{
type:Date,
default:Date.now
}

});

const Message =
mongoose.model(
"Message",
messageSchema
);

/* =====================================
NOTIFICATION SCHEMA
===================================== */

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

const Notification =
mongoose.model(
"Notification",
notificationSchema
);

/* =====================================
OFFER SCHEMA
===================================== */

const offerSchema =
new mongoose.Schema({

productId:String,

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

const Offer =
mongoose.model(
"Offer",
offerSchema
);

/* =====================================
AUTH MIDDLEWARE
===================================== */

function auth(req,res,next){

const token =
req.headers.authorization;

if(!token){

return res.status(401).json({
message:"Unauthorized"
});

}

try{

const verified =
jwt.verify(
token,
JWT_SECRET
);

req.user = verified;

next();

}catch(err){

return res.status(401).json({
message:"Invalid token"
});

}

}

/* =====================================
REGISTER
===================================== */

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
email
});

if(existing){

return res.status(400).json({
message:"Email already exists"
});

}

const hashed =
await bcrypt.hash(
password,
10
);

const isAdmin =
email === process.env.ADMIN_EMAIL
&&
password === process.env.ADMIN_PASSWORD;

const user =
await User.create({

username,

email,

password:hashed,

role:isAdmin
? "admin"
: "user",

verified:isAdmin

});

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

user

});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* =====================================
LOGIN
===================================== */

app.post(
"/login",
async(req,res) => {

try{

const {
email,
password
} = req.body;

/* ADMIN LOGIN */

if(
email === process.env.ADMIN_EMAIL
&&
password === process.env.ADMIN_PASSWORD
){

const token =
jwt.sign({

id:"adminid",
username:"Admin",
role:"admin"

},
JWT_SECRET
);

return res.json({

token,

user:{
id:"adminid",
username:"Admin",
role:"admin",
verified:true
}

});

}

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

user

});

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* =====================================
PROFILE
===================================== */

app.get(
"/profile/:id",
async(req,res) => {

const user =
await User.findById(
req.params.id
);

res.json(user);

}
);

/* =====================================
UPDATE PROFILE
===================================== */

app.put(
"/profile/:id",
async(req,res) => {

const updated =
await User.findByIdAndUpdate(
req.params.id,
req.body,
{ new:true }
);

res.json(updated);

}
);

/* =====================================
UPLOAD PRODUCT
===================================== */

app.post(
"/products",
async(req,res) => {

try{

const product =
await Product.create(
req.body
);

res.json(product);

}catch(err){

console.log(err);

res.status(500).json({
message:"Upload failed"
});

}

}
);

/* =====================================
GET PRODUCTS
===================================== */

app.get(
"/products",
async(req,res) => {

const products =
await Product.find()
.sort({
createdAt:-1
});

res.json(products);

}
);

/* =====================================
GET SINGLE PRODUCT
===================================== */

app.get(
"/products/:id",
async(req,res) => {

try{

const product =
await Product.findById(
req.params.id
);

if(!product){

return res.status(404).json({
message:"Product not found"
});

}

product.views += 1;

await product.save();

res.json(product);

}catch(err){

console.log(err);

res.status(500).json({
message:"Server error"
});

}

}
);

/* =====================================
DELETE PRODUCT
===================================== */

app.delete(
"/products/:id",
async(req,res) => {

await Product.findByIdAndDelete(
req.params.id
);

res.json({
message:"Product deleted"
});

}
);

/* =====================================
LIKE PRODUCT
===================================== */

app.post(
"/products/:id/like",
async(req,res) => {

const product =
await Product.findById(
req.params.id
);

product.likes += 1;

await product.save();

res.json({
likes:product.likes
});

}
);

/* =====================================
OFFERS
===================================== */

app.post(
"/offers",
async(req,res) => {

const offer =
await Offer.create(
req.body
);

res.json(offer);

}
);

/* =====================================
GET OFFERS
===================================== */

app.get(
"/offers/:sellerId",
async(req,res) => {

const offers =
await Offer.find({

sellerId:req.params.sellerId

});

res.json(offers);

}
);

/* =====================================
NOTIFICATIONS
===================================== */

app.get(
"/notifications/:userId",
async(req,res) => {

const notifications =
await Notification.find({

userId:req.params.userId

})
.sort({
createdAt:-1
});

res.json(notifications);

}
);

/* =====================================
MESSAGES
===================================== */

app.get(
"/messages",
async(req,res) => {

const messages =
await Message.find()
.sort({
createdAt:1
})
.limit(300);

res.json(messages);

}
);

/* =====================================
PRIVATE ROOM MESSAGES
===================================== */

app.get(
"/messages/:room",
async(req,res) => {

const messages =
await Message.find({

room:req.params.room

})
.sort({
createdAt:1
});

res.json(messages);

}
);

/* =====================================
SOCKET.IO
===================================== */

io.on(
"connection",
(socket) => {

console.log(
"🟢 User Connected"
);

/* ONLINE */

socket.on(
"userOnline",
async(user) => {

io.emit(
"userOnline",
user
);

}
);

/* JOIN ROOM */

socket.on(
"joinRoom",
(room) => {

socket.join(room);

}
);

/* TYPING */

socket.on(
"typing",
(data) => {

socket.broadcast.emit(
"typing",
data
);

}
);

/* SEND MESSAGE */

socket.on(
"sendMessage",
async(data) => {

const message =
await Message.create({

username:data.username,

message:data.message,

avatar:data.avatar || "",

replyTo:data.replyTo || null,

room:data.room || "public",

isAdmin:data.isAdmin || false,

image:data.image || ""

});

io.to(data.room || "public")
.emit(
"newMessage",
message
);

/* AI */

if(
data.message
.toLowerCase()
.includes("@ai")
){

setTimeout(() => {

io.to(data.room || "public")
.emit(
"newMessage",
{

username:"AI",

message:
"🤖 AI assistant is active. How can I help?",

isAI:true,

createdAt:new Date()

}
);

},1200);

}

/* ADMIN */

if(
data.message
.toLowerCase()
.includes("@admin")
){

io.emit(
"adminMention",
{

username:data.username,
message:data.message

}
);

}

});

/* PRIVATE MESSAGE */

socket.on(
"privateMessage",
async(data) => {

const message =
await Message.create({

username:data.username,

message:data.message,

room:data.room,

avatar:data.avatar || ""

});

io.to(data.room)
.emit(
"privateMessage",
message
);

});

/* MESSAGE SEEN */

socket.on(
"messageSeen",
(data) => {

io.to(data.room)
.emit(
"messageSeen",
data
);

});

/* DISCONNECT */

socket.on(
"disconnect",
() => {

console.log(
"🔴 User Disconnected"
);

}
);

}
);

/* =====================================
HOME
===================================== */

app.get(
"/",
(req,res) => {

res.send(
"🚀 Swaply Backend Running"
);

}
);

/* =====================================
START SERVER
===================================== */

server.listen(
PORT,
() => {

console.log(
`🚀 Server running on port ${PORT}`
);

}
);
