import type { AssetSummary } from "@/lib/assets";

export interface EditorAsset extends Omit<AssetSummary, "createdAt"> {
  createdAt: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
}
