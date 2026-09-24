"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FaqModal, type FaqModalHandle } from "@/components/FaqModal";
import { faqApi, toast } from "@/lib/client-api";
import { FAQ_LIST_LIMIT, type FaqItem } from "@/lib/faq";
import { categoriesOf, EMPTY_FILTERS, filterFaqs, type ActiveFilter, type FaqFilters } from "@/lib/filter";

export default function FaqPage() {
  const modal = useRef<FaqModalHandle>(null);
  const [items, setItems] = useState<FaqItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FaqFilters>(EMPTY_FILTERS);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stale = false;
    faqApi
      .list()
      .then(
        (list) => !stale && setItems(list),
        (e: unknown) => {
          if (stale) return;
          console.error("[faq] load failed", e);
          setError(e instanceof Error ? e.message : "Failed to load FAQ entries.");
        },
      )
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [attempt]);

  function retry() {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  }

  const categories = useMemo(() => categoriesOf(items ?? []), [items]);
  const visible = useMemo(() => filterFaqs(items ?? [], filters), [items, filters]);
  const isFiltered = !!filters.search.trim() || !!filters.category || filters.active !== "all";

  function handleSaved(item: FaqItem, mode: "create" | "update") {
    setItems((prev) =>
      mode === "create" ? [item, ...(prev ?? [])] : (prev ?? []).map((i) => (i.id === item.id ? item : i)),
    );
    void toast(mode === "create" ? "FAQ created" : "FAQ saved");
  }

  function handleDeleted(id: string) {
    setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
    void toast("FAQ deleted");
  }

  const setFilter = <K extends keyof FaqFilters>(key: K, value: FaqFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  return (
    <s-page heading="FAQ Manager">
      <s-button slot="primary-action" variant="primary" onClick={() => modal.current?.open()}>
        Add FAQ
      </s-button>

      {error && (
        <s-banner tone="critical" heading="Could not load FAQ entries">
          {error}
          <s-button slot="secondary-actions" onClick={retry}>
            Retry
          </s-button>
        </s-banner>
      )}

      {!error && !loading && items?.length === 0 ? (
        <s-section>
          <s-stack gap="base" alignItems="center" padding="large">
            <s-heading>No FAQ entries yet</s-heading>
            <s-paragraph>Create your first question and answer for customers.</s-paragraph>
            <s-button variant="primary" onClick={() => modal.current?.open()}>
              Add FAQ
            </s-button>
          </s-stack>
        </s-section>
      ) : (
        !error && (
          <s-section padding="none">
            <s-table loading={loading}>
              <s-grid slot="filters" gridTemplateColumns="2fr 1fr 1fr" gap="small-200">
                <s-search-field
                  label="Search by question"
                  labelAccessibilityVisibility="exclusive"
                  placeholder="Search by question"
                  value={filters.search}
                  onInput={(e) => setFilter("search", e.currentTarget.value)}
                />
                <s-select
                  label="Category"
                  labelAccessibilityVisibility="exclusive"
                  value={filters.category}
                  onChange={(e) => setFilter("category", e.currentTarget.value)}
                >
                  <s-option value="">All categories</s-option>
                  {categories.map((c) => (
                    <s-option key={c} value={c}>
                      {c}
                    </s-option>
                  ))}
                </s-select>
                <s-select
                  label="Status"
                  labelAccessibilityVisibility="exclusive"
                  value={filters.active}
                  onChange={(e) => setFilter("active", e.currentTarget.value as ActiveFilter)}
                >
                  <s-option value="all">All statuses</s-option>
                  <s-option value="active">Active</s-option>
                  <s-option value="inactive">Inactive</s-option>
                </s-select>
              </s-grid>

              <s-table-header-row>
                <s-table-header listSlot="primary">Question</s-table-header>
                <s-table-header listSlot="secondary">Category</s-table-header>
                <s-table-header listSlot="inline">Status</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {visible.map((item) => (
                  <s-table-row key={item.id} clickDelegate={`edit-${item.handle}`}>
                    <s-table-cell>
                      <s-link id={`edit-${item.handle}`} onClick={() => modal.current?.open(item)}>
                        {item.question}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>{item.category ?? <s-text color="subdued">—</s-text>}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={item.active ? "success" : "neutral"}>
                        {item.active ? "Active" : "Inactive"}
                      </s-badge>
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>

            {!loading && isFiltered && visible.length === 0 && (
              <s-box padding="base">
                <s-stack gap="small" alignItems="center">
                  <s-text color="subdued">No FAQ entries match your filters.</s-text>
                  <s-button variant="tertiary" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Clear filters
                  </s-button>
                </s-stack>
              </s-box>
            )}
            {items && items.length >= FAQ_LIST_LIMIT && (
              <s-box padding="base">
                <s-text color="subdued">Showing the {FAQ_LIST_LIMIT} most recently updated entries.</s-text>
              </s-box>
            )}
          </s-section>
        )
      )}

      <FaqModal ref={modal} onSaved={handleSaved} onDeleted={handleDeleted} />
    </s-page>
  );
}
