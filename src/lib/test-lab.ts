export const TEST_LAB_STAGES = [
  ["pre_freeze", "Pre-freeze"],
  ["lines_frozen", "Lines frozen"],
  ["thursday_live", "Thursday live"],
  ["thursday_final", "Thursday final"],
  ["sunday_early", "Sunday early live"],
  ["sunday_late", "Sunday late live"],
  ["sunday_complete", "Sunday mostly complete"],
  ["week_final", "Week final"],
] as const;

export type TestLabStage = (typeof TEST_LAB_STAGES)[number][0];

export function testLabEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_TEST_LAB === "true"
  );
}
