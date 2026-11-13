import { Router } from "express";
import { privateDecrypt, constants } from "node:crypto";
import upload from "../middleware/upload.js";

const router = Router();

router.post(
  "/",
  upload.fields([
    { name: "key", maxCount: 1 },
    { name: "secret", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const key = req.files.key[0].buffer;
      const secret = req.files.secret[0].buffer;

      const result = privateDecrypt(
        { key, padding: constants.RSA_PKCS1_OAEP_PADDING },
        secret,
      );

      res.type("text/plain").send(result.toString("utf8"));
    } catch {
      res.status(400).type("text/plain").send("Ошибка расшифровки");
    }
  },
);

export default router;
