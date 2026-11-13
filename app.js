export default function appSrc(
  express,
  bodyParser,
  createReadStream,
  crypto,
  http,
) {
  const app = express();
  const login = "aleldm";

  app.use((req, res, next) => {
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,OPTIONS,DELETE",
      "Access-Control-Allow-Headers":
        "Content-Type,Accept,x-test,ngrok-skip-browser-warning",
      "Cache-Control": "no-store",
    });

    if (!req.path.endsWith("/")) {
      const queryIndex = req.originalUrl.indexOf("?");
      const query = queryIndex === -1 ? "" : req.originalUrl.slice(queryIndex);
      return res.redirect(308, req.path.replace(/^\/+/, "/") + "/" + query);
    }

    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.get("/login/", (req, res) => {
    res.type("text/plain").send(login);
  });

  app.get("/code/", (req, res, next) => {
    res.type("text/plain");
    const source = createReadStream(
      decodeURIComponent(import.meta.url.substring(7)),
    );
    source.on("error", next);
    source.pipe(res);
  });

  app.get("/sha1/:input/", (req, res) => {
    res
      .type("text/plain")
      .send(crypto.createHash("sha1").update(req.params.input).digest("hex"));
  });

  const requestResource = (req, res) => {
    const addr = req.query.addr ?? req.body?.addr;
    let url;

    try {
      if (typeof addr !== "string") throw new Error();
      url = new URL(addr);
      if (url.protocol !== "http:") throw new Error();
    } catch {
      return res
        .status(400)
        .type("text/plain")
        .send("Укажите HTTP-адрес в параметре addr");
    }

    const upstream = http.get(url, (response) => {
      res.type("text/plain");
      response.on("error", () => {
        if (res.headersSent) res.destroy();
        else res.status(502).send("Не удалось прочитать ответ ресурса");
      });
      response.pipe(res);
    });

    upstream.setTimeout(10000, () => upstream.destroy(new Error("Timeout")));
    upstream.on("error", () => {
      if (!res.headersSent)
        res.status(502).type("text/plain").send("Не удалось получить ресурс");
      else res.destroy();
    });
    res.on("close", () => upstream.destroy());
  };

  app.route("/req/").get(requestResource).post(requestResource);

  app.all(/.*/, (req, res) => {
    res.type("text/plain").send(login);
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    res
      .status(err.status >= 400 && err.status < 500 ? err.status : 500)
      .type("text/plain")
      .send("Ошибка обработки запроса");
  });

  return app;
}
