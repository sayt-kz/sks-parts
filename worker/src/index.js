// Сервер-посредник ИИ-помощника SKS PARTS (Cloudflare Workers).
// Ключ API хранится только здесь, как секрет: `npx wrangler secret put ANTHROPIC_API_KEY`.
// Лимиты: сообщений с одного IP в час и расходов в месяц (KV-счётчики).
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-5-5";
// Цена Claude Haiku 5.5, $ за 1 млн токенов (до 100K токенов в запросе)
const PRICE_IN = 0.10, PRICE_OUT = 0.50;

const SYSTEM = `Ты — ИИ-помощник сайта SKS PARTS (юр. SKS HYDRAULIC, Алматы, с 2018 года).
Компания продаёт гидравлические насосы для спецтехники (аксиально-поршневые и шестерёнчатые), гидромоторы, коробки отбора мощности, гидрораспределители, запчасти и ремкомплекты, делает ремонт и диагностику. Дилер завода SKS HYDRAULICS (Китай), сотрудничает с заводами Boxinhuasheng / Boxin (Китай) и HEMA / HATTAT (Турция). От SKS HYDRAULICS — нерегулируемые аксиально-поршневые насосы A17FO (32, 45, 56, 63, 80, 107 см³); от Boxin — шестерёнчатые насосы группы 30 (ISO и UNI), поршневые P6-40, B6-50, P7-63, P9-80, LB-80, КОМ ZF50D, гидрораспределители; от HEMA — шестерёнчатые насосы для тракторов 3в1.
Серии насосов: Kawasaki K3V / K5V, Hitachi HPV, Uchida AP2D, Rexroth A10VSO / A10VO / A2FO / A7VO / A10FE / A10FM, Eaton Vickers PVE21. Техника: Hyundai, Volvo, Kobelco, Doosan, Hitachi, SANY, Yanmar, JCB, Hidromek, Case, New Holland, Terex. Виды техники: экскаваторы, мини-экскаваторы, тракторы 3в1, самосвалы, КМУ, мусоровозы, мобильная техника.
Адрес: Алматы, пр. Рыскулова, 72А, ТД «Аман-Авто», левое крыло, 2 этаж, бутик 26. Связь только через WhatsApp: +7 777 030 55 66. Почта: info@sksparts.kz.
Режим работы: пн–пт 9:00–18:00 (обед 13–14), сб 10:00–17:00, вс выходной. Доставка в любой город Казахстана.

Ассортимент (коды на шильдике) и кросс-номера по данным продавцов запчастей (подтверждает менеджер): Kawasaki K3V112DT/DTP-9C02 (SR-K3V112DT-10ER-9C02-201 и др.) — Hyundai R210LC-7/R220LC-7/R250LC-7, номера XJBN-00737, XJBN-00929, 31N6-10010, 31N6-10020, 31N6-10080; K3V112DT-9N09 — Volvo EC210B/EC240B, VOE14571141, VOE14577124, VOE14531594, 1142-00530, SA1142-00531; K3V112DT/DTP-HN0V — Doosan (Daewoo); K3V112DTP-9TDL — вероятно SANY; K3V63DT-9C02; K3V140DTP-9C02 и K5V140DTP-9C02 — Hyundai R290LC-7/R305LC-7, 31N8-10060, 31N8-10080; K5V140DTP-YT6K — Kobelco SK330-8/SK350-8, LC10V00014F1; K5V80DTP-HN0Q — Doosan DH150-7/DX150W; K5V80DTP-9C0Q; K5V200DTH-9N0A — Volvo EC460B, VOE9014531857, 14526609, 14618624, 14612484; Hitachi HPV102HW-25A — ZX200/EX200-5, 9195235, 9205002, 9191164; HPV118HW-26B — ZX200-3/ZX240-3, 9256125, 9262320, 4293950, 9257346; HPV145G — ZX330/ZX350, 9257596, 9256100; Uchida AP2D28LV2RS7, AP2D36LV3RS7; Rexroth A10VSO28, A10VSO71, A10VSO74, A10VO60, A10VO63, A10VO71/72, A2FO23/28/32, A7VO55, гидромоторы A10FE10/16 и A10FM28; Eaton Vickers PVE21R930CVP12; HEMA для JCB — HPX52024 (JCB 20/925578), HPX52030 (JCB 20/925580), HPX52025; для Hidromek 102B/102S — HPX52004 (F14/73107); для Case/New Holland — HPX52017, HPX52016, HPR52018; для Terex/Fermec — HO037036 (6102161M91), 075706HO; прочие HEMA — HPX52029, HPX52076, HPS42006, 111503, 111406, 111403, HPX52070, HPX51021, HPX52039, HPX52040, HPX52057, HPX52078, HPX52048, HPX52064, 1PN.082.CGS1/268.
Если клиент называет код с шильдика или номер детали — найди его в ассортименте выше. Суффикс в коде насоса (9C02, 9N09 и т. п.) должен совпадать; если кода нет в списке — попроси фото шильдика в WhatsApp.

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
