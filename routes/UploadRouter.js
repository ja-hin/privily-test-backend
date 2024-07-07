// const express = require("express");
// const multer = require("multer");
// const path = require("path");

// const router = express.Router();

// // Set up storage engine
// const storage = multer.diskStorage({
//   destination: "./uploads/",
//   filename: function (req, file, cb) {
//     cb(
//       null,
//       file.fieldname + "-" + Date.now() + path.extname(file.originalname)
//     );
//   },
// });

// // Init upload
// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 50000000 }, // 1MB limit
//   fileFilter: function (req, file, cb) {
//     checkFileType(file, cb);
//   },
// }).array("images", 10); // up to 10 images

// // Check file type
// function checkFileType(file, cb) {
//   // Allowed ext
//   const filetypes = /jpeg|jpg|png|gif/;
//   // Check ext
//   const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
//   // Check mime
//   const mimetype = filetypes.test(file.mimetype);

//   if (mimetype && extname) {
//     return cb(null, true);
//   } else {
//     cb("Error: Images Only!");
//   }
// }

// // Upload endpoint
// router.post("/upload", (req, res) => {
//   upload(req, res, (err) => {
//     if (err) {
//       res.status(400).json({ message: err });
//     } else {
//       if (req.files == undefined) {
//         res.status(400).json({ message: "No file selected" });
//       } else {
//         res.json({
//           message: "Files Uploaded!",
//           files: req.files.map((file) => ({
//             url: `/uploads/${file.filename}`,
//           })),
//         });
//       }
//     }
//   });
// });

// module.exports = router;




const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { GridFsStorage } = require("multer-gridfs-storage");
const Grid = require("gridfs-stream");
const path = require("path");

const router = express.Router();

// Mongo URI
const mongoURI = process.env.MONGODB_URL;

// Create mongo connection
const conn = mongoose.createConnection(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Init gfs
let gfs;
conn.once("open", () => {
  // Init stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename =
        file.fieldname + "-" + Date.now() + path.extname(file.originalname);
      const fileInfo = {
        filename: filename,
        bucketName: "uploads",
      };
      resolve(fileInfo);
    });
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50000000 }, // 50MB limit
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
}).array("images", 10); // up to 10 images

// Check file type
function checkFileType(file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|gif/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Images Only!");
  }
}

// Upload endpoint
router.post("/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      res.status(400).json({ message: err });
    } else {
      if (req.files == undefined) {
        res.status(400).json({ message: "No file selected" });
      } else {
        res.json({
          message: "Files Uploaded!",
          files: req.files.map((file) => ({
            url: `/file/${file.filename}`,
          })),
        });
      }
    }
  });
});

router.get("/file/:filename", (req, res) => {
  gfs.files.findOne({ filename: req.params.filename }, (err, file) => {
    if (!file || file.length === 0) {
      return res.status(404).json({ err: "No file exists" });
    }

    // Check if image
    if (file.contentType === "image/jpeg" || file.contentType === "image/png") {
      // Read output to browser
      const readstream = gfs.createReadStream(file.filename);
      readstream.pipe(res);
    } else {
      res.status(404).json({ err: "Not an image" });
    }
  });
});


module.exports = router;
