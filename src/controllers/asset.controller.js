const Asset = require('../models/asset.model');
const path = require('path');
const fs = require('fs').promises;

// Upload a new asset
exports.uploadAsset = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const asset = new Asset({
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : []
    });

    await asset.save();
    res.status(201).json(asset);
  } catch (error) {
    next(error);
  }
};

// Get all assets with filters
exports.getAssets = async (req, res, next) => {
  try {
    const { type, uploadDate, tags } = req.query;
    const query = {};

    if (type) {
      query.mimetype = new RegExp(type, 'i');
    }

    if (uploadDate) {
      const date = new Date(uploadDate);
      query.uploadDate = {
        $gte: new Date(date.setHours(0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59))
      };
    }

    if (typeof tags === 'string' && tags.trim() !== '') {
      const regexArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .map(tag => new RegExp(tag, 'i'));
    
      query.tags = { $in: regexArray };
    }

    const assets = await Asset.find(query).sort({ uploadDate: -1 });
    res.json(assets);
  } catch (error) {
    next(error);
  }
};

// Download asset by ID
exports.downloadAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.download(asset.path, asset.originalname);
  } catch (error) {
    next(error);
  }
};

// Delete asset by ID
exports.deleteAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete file from filesystem
    await fs.unlink(asset.path);
    
    // Delete from database
    await asset.deleteOne();
    
    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    next(error);
  }
}; 