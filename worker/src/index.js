// Сервер-посредник ИИ-помощника SKS PARTS (Cloudflare Workers).
// Ключ API хранится только здесь, как секрет: `npx wrangler secret put ANTHROPIC_API_KEY`.
// Лимиты: сообщений с одного IP в час и расходов в месяц (KV-счётчики).
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-5-5";
// Цена Claude Haiku 5.5, $ за 1 млн токенов (до 100K токенов в запросе)
const PRICE_IN = 0.10, PRICE_OUT = 0.50;

const SYSTEM = `Ты — ИИ-помощник сайта SKS PARTS (юр. SKS HYDRAULIC, Алматы, с 2018 года).
Компания продаёт гидравлические насосы для спецтехники (аксиально-поршневые, шестерёнчатые, плунжерные), запчасти к насосам и гидромоторам, ремкомплекты, делает ремонт и диагностику. Дилер завода SKS HYDRAULICS (Китай), сотрудничает с заводами Boxinhuasheng / Boxin (Китай) и HEMA / HATTAT (Турция). От SKS HYDRAULICS — нерегулируемые аксиально-поршневые насосы A17FO (34–107 см³); от Boxin — шестерёнчатые, поршневые и плунжерные насосы; от HEMA — шестерёнчатые насосы для тракторов 3в1.
Марки насосов: Kawasaki (K3V, K5V, K7V), Rexroth, Sauer Danfoss, Nachi, Uchida, KYB. Техника: Komatsu, Hitachi, CAT, Hyundai, Volvo, Case, New Holland, SANY, Hidromek, JCB. Виды техники: экскаваторы, тракторы 3в1, краны, КМУ, автовышки, катки, дорожные фрезы, мусоровозы, комбайны.
Адрес: Алматы, пр. Рыскулова, 72А, ТД «Аман-Авто», левое крыло, 2 этаж, бутик 26. Связь только через WhatsApp: +7 777 030 55 66. Почта: info@sksparts.kz.
Режим работы: пн–пт 9:00–18:00 (обед 13–14), сб 10:00–17:00, вс выходной. Доставка в любой город Казахстана.

Каталог (пример): Kawasaki K3V63DT, K3V112DT, K3V140DT, K5V140DTP, K5V200DTH, K7V63DTP; Hitachi HPV102/HPV118; Komatsu HPV95/HPV132; Nachi PVD-2B/PVK-2B; Uchida AP2D; Rexroth A10VSO, A4VG, A8VO, A2FO/A7VO; Sauer Danfoss 90R; SKS HYDRAULICS A17FO (34–107); Boxin поршневые P7-63, P9-80SK, LB-63, B6-50; Boxin плунжерные XPI-32L, XPI-40L; Boxin шестерёнчатые CBHST1-80, CBHST1-110, CBHS3100, CBHW-UNI-80, CBHW-ISO-63, BF82A, CBHX1032, CBN-F550, НШ-32М, НШ-10М; HEMA шестерёнчатые для JCB 3CX/4CX, CAT 428/432, Hidromek 102, Case 580/695.
Таблица подбора (пример, подтверждает менеджер): Komatsu PC200 → HPV95; PC300 → HPV132; Hitachi EX200, ZX200 → HPV102; EX300/330 → HPV118; ZX55 → Nachi PVD-2B; CAT E200B → A8VO; CAT 320 → K3V112DT или A8VO; CAT 428/432 → шестерёнчатый HEMA или A10VSO; JCB 3CX/4CX → шестерёнчатый HEMA; Hyundai R210LC-7 → K3V112DT; R170W-7 → K3V63DT; Volvo EC180 → K7V63DTP; New Holland E215B → K3V112DT; SANY SY335 → K5V200DTH; Case CX290B → K3V140DT; Case 580/695 и Hidromek 102 → шестерёнчатый HEMA или A10VSO.

Правила:
- Говори о себе в мужском роде («понял», «подобрал»).
- Отвечай коротко (2–4 предложения), простым текстом без разметки, на языке клиента: русском или казахском.
- Не называй цены, наличие и сроки — предлагай написать менеджеру в WhatsApp.
- Не выдумывай совместимость. Если модели нет в таблице — попроси фото шильдика в WhatsApp. Всегда уточняй, что совместимость подтверждает менеджер.
- Не принимай паспортные, платёжные и другие личные данные; если их прислали — попроси не отправлять.
- На бессмысленный набор букв попроси марку и модель техники или номер насоса.
- Не обсуждай темы, не связанные с компанией и гидравликой.`;

const json = (obj, status, cors) => new Response(JSON.stringify(obj), {status, headers: {"content-type": "application/json; charset=utf-8", ...cors}});
const FALLBACK = "Сейчас не могу ответить. Напишите, пожалуйста, менеджеру в WhatsApp: +7 777 030 55 66.";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? {"access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "vary": "origin"}
      : {};
    if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: cors});
    if (request.method !== "POST") return json({error: "method"}, 405, cors);
    if (!cors["access-control-allow-origin"]) return json({error: "origin"}, 403, cors);

    // Проверка входа: только текст, только user/assistant, последнее — от пользователя
    let body;
    try { body = await request.json(); } catch { return json({error: "bad json"}, 400, cors); }
    const raw = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
    const messages = raw
      .filter(m => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map(m => ({role: m.role, content: m.content.slice(0, 1000)}));
    while (messages.length && messages[0].role !== "user") messages.shift();
    if (!messages.length || messages.at(-1).role !== "user") return json({error: "no message"}, 400, cors);

    // Лимит сообщений с одного IP за час
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const hourKey = `ip:${ip}:${Math.floor(Date.now() / 3600000)}`;
    const used = Number(await env.SKS_KV.get(hourKey)) || 0;
    if (used >= Number(env.MAX_MSG_PER_HOUR || 20)) {
      return json({reply: "Вы отправили много сообщений. Продолжим в WhatsApp: +7 777 030 55 66 — менеджер ответит на все вопросы."}, 200, cors);
    }
    await env.SKS_KV.put(hourKey, String(used + 1), {expirationTtl: 3700});

    // Месячный лимит расходов
    const monthKey = `spend:${new Date().toISOString().slice(0, 7)}`;
    const spent = Number(await env.SKS_KV.get(monthKey)) || 0;
    if (spent >= Number(env.MONTHLY_LIMIT_USD || 5)) return json({reply: FALLBACK}, 200, cors);

    const product = typeof body.product === "string" ? body.product.replace(/[^a-z0-9-]/gi, "").slice(0, 40) : "";
    const system = product ? `${SYSTEM}\n\nКлиент открыл страницу товара с кодом «${product}».` : SYSTEM;

    const client = new Anthropic({apiKey: env.ANTHROPIC_API_KEY});
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        output_config: {effort: "low"},
        system,
        messages,
      });
      const cost = (response.usage.input_tokens * PRICE_IN + response.usage.output_tokens * PRICE_OUT) / 1e6;
      await env.SKS_KV.put(monthKey, String(spent + cost), {expirationTtl: 40 * 86400});

      if (response.stop_reason === "refusal") return json({reply: FALLBACK}, 200, cors);
      const reply = response.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      return json({reply: reply || FALLBACK}, 200, cors);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) console.warn("rate limited");
      else if (error instanceof Anthropic.AuthenticationError) console.error("invalid API key");
      else if (error instanceof Anthropic.APIError) console.error(`API error ${error.status}: ${error.message}`);
      else console.error(error);
      return json({reply: FALLBACK}, 200, cors);
    }
  },
};
