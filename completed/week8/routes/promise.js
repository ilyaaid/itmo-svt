import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.type("text/plain").send(
    'function task(x) { return x < 18 ? Promise.resolve("yes") : Promise.reject("no"); }',
  );
});

export default router;
