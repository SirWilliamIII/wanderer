// src/models.js
import mongoose from 'mongoose';

// Schema for scraped page data
const scrapedDataSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        index: true
    },
    title: String,
    description: String,
    text: String,
    wordCount: Number,
    linkCount: Number,
    imageCount: Number,
    headings: {
        h1: [String],
        h2: [String], 
        h3: [String]
    },
    mode: {
        type: String,
        enum: ['wander', 'strict'],
        required: true
    },
    depth: {
        type: Number,
        default: 0
    },
    parentUrl: String,
    status: {
        type: String,
        default: 'success',
        enum: ['success', 'failed']
    },
    statusCode: Number,
    errorMessages: [String],
    retryCount: Number,
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    // Additional extracted data for specific page types
    products: [{
        name: String,
        price: String,
        description: String
    }],
    // Store any additional metadata
    metadata: mongoose.Schema.Types.Mixed,
    
    // Simple classification
    category: {
        type: String,
        default: 'general',
        index: true
    }
}, {
    timestamps: true
});

// Compound indexes for efficient querying
scrapedDataSchema.index({ url: 1, timestamp: -1 });
scrapedDataSchema.index({ mode: 1, status: 1 });
scrapedDataSchema.index({ category: 1, timestamp: -1 });
scrapedDataSchema.index({ mode: 1, category: 1 });

export const ScrapedData = mongoose.model('ScrapedData', scrapedDataSchema);