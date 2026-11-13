import { Router } from "express";

const router = Router();
const login = "aleldm";

router.get("/", (req, res) => {
  res.set({
    "Content-Type": "text/plain; charset=UTF-8",
    "Access-Control-Allow-Origin": "*",
  });

  res.send(login);
});

export default router;
