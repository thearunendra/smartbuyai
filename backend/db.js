const dns = require("dns");
const mongoose = require("mongoose");

const { Schema } = mongoose;

// Conversations keep at most this many messages (oldest are dropped).
const MAX_MESSAGES = 200;


// =====================================================
// MODELS
// =====================================================

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254
    },
    passwordHash: { type: String, required: true },
    // Admins can open the dashboard. Granted with: npm run make-admin -- <email>
    role: { type: String, enum: ["user", "admin"], default: "user" }
  },
  { timestamps: true }
);

const messageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "ai"], required: true },
    text: { type: String, default: "" },
    error: { type: Boolean, default: false },
    // Product cards (with store offers) exactly as the search API returned them.
    products: { type: [Schema.Types.Mixed], default: undefined }
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const conversationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    messages: { type: [messageSchema], default: [] }
  },
  { timestamps: true }
);

conversationSchema.index({ user: 1, updatedAt: -1 });

const searchLogSchema = new Schema(
  {
    query: { type: String, required: true },
    category: { type: String, default: "Other" },
    results: { type: Number, default: 0 },
    products: { type: [String], default: [] },
    user: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

searchLogSchema.index({ createdAt: -1 });

// One saved product per user and product name.
const wishlistItemSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, maxlength: 300 },
    // The product card (price, store, image, offers) when it was saved.
    product: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

wishlistItemSchema.index({ user: 1, name: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);
const Conversation = mongoose.model("Conversation", conversationSchema);
const SearchLog = mongoose.model("SearchLog", searchLogSchema);
const WishlistItem = mongoose.model("WishlistItem", wishlistItemSchema);


// =====================================================
// CONNECTION
// =====================================================

// Used when the system DNS refuses the SRV lookup that mongodb+srv:// needs
// (some local resolvers, VPNs and routers do).
const PUBLIC_DNS = ["8.8.8.8", "1.1.1.1"];

function connectOnce() {
  return mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || "smartbuy",
    serverSelectionTimeoutMS: 10000
  });
}

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.log("Database: MONGODB_URI not set (accounts and chat history disabled)");
    return false;
  }

  try {
    try {
      await connectOnce();
    } catch (error) {
      if (!String(error.message).includes("querySrv")) {
        throw error;
      }

      console.log("Database: system DNS refused the SRV lookup, retrying with public DNS");
      dns.setServers(PUBLIC_DNS);
      await connectOnce();
    }

    console.log("Database: MongoDB connected");
    return true;
  } catch (error) {
    console.log("Database: unable to connect -", error.message);
    return false;
  }
}

function isDBReady() {
  return mongoose.connection.readyState === 1;
}

module.exports = {
  MAX_MESSAGES,
  User,
  Conversation,
  SearchLog,
  WishlistItem,
  connectDB,
  isDBReady
};
