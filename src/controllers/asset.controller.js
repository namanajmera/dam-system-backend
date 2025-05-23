const Asset = require('../models/asset.model');
const path = require('path');
const fs = require('fs').promises;

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Upload a new asset
exports.uploadAsset = async (req, res, next) => {
  try {
    console.log('Upload request received:', {
      file: req.file ? {
        mimetype: req.file.mimetype,
        size: req.file.size,
        filename: req.file.filename
      } : 'No file',
      body: req.body
    });

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No file uploaded',
        details: 'Please select a file to upload'
      });
    }

    // Validate file size
    if (req.file.size > MAX_FILE_SIZE) {
      console.log('File too large:', {
        providedSize: req.file.size,
        maxSize: MAX_FILE_SIZE
      });
      
      // Delete the uploaded file if it's too large
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting oversized file:', unlinkError);
      }
      
      return res.status(400).json({
        error: 'File too large',
        details: `Maximum file size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        providedSize: `${(req.file.size / (1024 * 1024)).toFixed(2)}MB`
      });
    }

    // Validate and process tags
    let processedTags = [];
    if (req.body.tags) {
      if (typeof req.body.tags !== 'string') {
        console.log('Invalid tags format:', {
          providedTags: req.body.tags,
          type: typeof req.body.tags
        });
        return res.status(400).json({
          error: 'Invalid tags format',
          details: 'Tags should be provided as a comma-separated string'
        });
      }
      processedTags = req.body.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    }

    const asset = new Asset({
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      tags: processedTags
    });

    console.log('Saving asset:', {
      filename: asset.filename,
      mimetype: asset.mimetype,
      size: asset.size
    });

    await asset.save();
    
    const response = {
      message: 'Asset uploaded successfully',
      asset: {
        id: asset._id,
        filename: asset.originalname,
        size: `${(asset.size / (1024 * 1024)).toFixed(2)}MB`,
        type: asset.mimetype,
        tags: asset.tags
      }
    };
    
    console.log('Upload successful:', response);
    res.status(201).json(response);
  } catch (error) {
    console.error('Upload error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });

    // Pass error to error handling middleware
    next(error);
  }
};

// Get all assets with filters
exports.getAssets = async (req, res, next) => {
  try {
    const { type, uploadDate, tags } = req.query;
    const query = {};

    if (type) {
      if (!SUPPORTED_FILE_TYPES.some(supportedType => supportedType.includes(type.toLowerCase()))) {
        return res.status(400).json({
          error: 'Invalid file type filter',
          details: `Supported file types are: ${SUPPORTED_FILE_TYPES.join(', ')}`
        });
      }
      query.mimetype = new RegExp(type, 'i');
    }

    if (uploadDate) {
      const date = new Date(uploadDate);
      if (isNaN(date.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format',
          details: 'Please provide date in YYYY-MM-DD format'
        });
      }
      query.uploadDate = {
        $gte: new Date(date.setHours(0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59))
      };
    }

    if (typeof tags === 'string' && tags.trim() !== '') {
      const tagArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      if (tagArray.length === 0) {
        return res.status(400).json({
          error: 'Invalid tags format',
          details: 'Tags should be non-empty, comma-separated values'
        });
      }
      
      const regexArray = tagArray.map(tag => new RegExp(tag, 'i'));
      query.tags = { $in: regexArray };
    }

    const assets = await Asset.find(query).sort({ uploadDate: -1 });
    res.json({
      count: assets.length,
      assets: assets.map(asset => ({
        id: asset._id,
        filename: asset.originalname,
        size: `${(asset.size / (1024 * 1024)).toFixed(2)}MB`,
        type: asset.mimetype,
        tags: asset.tags,
        uploadDate: asset.uploadDate
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Download asset by ID
exports.downloadAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({
        error: 'Asset not found',
        details: `No asset exists with ID: ${req.params.id}`
      });
    }

    // Check if file exists in filesystem
    try {
      await fs.access(asset.path);
    } catch (error) {
      return res.status(404).json({
        error: 'File not found',
        details: 'The physical file associated with this asset is missing'
      });
    }

    res.download(asset.path, asset.originalname);
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid asset ID',
        details: 'The provided asset ID format is invalid'
      });
    }
    next(error);
  }
};

// Delete asset by ID
exports.deleteAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findById(req.params.id);
    
    if (!asset) {
      return res.status(404).json({
        error: 'Asset not found',
        details: `No asset exists with ID: ${req.params.id}`
      });
    }

    // Delete file from filesystem
    try {
      await fs.unlink(asset.path);
    } catch (error) {
      // If file doesn't exist, continue with database deletion
      if (error.code !== 'ENOENT') {
        return res.status(500).json({
          error: 'File deletion failed',
          details: 'Could not delete the physical file'
        });
      }
    }
    
    // Delete from database
    await asset.deleteOne();
    
    res.json({
      message: 'Asset deleted successfully',
      details: {
        id: asset._id,
        filename: asset.originalname
      }
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: 'Invalid asset ID',
        details: 'The provided asset ID format is invalid'
      });
    }
    next(error);
  }
}; 