import { getSparkSupabase } from "@/lib/spark-db";

export type SparkSettings = {
  autoAcceptEnabled: boolean;
  autoAcceptDomains: string[];
};

const DEFAULT_SETTINGS: SparkSettings = {
  autoAcceptEnabled: false,
  autoAcceptDomains: [],
};

function asDomains(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((d): d is string => typeof d === "string")
    : [];
}

// Reads the singleton settings row. Defaults to OFF if the table/row isn't there
// yet (e.g. the migration hasn't been applied) — never throws, never bypasses.
export async function getSparkSettings(): Promise<SparkSettings> {
  try {
    const { data, error } = await getSparkSupabase()
      .from("SparkSetting")
      .select("autoAcceptEnabled,autoAcceptDomains")
      .eq("id", "singleton")
      .maybeSingle();
    if (error || !data) return DEFAULT_SETTINGS;
    return {
      autoAcceptEnabled: Boolean(data.autoAcceptEnabled),
      autoAcceptDomains: asDomains(data.autoAcceptDomains),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function updateSparkSettings(
  values: SparkSettings,
  updatedByEmail: string | null
): Promise<SparkSettings> {
  const { data, error } = await getSparkSupabase()
    .from("SparkSetting")
    .upsert({
      id: "singleton",
      autoAcceptEnabled: values.autoAcceptEnabled,
      autoAcceptDomains: values.autoAcceptDomains,
      updatedByEmail,
      updatedAt: new Date().toISOString(),
    })
    .select("autoAcceptEnabled,autoAcceptDomains")
    .single();
  if (error) {
    throw new Error(error.message || "Unable to update Spark settings.");
  }
  return {
    autoAcceptEnabled: Boolean(data.autoAcceptEnabled),
    autoAcceptDomains: asDomains(data.autoAcceptDomains),
  };
}

// True if the email's domain matches an allowlisted domain (incl. subdomains,
// e.g. "tcwglobal.com" matches alice@hr.tcwglobal.com and "*.tcwglobal.com").
export function emailMatchesAutoAcceptDomain(
  email: string,
  domains: string[]
): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();
  if (!domain) return false;
  return domains.some((raw) => {
    const d = raw
      .toLowerCase()
      .trim()
      .replace(/^@/, "")
      .replace(/^\*\./, "");
    return Boolean(d) && (domain === d || domain.endsWith(`.${d}`));
  });
}
