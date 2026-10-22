// PostgREST caps each response. Season history must never be scored from a
// truncated page. Callers supply a fresh query with a stable, unique ordering.
export async function allRows<T>(
  query: () => {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{
      data: T[] | null;
      error: unknown;
    }>;
  },
): Promise<{ data: T[] }> {
  const pageSize = 500;
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query().range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error("Competition data is unavailable");
    rows.push(...data);
    if (data.length < pageSize) return { data: rows };
  }
}
