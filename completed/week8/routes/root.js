import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.set({
    "X-Author": "aleldm",
    "Access-Control-Allow-Origin": "*",
  });

  res.type("text/plain").send("aleldm");
});

export default router;
