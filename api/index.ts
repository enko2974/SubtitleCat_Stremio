import { Hono } from "hono";
import { handle } from "hono/vercel";
import { GoogleGenAI } from "@google/genai";

const app = new Hono().basePath("/api");

const DEFAULT_LANG = "sr";

// Функција за превод преку Gemini API
async function translateWithGemini(text: string, targetLang: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `Преведи ги следните текстуални титлови (Subtitle SRT/VTT формат) од англиски на српски јазик (латиница). 
ВАЖНО: Задолжително задржи ги сите временски ознаки (timestamps), броеви на редови и форматирањето потполно непроменети. Преведувај го само текстот. Еве го текстот:

${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || text;
  } catch (error) {
    console.error("Gemini Translation Error:", error);
    return text; // Врати го оригиналниот текст ако настане грешка
  }
}

app.get("/manifest.json", (c) => {
  const lang = c.req.query("lang") || DEFAULT_LANG;
  return c.json({
    id: "org.stremio.subtitlecat.ai",
    version: "2.0.0",
    name: `SubtitleCat (Gemini Serbian AI)`,
    description: "SubtitleCat subtitles automatically translated to Serbian Latin via Gemini AI",
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
    // 1. Симни го оригиналниот англиски превод од SubtitleCat (или основен извор)
    const englishSubUrl = `https://subtitle-cat.com/subs/${id}/en.vtt`;
    
    const subResponse = await fetch(englishSubUrl);
    if (!subResponse.ok) {
      return c.json({ subtitles: [] });
    }
    
    let subtitleText = await subResponse.text();

    // 2. Ако е побаран српски, преведи го со Gemini
    if (lang === "sr") {
      subtitleText = await translateWithGemini(subtitleText, "sr");
    }

    // 3. Зачувај го преведениот превод во привремен објект или врати директен линк/текст
    // Бидејќи Edge функциите имаат ограничен формат, најдобро е да вратиме data URL или директен одговор со преводот, 
    // но за Stremio најлесно е да го пренасочиме преку посебна рута за симнување.
    
    const host = c.req.header("host") || "";
    const protocol = c.req.header("x-forwarded-proto") || "https";
    const proxyUrl = `${protocol}://${host}/api/download-sub?id=${id}&lang=${lang}&url=${encodeURIComponent(englishSubUrl)}`;

    return c.json({
      subtitles: [
        {
          id: `${id}-${lang}-ai`,
          url: proxyUrl,
          lang: "Serbian (AI Translated)",
        },
      ],
    });
  } catch (e) {
    console.error("Subtitles Handler Error:", e);
    return c.json({ subtitles: [] });
  }
});

// Дополнителна рута што го врши преводот кога Stremio ќе го побара фајлот
app.get("/download-sub", async (c) => {
  const subUrl = c.req.query("url");
  const lang = c.req.query("lang") || "sr";

  if (!subUrl) return c.text("Missing url", 400);

  try {
    const res = await fetch(subUrl);
    let text = await res.text();

    if (lang === "sr") {
      text = await translateWithGemini(text, "sr");
    }

    return new Response(text, {
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return c.text("Error processing subtitle", 500);
  }
});

export const config = {
  runtime: "edge",
};

export default handle(app);
