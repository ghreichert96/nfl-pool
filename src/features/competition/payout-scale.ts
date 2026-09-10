export type PayoutScaleRow = { rank: number; amount: number };

export function payoutMaximumRange(entryCount: number) {
  if (!Number.isInteger(entryCount) || entryCount < 2)
    throw new Error("At least two entrants are required.");
  const intervals =
    entryCount % 2 === 0 ? entryCount / 2 - 1 : Math.floor(entryCount / 2);
  return { min: intervals * 25, max: intervals * 50 };
}

export function generatePayoutScale(
  entryCount: number,
  maximum: number,
): PayoutScaleRow[] {
  const range = payoutMaximumRange(entryCount);
  if (
    !Number.isInteger(maximum) ||
    maximum % 25 !== 0 ||
    maximum < range.min ||
    maximum > range.max
  )
    throw new Error(
      `Maximum must be a $25 increment from $${range.min} to $${range.max}.`,
    );

  const intervals =
    entryCount % 2 === 0 ? entryCount / 2 - 1 : Math.floor(entryCount / 2);
  const fiftyDollarSteps = (maximum - intervals * 25) / 25;
  const positive = [maximum];
  for (let index = 0; index < intervals; index += 1) {
    const step = index < fiftyDollarSteps ? 50 : 25;
    positive.push(positive.at(-1)! - step);
  }
  const zeros = entryCount % 2 === 0 ? [0, 0] : [0];
  const amounts = [
    ...positive.slice(0, -1),
    ...zeros,
    ...positive
      .slice(0, -1)
      .reverse()
      .map((amount) => -amount),
  ];
  return amounts.map((amount, index) => ({ rank: index + 1, amount }));
}
