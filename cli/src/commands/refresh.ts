import { clearCache } from "@sgm/core";

export async function refresh(): Promise<void> {
  await clearCache();
  console.log("Cache cleared. Next command will re-fetch from Sleeper.");
}
