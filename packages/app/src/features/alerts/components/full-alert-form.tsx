import { useId, type SyntheticEvent } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";

import {
  EXPIRY_OPTIONS,
  REPEAT_OPTIONS,
  type ForSeconds,
  type ImpactMinimum,
  type LeadMinutes,
  type Operator,
  type SheetFormValues,
  type SheetKind,
} from "../lib/rule-build";
import { parseRule } from "../lib/rule-parser";

import { PreviewLine } from "./preview-line";

const KIND_OPTIONS: readonly SegmentedOption<SheetKind>[] = [
  { value: "price", label: "Price" },
  { value: "calendar", label: "Event" },
];

const LEAD_OPTIONS: readonly SegmentedOption<LeadMinutes>[] = [
  { value: "5", label: <span className="tabular-nums">5 min</span> },
  { value: "15", label: <span className="tabular-nums">15 min</span> },
  { value: "30", label: <span className="tabular-nums">30 min</span> },
];

const IMPACT_OPTIONS: readonly SegmentedOption<ImpactMinimum>[] = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
];

const FOR_OPTIONS: readonly SegmentedOption<ForSeconds>[] = [
  { value: "0", label: "Instant" },
  { value: "60", label: "1 min" },
  { value: "300", label: "5 min" },
];

const PARSE_HINT = "Couldn't read that — use the fields below.";

interface SectionProps {
  values: SheetFormValues;
  onChange: (patch: Partial<SheetFormValues>) => void;
}

function PriceFields({ values, onChange }: SectionProps) {
  const sentenceId = useId();
  const hintId = useId();

  const applySentence = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = parseRule(values.sentence);
    if (draft === null || draft.kind !== "price") {
      onChange({ parseHint: PARSE_HINT });
      return;
    }
    onChange({
      symbol: draft.symbol,
      operator: draft.op === "gte" ? "above" : "below",
      value: String(draft.value),
      parseHint: null,
    });
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <form className="flex items-center gap-1.5" onSubmit={applySentence}>
          <Input
            id={sentenceId}
            value={values.sentence}
            autoComplete="off"
            spellCheck={false}
            placeholder="or type it: BTC above 100000"
            aria-describedby={values.parseHint === null ? undefined : hintId}
            className="min-w-0 flex-1"
            onChange={(event) => {
              onChange({ sentence: event.target.value, parseHint: null });
            }}
          />
          <Button type="submit" variant="secondary" className="h-control! shrink-0">
            Read sentence
          </Button>
        </form>
        {values.parseHint === null ? null : (
          <output id={hintId} className="block type-label text-muted-foreground">
            {values.parseHint}
          </output>
        )}
      </div>

      <fieldset
        aria-label="Alert condition"
        className="grid min-w-0 grid-cols-3 gap-4 border-0 p-0"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="type-label text-muted-foreground">Symbol</span>
          <Input
            aria-label="Symbol"
            value={values.symbol}
            autoComplete="off"
            spellCheck={false}
            placeholder="BTC"
            className="text-center uppercase tabular-nums"
            onChange={(event) => {
              onChange({ symbol: event.target.value, parseHint: null });
            }}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="type-label text-muted-foreground">Direction</span>
          <NativeSelect
            aria-label="Price direction"
            wrapperClassName="w-full max-w-none"
            value={values.operator}
            onChange={(event) => {
              const operator: Operator = event.target.value === "below" ? "below" : "above";
              onChange({ operator });
            }}
          >
            <NativeSelectOption value="above">above</NativeSelectOption>
            <NativeSelectOption value="below">below</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="type-label text-muted-foreground">Price</span>
          <Input
            aria-label="Price"
            inputMode="decimal"
            value={values.value}
            autoComplete="off"
            placeholder="100000"
            className="text-right tabular-nums"
            onChange={(event) => {
              onChange({ value: event.target.value, parseHint: null });
            }}
          />
        </div>
      </fieldset>
    </>
  );
}

function CalendarFields({ values, onChange }: SectionProps) {
  const currencyId = useId();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={currencyId}>Currency or region</Label>
        <Input
          id={currencyId}
          value={values.currency}
          autoComplete="off"
          spellCheck={false}
          placeholder="USD"
          className="text-center uppercase tabular-nums"
          onChange={(event) => {
            onChange({ currency: event.target.value });
          }}
        />
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="type-label text-muted-foreground">Lead time</span>
          <Segmented
            aria-label="Lead time"
            options={LEAD_OPTIONS}
            value={values.leadMinutes}
            sizing="fill"
            onValueChange={(leadMinutes) => {
              onChange({ leadMinutes });
            }}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="type-label text-muted-foreground">Minimum impact</span>
          <Segmented
            aria-label="Minimum impact"
            options={IMPACT_OPTIONS}
            value={values.impactMin}
            sizing="fill"
            onValueChange={(impactMin) => {
              onChange({ impactMin });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function RuleOptions({
  values,
  onChange,
  previewCount,
}: SectionProps & { previewCount: number | null | undefined }) {
  return (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="type-label text-muted-foreground">Repeat</span>
        <Segmented
          aria-label="Repeat"
          options={REPEAT_OPTIONS}
          value={values.repeat}
          sizing="fill"
          onValueChange={(repeat) => {
            onChange({ repeat });
          }}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="type-label text-muted-foreground">Expires</span>
        <Segmented
          aria-label="Expires"
          options={EXPIRY_OPTIONS}
          value={values.expiry}
          sizing="fill"
          onValueChange={(expiry) => {
            onChange({ expiry });
          }}
        />
      </div>

      {values.kind === "price" ? (
        <details className="group flex flex-col gap-4">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 type-label font-medium text-muted-foreground select-none">
            <ChevronDown
              aria-hidden="true"
              className="size-icon transition-transform duration-(--duration-fast) group-open:rotate-180"
            />
            Advanced
          </summary>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="type-label text-muted-foreground">Sustained for</span>
            <Segmented
              aria-label="Sustained for"
              options={FOR_OPTIONS}
              value={values.forSeconds}
              sizing="fill"
              onValueChange={(forSeconds) => {
                onChange({ forSeconds });
              }}
            />
          </div>
        </details>
      ) : null}

      {values.kind === "price" ? <PreviewLine count={previewCount} /> : null}
    </>
  );
}

interface FullAlertFormProps {
  values: SheetFormValues;
  onChange: (patch: Partial<SheetFormValues>) => void;
  previewCount: number | null | undefined;
}

export function FullAlertForm({ values, onChange, previewCount }: FullAlertFormProps) {
  return (
    <>
      <Segmented
        aria-label="Alert type"
        options={KIND_OPTIONS}
        value={values.kind}
        sizing="fill"
        onValueChange={(kind) => {
          onChange({ kind });
        }}
      />

      {values.kind === "price" ? (
        <PriceFields values={values} onChange={onChange} />
      ) : (
        <CalendarFields values={values} onChange={onChange} />
      )}

      <RuleOptions values={values} onChange={onChange} previewCount={previewCount} />
    </>
  );
}
