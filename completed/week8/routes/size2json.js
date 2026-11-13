import { Router } from "express";
import upload from "../middleware/upload.js";

const router = Router();

router.post("/", upload.single("image"), (req, res) => {
  const buffer = req.file?.buffer;

  if (
    !buffer ||
    buffer.length < 24 ||
    buffer.toString("hex", 0, 8) !== "89504e470d0a1a0a"
  ) {
    return res.status(400).send("Отправьте PNG-файл в поле image");
  }

  res.json({
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  });
});

export default router;
