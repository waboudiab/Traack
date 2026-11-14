export async function classifyAi(text) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Classify one message sent to a local shop. Reply JSON {"label":"new_quote"|"existing"|"ignore","note":"short phrase"}. new_quote = a new estimate or job request. existing = a customer updating an open job. ignore = newsletter, receipt, spam, or automation. If unsure, use new_quote.',
          },
          { role: "user", content: String(text || "").slice(0, 2000) },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("ai classify", data.error?.message || res.status);
      return null;
    }
    const raw = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(raw);
    if (!["new_quote", "existing", "ignore"].includes(parsed.label)) return null;
    return parsed;
  } catch (error) {
    console.error("ai classify", error);
    return null;
  }
}
