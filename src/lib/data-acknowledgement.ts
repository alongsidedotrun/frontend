export const DATA_ACKNOWLEDGED_KEY = "alongside:data-acknowledged";
export const DATA_ACKNOWLEDGED_AT_KEY = "alongside:data-acknowledged-at";

export function loadDataAcknowledgement() {
  return localStorage.getItem(DATA_ACKNOWLEDGED_KEY) === "true";
}

export function loadDataAcknowledgementTime() {
  return localStorage.getItem(DATA_ACKNOWLEDGED_AT_KEY);
}

export function saveDataAcknowledgement() {
  const acknowledgedAt = new Date().toISOString();
  localStorage.setItem(DATA_ACKNOWLEDGED_KEY, "true");
  localStorage.setItem(DATA_ACKNOWLEDGED_AT_KEY, acknowledgedAt);
  return acknowledgedAt;
}

export function clearDataAcknowledgement() {
  localStorage.removeItem(DATA_ACKNOWLEDGED_KEY);
  localStorage.removeItem(DATA_ACKNOWLEDGED_AT_KEY);
}
