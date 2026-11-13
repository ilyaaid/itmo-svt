import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.set({
    "Content-Type": "text/plain; charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
  });

  res.send("function task(x) { return x * this * this; }");
});

export default router;
