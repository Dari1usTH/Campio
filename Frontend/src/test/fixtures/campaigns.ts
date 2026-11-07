import candle from "@/assets/candle.jpg";
import mug from "@/assets/mug.jpg";
import { computeMessageScore, DEFAULT_BUDGET_RON } from "@/lib/scoring";
import type { Campaign, Notification, Product } from "@/services/schemas";

const msg = (
  id: string,
  label: string,
  text: string,
  angle: string,
  click: number,
  stop: number,
  share: number,
  isWinner: boolean,
  reactions: Campaign["messages"][number]["reactions"],
) => ({
  id,
  label,
  text,
  angle,
  click,
  stop,
  share,
  score: computeMessageScore({ click, stop, share }),
  isWinner,
  reactions,
});

export function buildCampaign(
  id: string,
  product: Product,
  overrides: Partial<Campaign> = {},
): Campaign {
  const name = product.name;
  const price = product.price ?? 89;
  const campaign: Campaign = {
    id,
    createdAt: new Date().toISOString(),
    status: "ready",
    isDemo: false,
    product,
    marketplaces: ["etsy"],
    goal: "sales",
    budget: DEFAULT_BUDGET_RON,
    tone: "warm",
    durationDays: 30,
    health: 82,
    segments: [
      {
        id: "s1",
        name: "Iubitorii de decor cozy",
        ageRange: "25–40 ani",
        platforms: ["instagram", "pinterest"],
        motivations: ["Seri liniștite acasă", "Estetică caldă, naturală", "Ritualuri de self-care"],
        description: "Își decorează casa cu atenție și salvează idei pe Pinterest.",
      },
      {
        id: "s2",
        name: "Căutătorii de cadouri unice",
        ageRange: "28–50 ani",
        platforms: ["instagram", "tiktok"],
        motivations: ["Cadou personal, nu banal", "Ambalaj frumos", "Livrare rapidă"],
        description: "Caută un cadou care pare ales cu grijă, nu luat din fugă.",
      },
    ],
    positioning: `${name} este alegerea caldă și naturală pentru cei care vor ca acasă să miroasă a liniște, fără compromisuri la ingrediente.`,
    keyMessage: "Seara ta liniștită începe cu o flacără curată.",
    tones: ["Cald", "Autentic", "Calm"],
    messages: [
      msg(
        "m1",
        "Mesaj A",
        "Seara ta liniștită începe cu o flacără curată. Ceară de soia, turnată manual.",
        "Ritual & liniște",
        55,
        50,
        48,
        true,
        [
          {
            id: "r1",
            persona: "Ioana",
            age: 31,
            segmentId: "s1",
            quote: "Exact vibe-ul pe care îl caut după o zi lungă. Aș da click.",
            sentiment: "positive",
          },
          {
            id: "r2",
            persona: "Mihai",
            age: 42,
            segmentId: "s2",
            quote: "Sună frumos, dar nu știu cât costă. Ar trebui să văd prețul.",
            objection: "Lipsește prețul",
            sentiment: "neutral",
          },
          {
            id: "r3",
            persona: "Andreea",
            age: 27,
            segmentId: "s1",
            quote: "„Flacără curată” mă face să mă simt bine în privința ingredientelor.",
            sentiment: "positive",
          },
        ],
      ),
      msg(
        "m2",
        "Mesaj B",
        "Cadoul care spune „m-am gândit la tine”. Lumânare artizanală, ambalată cadou.",
        "Cadou personal",
        40,
        42,
        30,
        false,
        [
          {
            id: "r4",
            persona: "Radu",
            age: 35,
            segmentId: "s2",
            quote: "Bun pentru cadou, dar sună ca multe alte magazine.",
            objection: "Prea generic",
            sentiment: "neutral",
          },
          {
            id: "r5",
            persona: "Elena",
            age: 48,
            segmentId: "s2",
            quote: "Aș vrea să știu dacă ajunge la timp de ziua ei.",
            objection: "Termen de livrare neclar",
            sentiment: "neutral",
          },
        ],
      ),
      msg(
        "m3",
        "Mesaj C",
        `Doar ${price} lei pentru 45 de ore de atmosferă. Comandă azi.`,
        "Preț & valoare",
        33,
        38,
        30,
        false,
        [
          {
            id: "r6",
            persona: "Cristina",
            age: 29,
            segmentId: "s1",
            quote: "Prețul e clar, dar mesajul e rece, nu simt nimic.",
            objection: "Lipsește emoția",
            sentiment: "negative",
          },
          {
            id: "r7",
            persona: "Vlad",
            age: 38,
            segmentId: "s2",
            quote: "45 de ore e un argument bun. Dar „comandă azi” e cam insistent.",
            objection: "Ton prea agresiv",
            sentiment: "neutral",
          },
        ],
      ),
    ],
    warnings: [
      {
        id: "w1",
        title: "Verifică afirmațiile din mesaje",
        why: "Expresia „flacără curată” sugerează un beneficiu care nu este demonstrat în descrierea produsului.",
        fix: "Folosește „ceară de soia, turnată manual” și păstrează doar caracteristicile pe care le poți confirma.",
        resolved: false,
      },
      {
        id: "w2",
        title: "Prețul lipsește din mesajul câștigător",
        why: "În reacțiile simulate apare întrebarea despre preț. Mesajul C îl menționează, dar varianta câștigătoare nu.",
        fix: `Adaugă „${price} lei” în caption sau în primul cadru al videoului.`,
        resolved: false,
      },
    ],
    agentRounds: [
      {
        id: "a1",
        kind: "round",
        label: "Runda 1",
        message: "Seara ta liniștită începe cu o flacără curată.",
        score: 52,
        note: "Câștigător inițial. Obiecții frecvente: prețul lipsește, nu e clar cât durează.",
        objectionsAddressed: [],
      },
      {
        id: "a2",
        kind: "rewrite",
        label: "Rescriere",
        message: `Seara ta liniștită începe cu o flacără curată: 45 de ore de ceară de soia, ${price} lei.`,
        note: "Agentul a adăugat durata și prețul, păstrând tonul cald.",
        objectionsAddressed: ["Lipsește prețul", "Cât durează?"],
      },
      {
        id: "a3",
        kind: "round",
        label: "Runda 2",
        message: `Seara ta liniștită începe cu o flacără curată: 45 de ore de ceară de soia, ${price} lei.`,
        score: 64,
        versusScore: 39,
        note: "Mesajul rescris câștigă clar față de cea mai bună alternativă.",
        objectionsAddressed: [],
      },
      {
        id: "a4",
        kind: "stop",
        label: "Runda 3",
        score: 63,
        note: "Mesajul a rezistat, agentul s-a oprit. O nouă rescriere nu mai aducea câștig.",
        objectionsAddressed: [],
      },
    ],
    channels: [
      {
        id: "c1",
        channel: "Instagram Ads",
        platform: "instagram",
        type: "paid",
        budget: 250,
        why: "Publicul cozy reacționează cel mai bine la vizual cald, în feed și Reels.",
        firstActions: [
          { id: "c1a", text: "Creează o reclamă Reels cu mesajul câștigător", done: false },
          {
            id: "c1b",
            text: "Setează publicul: femei 25–40, interes decor & self-care",
            done: false,
          },
          { id: "c1c", text: "Buget zilnic 8 lei, 30 de zile", done: false },
        ],
      },
      {
        id: "c2",
        channel: "TikTok Ads",
        platform: "tiktok",
        type: "paid",
        budget: 150,
        why: "Cel mai ieftin mod de a ajunge la cei care caută cadouri.",
        firstActions: [
          { id: "c2a", text: "Filmează videoul de 15 secunde după script", done: false },
          { id: "c2b", text: "Lansează Spark Ad pe cel mai bun video organic", done: false },
        ],
      },
      {
        id: "c3",
        channel: "Pinterest organic",
        platform: "pinterest",
        type: "organic",
        budget: 0,
        why: "Pin-urile cu decor cozy aduc trafic luni la rând, gratuit.",
        firstActions: [
          { id: "c3a", text: "Publică 5 pin-uri cu lumânarea în decoruri diferite", done: false },
          { id: "c3b", text: "Adaugă link direct către produsul de pe Etsy", done: false },
        ],
      },
      {
        id: "c4",
        channel: "Email către clienți",
        platform: "email",
        type: "organic",
        budget: 100,
        why: "Clienții existenți cumpără de 3× mai des. 100 lei pentru un tool de email simplu.",
        firstActions: [{ id: "c4a", text: "Trimite emailul cu subiectul câștigător", done: false }],
      },
    ],
    copy: {
      instagram: {
        caption: `Seara ta liniștită începe cu o flacără curată. 🕯️\n\n${name}: ceară de soia turnată manual, fitil din bumbac și 45 de ore de atmosferă caldă.\n\nPerfectă pentru serile tale sau ca un cadou care spune „m-am gândit la tine”.\n\n${price} lei · link în bio`,
        hashtags: [
          "#lumanaresoia",
          "#decorcozy",
          "#handmaderomania",
          "#cadouunic",
          "#selfcare",
          "#hygge",
        ],
      },
      tiktok: {
        hook: "POV: ai găsit lumânarea care miroase a pădure după ploaie",
        beats: [
          {
            from: 0,
            to: 3,
            visual: "Prim-plan: chibritul se aprinde, lumina scade",
            voice: "POV: ai găsit lumânarea care miroase a pădure după ploaie",
          },
          {
            from: 3,
            to: 7,
            visual: "Ceara turnată manual în borcan, slow motion",
            voice: "Ceară de soia, turnată de mână, în loturi mici.",
          },
          {
            from: 7,
            to: 11,
            visual: "Cameră cozy, pătură, carte, lumânarea aprinsă",
            voice: "45 de ore de seri liniștite.",
          },
          {
            from: 11,
            to: 15,
            visual: "Produsul + preț + „Comandă acum”",
            voice: `${price} lei. Link-ul e în bio.`,
          },
        ],
      },
      meta: {
        headline: "45 de ore de seri liniștite",
        primaryText: `Ceară de soia turnată manual, fitil din bumbac și un parfum care te duce în pădure. ${name}, ${price} lei. Verifică disponibilitatea în magazin.`,
        cta: "Cumpără acum",
      },
      email: {
        subjects: [
          "Seara ta liniștită începe aici 🕯️",
          "Am turnat un lot nou (și e mic)",
          "Cadoul care spune „m-am gândit la tine”",
        ],
      },
    },
    kpis: [
      { id: "k1", label: "Comenzi", target: 28, unit: "", hint: "în 30 de zile" },
      { id: "k2", label: "Rată de click", target: 1.8, unit: "%", hint: "medie pe reclame" },
      { id: "k3", label: "Cost per comandă", target: 14, unit: "lei", hint: "țintă maximă" },
    ],
    costUsd: [0.01, 0.02],
    ...overrides,
  };
  const productText = `${product.name} ${product.category} ${product.shortDescription}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!/lumanar|candle|ceara.{0,20}soia/i.test(productText)) {
    Object.assign(campaign, genericCampaignContent(product, campaign), overrides);
  }
  campaign.channels = allocateBudget(campaign.channels, campaign.budget).map((channel) => ({
    ...channel,
    firstActions: channel.firstActions.map((action) => ({
      ...action,
      text: action.text.startsWith("Buget zilnic")
        ? `Buget zilnic orientativ ${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(channel.budget / campaign.durationDays)} lei, ${campaign.durationDays} zile`
        : action.text,
    })),
  }));
  if (!overrides.kpis) campaign.kpis = campaignKpis(campaign);
  return campaign;
}

/** Keep integer channel allocations consistent with the chosen total, including seed overrides. */
export function allocateBudget(
  channels: Campaign["channels"],
  budget: number,
): Campaign["channels"] {
  const total = channels.reduce((sum, channel) => sum + Math.max(0, channel.budget), 0);
  let remaining = budget;
  const lastPositive = channels.reduce(
    (last, channel, index) => (channel.budget > 0 ? index : last),
    -1,
  );
  return channels.map((channel, index) => {
    const allocation =
      total > 0
        ? index === lastPositive
          ? remaining
          : Math.round((budget * Math.max(0, channel.budget)) / total)
        : index === 0
          ? budget
          : 0;
    remaining -= allocation;
    return { ...channel, budget: allocation };
  });
}

function campaignKpis(campaign: Campaign): Campaign["kpis"] {
  const days = campaign.durationDays;
  const hint = `scenariu demonstrativ pentru ${days} zile`;
  const ctr = {
    id: "ctr",
    label: "Rată de click",
    target: 1.8,
    unit: "%",
    hint: "valoare orientativă, nu o promisiune",
  };
  const priceRon = campaign.product.currency === "RON" ? campaign.product.price : null;
  const goalFactor = campaign.goal === "awareness" ? 1.5 : campaign.goal === "traffic" ? 1.2 : 1;
  const cpo = Math.round((priceRon ? Math.max(8, priceRon * 0.18) : 18) * goalFactor);
  return [
    {
      id: "orders",
      label: "Comenzi",
      target: Math.max(1, Math.round(campaign.budget / cpo)),
      unit: "",
      hint,
    },
    ctr,
    {
      id: "cpo",
      label: "Cost per comandă",
      target: cpo,
      unit: "lei",
      hint: "cost orientativ, nu o garanție",
    },
  ];
}

function genericCampaignContent(product: Product, campaign: Campaign): Partial<Campaign> {
  const name = product.name;
  const strengths = product.strengths.map((value) => value.trim()).filter(Boolean);
  const benefit = strengths[0] || product.category || "Detalii care contează";
  const audience = product.audience || `Persoanele interesate de ${product.category || name}`;
  const price =
    product.price === null
      ? "Cere detalii despre preț"
      : `${new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 }).format(product.price)} ${product.currency === "RON" ? "lei" : product.currency}`;
  const toneLabel = { warm: "Cald", premium: "Premium", playful: "Jucăuș", direct: "Direct" }[
    campaign.tone
  ];
  const messageByTone = {
    warm: `${name}. Un lucru ales cu grijă, pentru tine.`,
    premium: `Detaliile fac diferența. Descoperă ${name}.`,
    playful: `${name} îți face cu ochiul. Îi faci loc?`,
    direct: `${name}. ${benefit}. ${price}.`,
  };
  const mainMessage =
    campaign.keyMessage !== "Seara ta liniștită începe cu o flacără curată."
      ? campaign.keyMessage
      : messageByTone[campaign.tone];
  const action =
    campaign.goal === "sales"
      ? "Comandă acum"
      : campaign.goal === "traffic"
        ? "Vezi detaliile"
        : "Descoperă povestea";
  const improved = `${mainMessage} ${benefit}. ${price}.`;
  const hashtag = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
  return {
    segments: [
      {
        id: "s1",
        name: "Publicul care se regăsește în produs",
        ageRange: "25–45 ani · profil simulat",
        platforms: ["instagram", "facebook"],
        motivations: [
          benefit,
          "Informații clare înainte de cumpărare",
          "Un produs potrivit nevoilor proprii",
        ],
        description: audience,
      },
      {
        id: "s2",
        name: "Cei care compară înainte să aleagă",
        ageRange: "28–50 ani · profil simulat",
        platforms: ["instagram", "tiktok"],
        motivations: [
          "Raport între preț și caracteristici",
          "Fotografii și detalii verificabile",
          "Încredere în magazin",
        ],
        description: `Descoperă ${name} și compară specificațiile, prețul și experiența de cumpărare.`,
      },
    ],
    positioning: `${name} se adresează publicului „${audience}”, cu accent pe ${strengths.length ? strengths.join(", ").toLowerCase() : product.shortDescription.toLowerCase()}.`,
    keyMessage: mainMessage,
    tones: [toneLabel, "Clar", "Autentic"],
    messages: [
      msg("m1", "Mesaj A", mainMessage, "Beneficiu & apropiere", 55, 50, 48, true, [
        {
          id: "r1",
          persona: "Ioana",
          age: 31,
          segmentId: "s1",
          quote: `Aș vrea să văd mai multe despre ${name}. Mesajul îmi atrage atenția.`,
          sentiment: "positive",
        },
        {
          id: "r2",
          persona: "Mihai",
          age: 42,
          segmentId: "s2",
          quote:
            product.price === null
              ? "Mi-ar plăcea să știu prețul înainte să intru pe site."
              : `Vreau să văd și prețul de ${price} alături de mesaj.`,
          objection: "Prețul trebuie să fie vizibil",
          sentiment: "neutral",
        },
      ]),
      msg(
        "m2",
        "Mesaj B",
        `${name}: ${benefit.toLowerCase()}. Vezi toate detaliile și alege în ritmul tău.`,
        "Caracteristici & încredere",
        40,
        42,
        30,
        false,
        [
          {
            id: "r3",
            persona: "Elena",
            age: 38,
            segmentId: "s2",
            quote:
              "Îmi place că sunt menționate caracteristicile. Aș verifica și fotografiile produsului.",
            sentiment: "positive",
          },
          {
            id: "r4",
            persona: "Radu",
            age: 35,
            segmentId: "s2",
            quote: "E clar, dar mi-ar prinde bine un exemplu de utilizare.",
            objection: "Lipsește un context de utilizare",
            sentiment: "neutral",
          },
        ],
      ),
      msg("m3", "Mesaj C", `${name} · ${price}. ${action}.`, "Preț & acțiune", 33, 38, 30, false, [
        {
          id: "r5",
          persona: "Andreea",
          age: 27,
          segmentId: "s1",
          quote:
            "Prețul și pasul următor sunt clare. Aș vrea să înțeleg și ce face produsul special.",
          objection: "Lipsește diferențiatorul",
          sentiment: "neutral",
        },
      ]),
    ],
    warnings: [
      {
        id: "w1",
        title:
          product.price === null
            ? "Completează prețul produsului"
            : "Păstrează prețul vizibil în materialele finale",
        why: "Un preț clar ajută oamenii să decidă dacă produsul li se potrivește. Acesta este un scenariu demonstrativ, nu o concluzie bazată pe clienți reali.",
        fix:
          product.price === null
            ? "Adaugă prețul real în descriere, apoi actualizează textele."
            : `Include „${price}” în prima parte a descrierii sau a videoului.`,
        resolved: false,
      },
      {
        id: "w2",
        title: "Verifică promisiunile înainte să publici",
        why: "Textele sunt un punct de plecare. Informațiile despre produs, stoc și livrare trebuie confirmate de tine.",
        fix: "Păstrează doar caracteristicile pe care le poți demonstra și adaugă condițiile reale de livrare în magazin.",
        resolved: false,
      },
    ],
    agentRounds: [
      {
        id: "a1",
        kind: "round",
        label: "Runda 1",
        message: mainMessage,
        score: 52,
        note: "În simulare apar întrebări despre preț și despre caracteristica principală.",
        objectionsAddressed: [],
      },
      {
        id: "a2",
        kind: "rewrite",
        label: "Rescriere",
        message: improved,
        note: `Mesajul păstrează tonul ${toneLabel.toLowerCase()} și adaugă informații concrete din descriere.`,
        objectionsAddressed: ["Prețul trebuie să fie vizibil", "Lipsește diferențiatorul"],
      },
      {
        id: "a3",
        kind: "round",
        label: "Runda 2",
        message: improved,
        score: 64,
        versusScore: 39,
        note: "În scenariul demonstrativ, mesajul cu detalii răspunde mai bine obiecțiilor.",
        objectionsAddressed: [],
      },
      {
        id: "a4",
        kind: "stop",
        label: "Runda 3",
        score: 63,
        note: "Scorul simulat nu mai crește. Agentul se oprește și păstrează varianta anterioară.",
        objectionsAddressed: [],
      },
    ],
    channels: [
      {
        id: "c1",
        channel: "Instagram Ads",
        platform: "instagram",
        type: "paid",
        budget: 250,
        why: `Testează un vizual clar cu ${name} și mesajul câștigător. Ajustează după rezultatele reale.`,
        firstActions: [
          { id: "c1a", text: `Pregătește o reclamă cu ${name} și prețul vizibil`, done: false },
          { id: "c1b", text: `Testează publicul: ${audience}`, done: false },
          { id: "c1c", text: "Buget zilnic orientativ", done: false },
        ],
      },
      {
        id: "c2",
        channel: "TikTok Ads",
        platform: "tiktok",
        type: "paid",
        budget: 150,
        why: "Arată produsul în utilizare într-un video scurt. Compară rezultatele cu cele din Instagram.",
        firstActions: [
          { id: "c2a", text: `Filmează ${name} după scenariul de 15 secunde`, done: false },
          {
            id: "c2b",
            text: "Publică întâi varianta organică și urmărește reacțiile",
            done: false,
          },
        ],
      },
      {
        id: "c3",
        channel: "Instagram organic",
        platform: "instagram",
        type: "organic",
        budget: 0,
        why: "Folosește fotografiile pe care le ai pentru a explica produsul fără buget de reclamă.",
        firstActions: [
          {
            id: "c3a",
            text: `Publică trei fotografii cu ${name}, detaliile și utilizarea lui`,
            done: false,
          },
          { id: "c3b", text: "Adaugă linkul real al produsului în profil", done: false },
        ],
      },
      {
        id: "c4",
        channel: "Email către clienți",
        platform: "email",
        type: "organic",
        budget: 100,
        why: "Rezervă un cost orientativ pentru instrumentul de email. Trimite doar către persoanele înscrise la lista magazinului.",
        firstActions: [
          {
            id: "c4a",
            text: `Pregătește un email despre ${name} pentru lista de abonați`,
            done: false,
          },
        ],
      },
    ],
    copy: {
      instagram: {
        caption: `${mainMessage}\n\n${product.shortDescription}\n\n${strengths.map((value) => `· ${value}`).join("\n")}\n\n${price} · ${action.toLowerCase()}, prin linkul din profil.`,
        hashtags: [`#${hashtag || "produsulmeu"}`, "#afacerilocale", "#descoperaproduse"],
      },
      tiktok: {
        hook: `Ai descoperit ${name}?`,
        beats: [
          {
            from: 0,
            to: 3,
            visual: `Prim-plan cu ${name} și prețul afișat`,
            voice: `${mainMessage} ${price}.`,
          },
          {
            from: 3,
            to: 7,
            visual: "Arată detaliile produsului, în lumină naturală",
            voice: benefit,
          },
          {
            from: 7,
            to: 11,
            visual: "Demonstrează o utilizare reală a produsului",
            voice: strengths[1] || `Vezi detaliile despre ${name}.`,
          },
          {
            from: 11,
            to: 15,
            visual: `Produsul și butonul „${action}”`,
            voice: `${price}. ${action}, prin linkul din profil.`,
          },
        ],
      },
      meta: {
        headline: mainMessage,
        primaryText: `${product.shortDescription} ${benefit}. ${price}. Vezi disponibilitatea și condițiile în magazin.`,
        cta: action,
      },
      email: {
        subjects: [
          `${name}: detaliile care merită descoperite`,
          `${benefit} — descoperă ${name}`,
          `${name}, pe scurt: ${price}`,
        ],
      },
    },
  };
}

