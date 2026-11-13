import { Router, text } from "express";

const router = Router();

router.all("/", text({ type: () => true }), (req, res) => {
  res.json({
    message: "aleldm",
    "x-result": req.get("x-test") ?? "",
    "x-body": req.body ?? "",
  });
});

export default router;
