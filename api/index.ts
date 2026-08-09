import { Hono } from "hono";
import { handle } from "hono/vercel";

const app = new Hono().basePath("/api");

// Дефиниција за поддржани јазици (вклучувајќи српски латиница - sr)
const LANGUAGES: Record<string, string> = {
  sr: "Serbian (Latin)",
  en: "English",
  mk: "Macedonian",
  bs: "Bosnian",
  hr: "Croatian",
  sq: "Albanian",
  bg: "Bulgarian",
  ro: "Romanian",
  sl: "Slovenian",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ru: "Russian",
  tr: "Turkish",
};

app.get("/manifest.json", (c) => {
  return c.json({
    id: "org.stremio.subtitlecat",
    version: "1.0.0",
    name: "SubtitleCat Subtitles",
    description: "SubtitleCat provider with Serbian (Latin) translation support for Stremio",
    resources: ["subtitles"],
    types: ["movie", "series"],
    idPrefixes: ["tt"],
    catalogs: [],
  });
});

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
