import type { AssetSummary } from "@/lib/assets";
import type { AssetUse } from "@/lib/templates";

export interface EditorAsset extends Omit<AssetSummary, "createdAt"> {
  createdAt: string;
  /** Saved templates pointing at this file. Empty for a fresh upload. */
  usedBy: AssetUse[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
}
