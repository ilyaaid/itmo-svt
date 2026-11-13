import { Router } from "express";

const router = Router();

const moscowHour = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Moscow",
  hour: "2-digit",
  hourCycle: "h23",
});

router.get("/", (req, res) => {
  res.type("text/plain").send(moscowHour.format(new Date()));
});

export default router;
