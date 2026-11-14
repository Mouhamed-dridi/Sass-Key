import { CLIENT_TYPES, PRICING_MODELS, SAAS_LIST } from "./constants";

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Returns { value } on success or { error } with a message for the user. */
export function parseClientInput(body) {
  const b = body && typeof body === "object" ? body : {};
  const name = String(b.name ?? "").trim();
  const description = String(b.description ?? "").trim();
  const registered_at = String(b.registered_at ?? "").trim();

  if (!name) return { error: "Client name is required." };
  if (name.length > 120) return { error: "Client name is too long (max 120 characters)." };
  if (!CLIENT_TYPES.includes(b.type)) return { error: "Choose a valid client type." };
  if (!isValidDate(registered_at)) return { error: "Enter a valid registration date." };
  if (description.length > 1000) return { error: "Description is too long (max 1000 characters)." };
  if (!PRICING_MODELS.includes(b.pricing_model)) return { error: "Choose a valid pricing model." };
  if (!SAAS_LIST.includes(b.saas)) return { error: "Choose a valid SaaS." };

  return {
    value: {
      name,
      type: b.type,
      registered_at,
      description,
      pricing_model: b.pricing_model,
      saas: b.saas,
    },
  };
}
