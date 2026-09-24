import type { FaqItem } from "./faq";

export type ActiveFilter = "all" | "active" | "inactive";

export interface FaqFilters {
  search: string;
  category: string;
  active: ActiveFilter;
}

export const EMPTY_FILTERS: FaqFilters = { search: "", category: "", active: "all" };

export function filterFaqs(items: FaqItem[], { search, category, active }: FaqFilters): FaqItem[] {
  const needle = search.trim().toLowerCase();
  return items.filter(
    (item) =>
      (!needle || item.question.toLowerCase().includes(needle)) &&
      (!category || item.category === category) &&
      (active === "all" || item.active === (active === "active")),
  );
}

export function categoriesOf(items: FaqItem[]): string[] {
  const set = new Set(items.map((i) => i.category).filter((c): c is string => !!c));
  return [...set].sort((a, b) => a.localeCompare(b));
}
