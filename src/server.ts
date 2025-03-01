import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { run } from '.';

const app = express();
const port = 3000;

// Create uploads directory if it doesn't exist
const INDEX_DATA_TEMP_DIR = process.env.INDEX_DATA_TEMP_DIR || "index_data_temp/";
if (!fs.existsSync(INDEX_DATA_TEMP_DIR)) {
  fs.mkdirSync(INDEX_DATA_TEMP_DIR);
}

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, INDEX_DATA_TEMP_DIR + '/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Route for pdf upload
app.post('/upload', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'no file uploaded' });
    return;
  }
  console.log(req.body);
  let result = await run(req.body.doi, req.file.path);
  if (result.receiptIDs.length === 0) {
    res.status(400).json({ error: 'metadata is null' });
    return;
  }
  if (result.receiptIDs.length > 0) {
    res.status(200).json({
      message: 'upload success',
      receiptIDs: result.receiptIDs
    });
  }
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
