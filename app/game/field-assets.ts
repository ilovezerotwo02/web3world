import type { FieldVisualStage } from "./progress";

export const FIELD_STAGE_ASSETS: Record<FieldVisualStage, string> = {
  wild: "/art/fields/course-field-wild-v4.png",
  tilled: "/art/fields/course-field-tilled-v4.png",
  seeded: "/art/fields/course-field-seeded-v4.png",
  sprout: "/art/fields/course-field-sprout-v4.png",
  bloom: "/art/fields/course-field-bloom-v4.png",
  fruit: "/art/fields/course-field-fruit-v4.png",
  harvested: "/art/fields/course-field-harvested-v4.png",
};

export const LEDGER_STAR_CROP_ASSETS = {
  sprout: "/art/crops/ledger-star-sprout-v3.png",
  bloom: "/art/crops/ledger-star-bloom-v3.png",
  fruit: "/art/crops/ledger-star-fruit-v3.png",
  harvested: "/art/crops/ledger-star-harvested-field-v2.png",
} as const;

export type LedgerStarCropStage = keyof typeof LEDGER_STAR_CROP_ASSETS;

export const MONAD_CROP_ASSETS: Record<LedgerStarCropStage, string> = {
  sprout: "/art/crops/parallel-crystal-berry-sprout-v2.png",
  bloom: "/art/crops/parallel-crystal-berry-bloom-v2.png",
  fruit: "/art/crops/parallel-crystal-berry-fruit-v2.png",
  harvested: "/art/crops/parallel-crystal-berry-harvested-v2.png",
};

export function fieldAssetForStage(stage: FieldVisualStage): string {
  return FIELD_STAGE_ASSETS[stage];
}

export function ledgerStarCropAssetForStage(stage: LedgerStarCropStage): string {
  return LEDGER_STAR_CROP_ASSETS[stage];
}

export function monadCropAssetForStage(stage: LedgerStarCropStage): string {
  return MONAD_CROP_ASSETS[stage];
}
