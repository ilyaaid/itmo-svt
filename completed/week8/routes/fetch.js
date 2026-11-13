import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Получить текст по адресу</title>
</head>
<body>
  <label for="inp">Адрес</label>
  <input id="inp" type="text">
  <button id="bt" type="button">Получить</button>
  <p id="status" role="status"></p>
  <script>
    const input = document.getElementById("inp");
    const status = document.getElementById("status");
    document.getElementById("bt").addEventListener("click", async () => {
      status.textContent = "";
      try {
        const response = await fetch(input.value);
        input.value = await response.text();
      } catch (error) {
        status.textContent = "Не удалось получить ответ: " + error.message;
      }
    });
  </script>
</body>
</html>`);
});

export default router;
