export type MeasurementStatus = "measured" | "partial" | "unavailable";

export function getMeasurementStatus(
  firstMeasuredAt: Date | null,
  from: Date,
  to: Date
): MeasurementStatus {
  if (!firstMeasuredAt || to <= firstMeasuredAt) return "unavailable";
  if (from < firstMeasuredAt) return "partial";
  return "measured";
}

export function measuredValue(status: MeasurementStatus, value: number) {
  return status === "unavailable" ? null : value;
}
