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

//get banner images
const getBanner = async (req, res) => {
    try {
        const banner = await Banner.findOne({});
        if (!banner) {
            return res.status(404).json({ message: 'No banners found' });
        }
        res.json(banner);
    } catch (err) {
        res.status(500).send(err.message);
    }
};

// Create or update banner images
const saveBanner = async (req, res) => {
    try {
        const { banners } = req.body;

        if (!banners || typeof banners !== 'object') {
            return res.status(400).json({ message: 'Invalid request body' });
        }

        let banner = await Banner.findOne({});

        if (!banner) {
            // If no banner document exists, create one
            const newBanner = new Banner(banners);
            await newBanner.save();
            return res.json(newBanner);
        }

        // If banner document exists, update the appropriate categories
        for (const category in banners) {
            if (banners.hasOwnProperty(category)) {
                if (!banner[category]) {
                    banner[category] = [];
                }
                banner[category] = banner[category].concat(banners[category]);
            }
        }
        await banner.save();

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

