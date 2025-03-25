require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5002;
const MONGO_URI = process.env.MONGO_URI ;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Validate .env variables
if (!process.env.MONGO_URI) {
    console.error("❌ ERROR: MONGO_URI is not defined in .env");
    process.exit(1);
}
console.log("Mongo URI:", process.env.MONGO_URI);


if (!process.env.JWT_SECRET) {
    console.warn("⚠️ WARNING: JWT_SECRET is missing. Using default secret.");
}

// Middleware
app.use(express.json());
app.use(cors({
    origin: "*", // Allow all origins (Adjust if needed)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// ✅ MongoDB Connection
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => {
      console.error("❌ MongoDB Connection Error:", err);
      process.exit(1);
  });

// ✅ User Schema
const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    membership: Boolean,
    paymentDetails: {
        amount: Number,
        method: String,
        date: Date
    }
});
const User = mongoose.model("User", UserSchema);

// ✅ Root Route
app.get("/", (req, res) => {
    res.send("Gym Membership Backend API is Running 🚀");
});

// ✅ Register Endpoint
app.post("/api/register", async (req, res) => {
    const { name, email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ success: false, message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ name, email, password: hashedPassword, membership: false });
        await user.save();

        res.json({ success: true, message: "User registered successfully" });
    } catch (error) {
        console.error("❌ Register Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ✅ Login Endpoint
app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ success: false, message: "Invalid credentials" });

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "1h" });

        res.json({ success: true, userId: user._id, token });
    } catch (error) {
        console.error("❌ Login Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// ✅ Buy Membership Route
app.post("/buy-membership/:id", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) return res.status(404).json({ success: false, message: "User not found" });

      if (user.membership) {
          return res.status(400).json({ success: false, message: "Membership already active" });
      }

      const { plan, paymentMethod } = req.body;
      let price = 0;

      if (plan === "Monthly Plan") price = 500;
      else if (plan === "Quarterly Plan") price = 1200;
      else if (plan === "Yearly Plan") price = 4000;
      else return res.status(400).json({ success: false, message: "Invalid plan" });

      user.membership = true;
      user.paymentDetails = {
          amount: price,
          method: paymentMethod,
          date: new Date(),
      };
      await user.save();

      res.json({ success: true, message: "Membership activated", paymentDetails: user.paymentDetails });
  } catch (error) {
      console.error("❌ Buy Membership Error:", error);
      res.status(401).json({ success: false, message: "Invalid token" });
  }
});

// ✅ Get User Details
app.get("/user/:id", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        res.json(user);
    } catch (error) {
        console.error("❌ Get User Error:", error);
        res.status(401).json({ success: false, message: "Invalid token" });
    }
});

// ✅ Start Server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
