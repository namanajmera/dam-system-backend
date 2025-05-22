const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
require('dotenv').config();

const assetRoutes = require('./routes/asset.routes');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/assets', assetRoutes);

// Error handling
app.use(errorHandler);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://namanAjmera:9XObHIvhZ9knshFQ@cluster0.jtfersd.mongodb.net/dam-system')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Export app for server.js
module.exports = app; 