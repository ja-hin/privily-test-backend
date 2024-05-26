// controllers/pageCtrl.js
const Page = require('../models/pageModel');
const Banner = require('../models/bannerModel');

// Get page content by type
const getPage = async (req, res) => {
    try {
        const page = await Page.findOne({ type: req.params.type });
        if (!page) {
            return res.status(404).json({ message: 'Page not found' });
        }
        res.json({ content: page.content });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

// Create or update page content
const savePage = async (req, res) => {
    try {
        const { type, content } = req.body;
        const page = await Page.findOneAndUpdate(
            { type },
            { content },
            { new: true, upsert: true }
        );
        res.json(page);
    } catch (err) {
        res.status(500).send(err.message);
    }
};
const getBanner = async (req, res) => {
    try {
        const banner = await Banner.findOne({ name: req.params.name });
        if (!banner) {
            return res.status(404).json({ message: 'Banner not found' });
        }
        res.json({ imageUrl: banner.imageUrl, link: banner.link });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

// Create or update banner image
const saveBanner = async (req, res) => {
    try {
        const { imageUrl, link } = req.body;
        const name = req.params.name;
        const banner = await Banner.findOneAndUpdate(
            { name },
            { imageUrl, link },
            { new: true, upsert: true }
        );
        res.json(banner);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

module.exports = {
    getPage,
    savePage,
    getBanner,
    saveBanner
};

