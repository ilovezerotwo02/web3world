// Re-export all progress types and utilities from the shared lib module.
// This ensures the frontend and backend use the same state machine logic.
export {
  progressReducer,
  initialProgress,
  calculateExp,
  growthStage,
  fieldVisualStage,
  isCompletedFarmProgress,
  isFarmProgress,
  readStoredProgress,
  FIELD_STAGE_ORDER,
  FIELD_STAGE_LABELS,
} from "../../lib/progress";

export type {
  FarmProgress,
  ProgressAction,
  VerificationMethod,
  GrowthStage,
  FieldVisualStage,
} from "../../lib/progress";
