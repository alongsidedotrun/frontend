// The timezone setting (Settings, and the sign-up step) and the grouped list its dropdown shows.
// Moved out of settings-overlay.tsx so the dropdown can be reused (components/locale-dropdowns.tsx).

// localStorage, not a backend setting -- same reasoning as theme/transparency
// above (TRANSPARENCY_STORAGE_KEY's own comment): a per-device display
// preference, not something a Hosted/Enterprise account needs synced across
// machines yet.
export const TIMEZONE_STORAGE_KEY = "alongside_timezone";

// Real detection -- Intl.DateTimeFormat's own resolvedOptions, the same
// mechanism every other app on the machine uses to know its own timezone.
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function loadTimezone(): string {
  return localStorage.getItem(TIMEZONE_STORAGE_KEY) ?? detectTimezone();
}

export type TimezoneEntry = { value: string; label: string };
// subregions is only ever set for "America" today (below) -- every other
// region renders as one flat, collapsible list, per explicit request (only
// America was called out as "enormous").
export type TimezoneGroup = { region: string; zones: TimezoneEntry[]; subregions?: { name: string; zones: TimezoneEntry[] }[] };

// The tz database itself has no North/Central/South American distinction --
// confirmed directly, "America/*" is one flat 143-zone list with no metadata
// beyond the zone name -- so this is a real, hand-built classification by
// each zone's own actual country, not something Intl provides. Grouped by
// country/territory below (comments mark each block), not by zone name
// pattern-matching, since neither the country nor the continent is reliably
// derivable from the zone string alone (e.g. "America/Belize" -> Belize is
// obvious, but "America/Nassau" -> Bahamas isn't spelled out anywhere in the
// string). Caribbean nations classed under North America (the common 3-way
// convention when Caribbean isn't its own bucket, which is what was asked
// for here), not their own fourth group.
const CENTRAL_AMERICA_ZONES = new Set([
  "America/Belize",
  "America/Costa_Rica",
  "America/El_Salvador",
  "America/Guatemala",
  "America/Managua",
  "America/Panama",
  "America/Tegucigalpa",
]);
const SOUTH_AMERICA_ZONES = new Set([
  // Argentina
  "America/Argentina/La_Rioja",
  "America/Argentina/Rio_Gallegos",
  "America/Argentina/Salta",
  "America/Argentina/San_Juan",
  "America/Argentina/San_Luis",
  "America/Argentina/Tucuman",
  "America/Argentina/Ushuaia",
  "America/Buenos_Aires",
  "America/Catamarca",
  "America/Cordoba",
  "America/Jujuy",
  "America/Mendoza",
  // Bolivia
  "America/La_Paz",
  // Brazil
  "America/Araguaina",
  "America/Bahia",
  "America/Belem",
  "America/Boa_Vista",
  "America/Campo_Grande",
  "America/Cuiaba",
  "America/Eirunepe",
  "America/Fortaleza",
  "America/Maceio",
  "America/Manaus",
  "America/Noronha",
  "America/Porto_Velho",
  "America/Recife",
  "America/Rio_Branco",
  "America/Santarem",
  "America/Sao_Paulo",
  // Chile
  "America/Santiago",
  "America/Punta_Arenas",
  // Colombia, Ecuador, French Guiana, Guyana, Paraguay, Peru, Suriname, Uruguay, Venezuela
  "America/Bogota",
  "America/Guayaquil",
  "America/Cayenne",
  "America/Guyana",
  "America/Asuncion",
  "America/Lima",
  "America/Paramaribo",
  "America/Montevideo",
  "America/Caracas",
]);
function americaSubregion(zone: string): "North America" | "Central America" | "South America" {
  if (CENTRAL_AMERICA_ZONES.has(zone)) return "Central America";
  if (SOUTH_AMERICA_ZONES.has(zone)) return "South America";
  return "North America";
}

// Real IANA zone list, not a hand-picked subset -- Intl.supportedValuesOf
// (Baseline across every browser this app targets) returns every zone the
// runtime itself actually supports, the same list any of its own
// Intl.DateTimeFormat calls could be given -- confirmed directly, this is
// genuinely 400+ real zones (the tz database tracks every region with its own
// distinct DST history, not one entry per country), not a bug to trim down.
// Grouped by the zone's own region prefix ("Europe/London" -> "Europe"),
// per explicit request, rather than one flat 400-row list -- Etc/* and other
// no-slash zones group under "Other". Region groups and the zones within each
// are both alphabetical; each zone's own label drops the repeated region
// prefix and swaps underscores for spaces ("Los_Angeles" -> "Los Angeles"),
// since the group header already says "America". America itself further
// splits into North/Central/South (americaSubregion, above) -- per explicit
// follow-up ("america has all americas which makes enormous").
export function listTimezoneGroups(): TimezoneGroup[] {
  let zones: string[];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [detectTimezone()];
  }
  const byRegion = new Map<string, TimezoneEntry[]>();
  for (const zone of zones) {
    const slash = zone.indexOf("/");
    const region = slash === -1 ? "Other" : zone.slice(0, slash);
    // Real bug, confirmed directly ("Argentina / La Rioja" leaking through):
    // slicing after the *first* slash only strips the region prefix
    // ("America/"), but a handful of real zones have a second path segment
    // (America/Argentina/La_Rioja, America/Indiana/Knox, America/Kentucky/
    // Monticello, America/North_Dakota/Beulah) -- the group header (region,
    // and for America, its own North/Central/South subregion) already gives
    // that country/state context, so the label itself only needs the final
    // city component, after the *last* slash.
    const lastSlash = zone.lastIndexOf("/");
    const label = (lastSlash === -1 ? zone : zone.slice(lastSlash + 1)).replaceAll("_", " ");
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region)!.push({ value: zone, label });
  }
  return [...byRegion.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, zonesInRegion]) => {
      const sortedZones = zonesInRegion.sort((a, b) => a.label.localeCompare(b.label));
      if (region !== "America") return { region, zones: sortedZones };
      const bySubregion = new Map<string, TimezoneEntry[]>([
        ["North America", []],
        ["Central America", []],
        ["South America", []],
      ]);
      for (const zone of sortedZones) bySubregion.get(americaSubregion(zone.value))!.push(zone);
      return {
        region,
        zones: sortedZones,
        subregions: [...bySubregion.entries()].map(([name, zonesInSub]) => ({ name, zones: zonesInSub })),
      };
    });
}


export function saveTimezone(value: string) {
  try {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, value);
  } catch {
    // storage blocked: kept for this session only
  }
}
