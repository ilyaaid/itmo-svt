import { Router } from "express";

const router = Router();

router.get("/:N", async (req, res, next) => {
  if (!/^\d+$/.test(req.params.N)) {
    return res.status(400).type("text/plain").send("Некорректный ID");
  }

  try {
    const upstream = await fetch(
      `https://nd.kodaktor.ru/users/${req.params.N}`,
      { method: "GET" },
    );

    if (!upstream.ok) {
      return res
        .status(502)
        .type("text/plain")
        .send("Не удалось получить данные пользователя");
    }

    const user = await upstream.json();

    if (user.login == null) {
      return res.status(502).type("text/plain").send("В ответе нет поля login");
    }

    res.type("text/plain").send(String(user.login));
  } catch (err) {
    next(err);
  }
});

export default router;