export const DEMO_CAMPAIGN_ID = "demo-lumanare";

export const seedCampaigns = (): Campaign[] => {
  const now = Date.now();
  const day = 86400000;
  return [
    buildCampaign(
      DEMO_CAMPAIGN_ID,
      {
        name: "Lumânare River & Pine",
        category: "Decor casă",
        price: 89,
        currency: "RON",
        shortDescription:
          "Lumânare din ceară de soia, turnată manual, cu parfum de pin și eucalipt. 45 de ore de ardere.",
        strengths: ["Ceară de soia", "Turnată manual", "45 h ardere", "Fitil din bumbac"],
        audience: "Femei 25–45 care iubesc decorul cozy",
        country: "România",
        photoUrl: candle,
      },
      { isDemo: true, createdAt: new Date(now - 2 * day).toISOString() },
    ),
    buildCampaign(
      "cana-terra",
      {
        name: "Cana Terra",
        category: "Ceramică",
        price: 119,
        currency: "RON",
        shortDescription: "Cană din ceramică lucrată manual, glazură crem pe teracotă, 350 ml.",
        strengths: ["Lucrată manual", "Fiecare piesă e unică", "Sigură la mașina de vase"],
        audience: "Iubitori de cafea, 25–45",
        country: "România",
        photoUrl: mug,
      },
      {
        createdAt: new Date(now - 18 * day).toISOString(),
        status: "launched",
        marketplaces: ["emag", "instagram_shop"],
        budget: 800,
        tone: "premium",
        health: 68,
        keyMessage: "Cafeaua de dimineață merită o cană făcută de mână.",
      },
    ),
    buildCampaign(
      "sapun-lavanda",
      {
        name: "Săpun natural Lavandă",
        category: "Cosmetice",
        price: 29,
        currency: "RON",
        shortDescription: "Săpun presat la rece cu ulei de măsline și lavandă din Dobrogea.",
        strengths: ["Presat la rece", "Fără parfum sintetic"],
        audience: "Mame tinere, 28–40",
        country: "România",
      },
      {
        createdAt: new Date(now - 40 * day).toISOString(),
        status: "launched",
        marketplaces: ["trendyol", "facebook_marketplace"],
        budget: 300,
        tone: "playful",
        health: 91,
        keyMessage: "Lavandă din Dobrogea, într-un săpun făcut cu grijă.",
      },
    ),
  ];
};

export const seedNotifications = (): Notification[] => [
  {
    id: "n1",
    title: "Cum a mers Cana Terra?",
    body: "Au trecut 18 zile. Adaugă rezultatele și primești pașii următori.",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    read: false,
    href: "/app/campaigns/cana-terra/results",
  },
  {
    id: "n2",
    title: "Campania demo e gata",
    body: "Uită-te la Lumânarea River & Pine ca să vezi ce primești.",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    read: false,
    href: `/app/campaigns/${DEMO_CAMPAIGN_ID}`,
  },
  {
    id: "n3",
    title: "Streak de 3 săptămâni 🔥",
    body: "Ai bifat cel puțin o acțiune în fiecare săptămână.",
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    read: true,
  },
];
