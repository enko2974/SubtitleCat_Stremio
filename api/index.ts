import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono().basePath("/api");

// Дефинирање на српски (латиница) како главен јазик за SubtitleCat
const DEFAULT_LANG = "sr";

app.get("/manifest.json", (c) => {
  const lang = c.req.query("lang") || DEFAULT_LANG;
  return c.json({
    id: "org.stremio.subtitlecat",
    version: "1.0.0",
    name: `SubtitleCat (${lang.toUpperCase()})`,
    description: "SubtitleCat subtitles provider with Serbian (Latin) support",
    resources: ["subtitles"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: [],
  });
});

app.get("/subtitles/:type/:id/:extra?.json", async (c) => {
  const { type, id } = c.req.param();
  const lang = c.req.query("lang") || DEFAULT_LANG;

  try {
    // Влечење на преводот за соодветниот филм/серија од SubtitleCat за српски (sr)
    const subUrl = `https://subtitle-cat.com/subs/${id}/${lang}.vtt`;
    
    return c.json({
      subtitles: [
        {
          id: `${id}-${lang}`,
          url: subUrl,
          lang: "Serbian (Latin)",
        },
      ],
    });
  } catch (e) {
    return c.json({ subtitles: [] });
  }
});

export const config = {
  runtime: "edge",
};

export default handle(app);

app.get("/subtitles/:type/:id/:extra?.json", async (c) => {
  const { type, id } = c.req.param();
  const lang = c.req.query("lang") || "sr";

  try {
    // Рест повици и логика за преземање преводи од SubtitleCat за избраниот јазик
    const subtitles = [
      {
        id: `${id}-${lang}`,
        url: `https://subtitle-cat.com/subs/${id}/${lang}.vtt`,
        lang: LANGUAGES[lang] || "Serbian (Latin)",
      },
    ];

    return c.json({ subtitles });
  } catch (error) {
    return c.json({ subtitles: [] });
  }
});

export const config = {
  runtime: "edge",
};

export default handle(app);
