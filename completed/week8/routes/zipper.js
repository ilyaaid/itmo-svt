import { Router } from "express";
import { gzip } from "node:zlib";
import upload from "../middleware/upload.js";

const router = Router();

router.post("/", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      return res
        .status(status)
        .type("text/plain")
        .send(
          status === 413
            ? "Файл слишком большой. Максимум 10 МБ."
            : "Ошибка загрузки. Отправьте один файл в поле file.",
        );
    }

    if (!req.file) {
      return res
        .status(400)
        .type("text/plain")
        .send("Отправьте файл в поле file.");
    }

    gzip(req.file.buffer, (err, compressed) => {
      if (err) return next(err);

      res.set({
        "Content-Type": "application/gzip",
        "Content-Disposition": 'attachment; filename="result.gz"',
      });

      res.send(compressed);
    });
  });
});

export default router;
