import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API route ported from /app/api/lookup/route.ts
  app.get("/api/lookup", async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : null;
      if (!q || q.length > 30) {
        return res.status(400).json({ english: "", bopomofo: "" });
      }
      
      let english = "", bopomofo = "";
      await Promise.allSettled([
        fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-TW&tl=en&dt=t&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": "Mozilla/5.0" } })
          .then(r => r.ok ? r.json() : null)
          .then(d => { english = d?.[0]?.map((x: any) => x?.[0] || "").join("").trim() || "" }),
        fetch(`https://www.moedict.tw/a/${encodeURIComponent(q)}.json`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { bopomofo = d?.heteronyms?.[0]?.bopomofo || "" })
      ]);
      
      res.set("Cache-Control", "public, max-age=86400");
      res.json({ english, bopomofo });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
