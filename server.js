// File: server.js

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const path = require('path'); // Required to serve static files

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/shop');


// Define the ShopItem Schema
const shopItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: { type: String },
    imageUrl: { type: String }
});

const ShopItem = mongoose.model('ShopItem', shopItemSchema);

// Set up Multer for file uploads (optional)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Secret key for JWT
const JWT_SECRET = 'your_secret_key';

// Middleware to check for JWT token
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.sendStatus(403);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Define a simple route for '/'
app.get('/', (req, res) => {
    res.send('Welcome to the Shop API!');
});

// POST endpoint to upload a shop item (Protected)
app.post('/shop-items', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { name, price, description } = req.body;

        if (!name || !price) {
            return res.status(400).json({ message: 'Name and price are required.' });
        }

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const shopItem = new ShopItem({
            name,
            price,
            description,
            imageUrl
        });

        await shopItem.save();
        res.status(201).json(shopItem);
    } catch (error) {
        res.status(500).json({ message: 'Failed to upload shop item', error });
    }
});

// GET endpoint to retrieve all shop items with pagination and filtering
app.get('/shop-items', async (req, res) => {
    try {
        const { page = 1, limit = 10, minPrice, maxPrice, name } = req.query;

        const filters = {};

        if (minPrice) filters.price = { $gte: minPrice };
        if (maxPrice) filters.price = { ...filters.price, $lte: maxPrice };
        if (name) filters.name = { $regex: name, $options: 'i' };

        const shopItems = await ShopItem.find(filters)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await ShopItem.countDocuments(filters);

        res.status(200).json({
            shopItems,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve shop items', error });
    }
});

// Endpoint to generate a token for testing
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'password') {
        const user = { id: 1, username: 'admin' };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
