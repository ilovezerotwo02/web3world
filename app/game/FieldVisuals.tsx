import { FIELD_STAGE_LABELS, type FieldVisualStage } from "./progress";
import type { CSSProperties, ReactNode } from "react";
import {
  fieldAssetForStage,
  ledgerStarCropAssetForStage,
  monadCropAssetForStage,
  type LedgerStarCropStage,
} from "./field-assets";
import { courseGridSlots } from "./course-plots";
import type { GreenhouseStage } from "./security/types";

export type SeedKind = "ledger-star" | "parallel-wisteria" | "contract-scroll";

type SeedGlyphProps = {
  kind: SeedKind;
  compact?: boolean;
};

const SEED_NAMES: Record<SeedKind, string> = {
  "ledger-star": "账本星种",
  "parallel-wisteria": "并行紫藤种",
  "contract-scroll": "合约卷轴种",
};

export function SeedGlyph({ kind, compact = false }: SeedGlyphProps) {
  const common = {
    className: `seed-glyph seed-${kind} ${compact ? "is-compact" : ""}`,
    viewBox: "0 0 64 64",
    role: "img",
    "aria-label": SEED_NAMES[kind],
    shapeRendering: "crispEdges" as const,
  };

  if (kind === "parallel-wisteria") {
    return (
      <svg {...common}>
        <path className="seed-shadow-shape" d="M14 31h6V19h8v-6h8v4h8v7h6v18h-6v7h-9v4H23v-5h-7v-7h-4V31z" />
        <path className="seed-body-shape" d="M16 29h6V19h8v-5h7v5h7v6h5v15h-6v7h-9v4H24v-5h-6v-7h-4V29z" />
        <path className="seed-highlight-shape" d="M24 20h6v-3h6v4h-5v4h-7z" />
        <path className="seed-mark-shape" d="M24 28h4v15h-4zm12-4h4v17h-4z" />
      </svg>
    );
  }

  if (kind === "contract-scroll") {
    return (
      <svg {...common}>
        <path className="seed-shadow-shape" d="M18 11h23v5h7v10h-5v22h-6v7H24v-4h-7v-9h5V22h-6v-7h2z" />
        <path className="seed-body-shape" d="M20 12h19v5h7v8h-6v22h-5v6H25v-5h-6v-6h5V21h-6v-5h2z" />
        <path className="seed-highlight-shape" d="M23 15h14v4H27v18h-4z" />
        <path className="seed-mark-shape" d="M29 25h8v4h-5v4h5v4h-9v-4h4v-4h-3z" />
        <path className="seed-cap-shape" d="M20 11h19v5H20zm4 37h12v6H24z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path className="seed-shadow-shape" d="M29 7h8v7h7v8h6v14h-5v10h-8v9H25v-5h-8v-9h-5V28h5V19h6v-7h6z" />
      <path className="seed-body-shape" d="M30 8h6v7h7v8h5v12h-5v10h-7v8H26v-5h-7v-8h-5V29h5V20h6v-7h5z" />
      <path className="seed-highlight-shape" d="M26 16h7v4h-5v6h-5v-6h3z" />
      <path className="seed-seam-shape" d="M35 18h4v25h-4z" />
      <path className="seed-mark-shape" d="M29 29h5v-5h5v5h5v5h-5v5h-5v-5h-5z" />
    </svg>
  );
}

type FieldSceneProps = {
  stage: FieldVisualStage;
  monadStage?: FieldVisualStage;
  monadStarted?: boolean;
  contractStage?: FieldVisualStage;
  contractStarted?: boolean;
  securityStage?: GreenhouseStage;
  transitioning?: boolean;
  preview?: boolean;
};

function isCropStage(stage: FieldVisualStage): stage is LedgerStarCropStage {
  return stage === "sprout" || stage === "bloom" || stage === "fruit" || stage === "harvested";
}

function CropGrowthSite({
  stage,
  className = "",
  style,
  children,
}: {
  stage: LedgerStarCropStage;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <span className={`crop-growth-site crop-stage-${stage} ${className}`} style={style} aria-hidden="true">
      <span className="crop-ground-shadow" />
      {children}
      <span className="crop-root-contact" />
    </span>
  );
}

const FIELD_GRID_CORNERS = {
  top: { x: 837, y: 90 },
  right: { x: 1528, y: 444 },
  bottom: { x: 812, y: 855 },
  left: { x: 78, y: 444 },
} as const;

function fieldGridPoint(column: number, row: number) {
  const { top, right, bottom, left } = FIELD_GRID_CORNERS;
  return {
    x: (1 - column) * (1 - row) * top.x + column * (1 - row) * right.x + column * row * bottom.x + (1 - column) * row * left.x,
    y: (1 - column) * (1 - row) * top.y + column * (1 - row) * right.y + column * row * bottom.y + (1 - column) * row * left.y,
  };
}

function courseSlotGeometry(slot: number) {
  const index = slot - 1;
  const column = index % 3;
  const row = Math.floor(index / 3);
  const points = [
    fieldGridPoint(column / 3, row / 3),
    fieldGridPoint((column + 1) / 3, row / 3),
    fieldGridPoint((column + 1) / 3, (row + 1) / 3),
    fieldGridPoint(column / 3, (row + 1) / 3),
  ];
  const center = fieldGridPoint((column + 0.5) / 3, (row + 0.5) / 3);
  return {
    center,
    clipPath: `polygon(${points.map(({ x, y }) => `${x / 16}% ${y / 9}%`).join(", ")})`,
  };
}

function CourseGrid({
  stage,
  monadStage,
  monadStarted,
  contractStage,
  contractStarted,
  securityStage,
}: {
  stage: FieldVisualStage;
  monadStage: FieldVisualStage;
  monadStarted: boolean;
  contractStage: FieldVisualStage;
  contractStarted: boolean;
  securityStage: GreenhouseStage;
}) {
  const securityStatus = securityStage === "locked"
    ? "locked"
    : securityStage === "secured" || securityStage === "fully-powered"
      ? "harvested"
      : "active";
  const slots = courseGridSlots(
    stage === "harvested",
    monadStarted,
    monadStage === "harvested",
    contractStarted,
    contractStage === "harvested",
    securityStatus,
  );
  return (
    <svg className="course-grid-board" viewBox="0 0 1600 900" aria-hidden="true" shapeRendering="crispEdges">
      {slots.map(({ slot, course, status }, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const points = [
          fieldGridPoint(column / 3, row / 3),
          fieldGridPoint((column + 1) / 3, row / 3),
          fieldGridPoint((column + 1) / 3, (row + 1) / 3),
          fieldGridPoint(column / 3, (row + 1) / 3),
        ];
        const center = fieldGridPoint((column + 0.5) / 3, (row + 0.5) / 3);
        return (
          <g className={`course-grid-slot is-${status}`} data-course-slot={slot} key={slot}>
            <polygon points={points.map(({ x, y }) => `${x},${y}`).join(" ")} />
            <text className="course-grid-number" x={center.x} y={center.y - (course ? 10 : 0)}>{status === "harvested" ? "✓" : slot}</text>
            {course && <text className="course-grid-course" x={center.x} y={center.y + 28}>{course.title}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function FieldScene({
  stage,
  monadStage = "wild",
  monadStarted = false,
  contractStage = "wild",
  contractStarted = false,
  securityStage = "locked",
  transitioning = false,
  preview = false,
}: FieldSceneProps) {
  const web3Plot = courseSlotGeometry(1);
  const monadPlot = courseSlotGeometry(2);
  const contractPlot = courseSlotGeometry(3);
  const seedCount = Number(stage !== "wild" && stage !== "tilled") +
    Number(monadStage !== "wild" && monadStage !== "tilled") +
    Number(contractStage !== "wild" && contractStage !== "tilled");
  return (
    <div
      className={`field-scene field-stage-${stage} monad-field-stage-${monadStage} contract-field-stage-${contractStage} ${transitioning ? "is-transitioning" : ""} ${preview ? "is-preview" : ""}`}
      data-field-stage={stage}
      data-monad-field-stage={monadStage}
      data-contract-field-stage={contractStage}
      data-security-course-stage={securityStage}
      data-course-plot="web3"
      data-course-plots="web3,monad,contract,security"
      data-course-grid-slots="9"
      data-seed-count={seedCount}
    >
      <span
        className="field-stage-art field-stage-base"
        style={{ backgroundImage: `url("${fieldAssetForStage("wild")}")` }}
        aria-hidden="true"
      />
      {stage !== "wild" && (
        <span className="course-plot-soil is-web3" style={{ clipPath: web3Plot.clipPath }}>
          <span
            className="field-stage-art field-stage-overlay"
            style={{ backgroundImage: `url("${fieldAssetForStage("tilled")}")` }}
            aria-hidden="true"
          />
        </span>
      )}
      {stage === "seeded" && (
        <span className="field-single-seed"><SeedGlyph kind="ledger-star" compact /></span>
      )}
      {isCropStage(stage) && (
        <CropGrowthSite stage={stage} className="is-web3-crop">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`course-crop-art crop-${stage}`}
            src={ledgerStarCropAssetForStage(stage)}
            alt=""
            draggable={false}
          />
        </CropGrowthSite>
      )}
      {monadStage !== "wild" && (
        <span className="course-plot-soil is-monad" style={{ clipPath: monadPlot.clipPath }}>
          <span
            className="field-stage-art field-stage-overlay"
            style={{ backgroundImage: `url("${fieldAssetForStage("tilled")}")` }}
            aria-hidden="true"
          />
        </span>
      )}
      {monadStage === "seeded" && (
        <span
          className="field-single-seed monad-single-seed"
          style={{ left: `${monadPlot.center.x / 16}%`, top: `${monadPlot.center.y / 9}%` }}
        >
          <SeedGlyph kind="parallel-wisteria" compact />
        </span>
      )}
      {isCropStage(monadStage) && (
        <CropGrowthSite
          stage={monadStage}
          className="is-monad-crop"
          style={{ left: `${monadPlot.center.x / 16}%`, top: `${monadPlot.center.y / 9}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`monad-crop-art crop-${monadStage}`}
            src={monadCropAssetForStage(monadStage)}
            alt=""
            draggable={false}
          />
        </CropGrowthSite>
      )}
      {contractStage !== "wild" && (
        <span className="course-plot-soil is-contract" style={{ clipPath: contractPlot.clipPath }}>
          <span
            className="field-stage-art field-stage-overlay"
            style={{ backgroundImage: `url("${fieldAssetForStage("tilled")}")` }}
            aria-hidden="true"
          />
        </span>
      )}
      {contractStage === "seeded" && (
        <span
          className="field-single-seed contract-single-seed"
          style={{ left: `${contractPlot.center.x / 16}%`, top: `${contractPlot.center.y / 9}%` }}
        >
          <SeedGlyph kind="contract-scroll" compact />
        </span>
      )}
      {isCropStage(contractStage) && (
        <CropGrowthSite
          stage={contractStage}
          className="is-contract-crop"
          style={{ left: `${contractPlot.center.x / 16}%`, top: `${contractPlot.center.y / 9}%` }}
        >
          <span className={`contract-crop-art crop-${contractStage}`} />
        </CropGrowthSite>
      )}
      <CourseGrid
        stage={stage}
        monadStage={monadStage}
        monadStarted={monadStarted}
        contractStage={contractStage}
        contractStarted={contractStarted}
        securityStage={securityStage}
      />
      {transitioning && (
        <span className={`field-transition-fx field-transition-${stage}`}>
          {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
        </span>
      )}
    </div>
  );
}

export function CourseFieldLayer({
  stage,
  monadStage,
  monadStarted,
  contractStage,
  contractStarted,
  securityStage,
  transitioning,
}: {
  stage: FieldVisualStage;
  monadStage: FieldVisualStage;
  monadStarted: boolean;
  contractStage: FieldVisualStage;
  contractStarted: boolean;
  securityStage: GreenhouseStage;
  transitioning: boolean;
}) {
  return (
    <div className="course-field-layer" aria-hidden="true">
      <FieldScene
        stage={stage}
        monadStage={monadStage}
        monadStarted={monadStarted}
        contractStage={contractStage}
        contractStarted={contractStarted}
        securityStage={securityStage}
        transitioning={transitioning}
      />
    </div>
  );
}

export function FieldStagePreview({ stage }: { stage: FieldVisualStage }) {
  return (
    <div className="field-stage-preview" role="img" aria-label={`九格课程农田，第 1 格 Web3 通识状态：${FIELD_STAGE_LABELS[stage]}，最多一颗账本星种`}>
      <FieldScene stage={stage} preview />
      <span className="field-preview-label">{FIELD_STAGE_LABELS[stage]}</span>
    </div>
  );
}
