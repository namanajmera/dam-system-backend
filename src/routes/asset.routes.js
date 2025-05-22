const express = require('express');
const router = express.Router();
const assetController = require('../controllers/asset.controller');
const upload = require('../middleware/upload.middleware');

// Upload a new asset
router.post('/upload', upload.single('file'), assetController.uploadAsset);

// Get all assets with optional filters
router.get('/', assetController.getAssets);

// Download asset by ID
router.get('/:id/download', assetController.downloadAsset);

// Delete asset by ID
router.delete('/:id', assetController.deleteAsset);

module.exports = router; 