require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5004;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection with Enhanced Error Handling
const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Prevents long connection delays
        });
        console.log("✅ MongoDB Connected...");
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
        process.exit(1); // Stop server if DB connection fails
    }
};
connectDB();

// User Schema
const UserSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    membership: { type: Boolean, default: false },
    attendance: { type: Number, default: 0 },
    paymentDetails: {
        plan: String,
        amount: Number,
        method: String,
        date: Date,
    },
    purchasedProteins: [
        {
            productName: String,
            price: Number,
            quantity: Number,
            purchaseDate: Date,
        }
    ]
});

const User = mongoose.model("User", UserSchema);

// Register User
app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({ name, email, password: hashedPassword });

        await user.save();
        res.json({ success: true, message: "User registered successfully" });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Login User
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1h" });

        res.json({ success: true, token, userId: user._id });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Get User Details
app.get("/api/user/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);
    } catch (error) {
        console.error("Get User Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Buy Membership
app.post("/api/buy-membership/:id", async (req, res) => {
    try {
        const { plan, paymentMethod } = req.body;
        const plans = {
            "Monthly Plan": 500,
            "Quarterly Plan": 1200,
            "Yearly Plan": 4000,
        };

        if (!plans[plan]) return res.status(400).json({ message: "Invalid plan selected" });

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.membership = true;
        user.paymentDetails = {
            plan,
            amount: plans[plan],
            method: paymentMethod,
            date: new Date(),
        };

        await user.save();
        res.json({ success: true, message: "Membership purchased successfully", paymentDetails: user.paymentDetails });
    } catch (error) {
        console.error("Buy Membership Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// 🏋️‍♂️ **Buy Protein API**
app.post("/api/buy-protein/:id", async (req, res) => {
    try {
        const { productName, price, quantity } = req.body;

        if (!productName || !price || !quantity) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const newPurchase = {
            productName,
            price,
            quantity,
            purchaseDate: new Date(),
        };

        user.purchasedProteins.push(newPurchase);
        await user.save();

        res.json({ success: true, message: "Protein purchased successfully", purchase: newPurchase });
    } catch (error) {
        console.error("Buy Protein Error:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Start Server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
