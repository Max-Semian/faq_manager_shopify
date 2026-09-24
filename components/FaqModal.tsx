"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent } from "react";

import { ApiError, faqApi } from "@/lib/client-api";
import type { FaqItem } from "@/lib/faq";
import {
  ANSWER_MAX,
  CATEGORY_MAX,
  QUESTION_MAX,
  validateFaqInput,
  type FaqInput,
  type FieldErrors,
} from "@/lib/validation";

const MODAL_ID = "faq-modal";
const EMPTY: FaqInput = { question: "", answer: "", category: "", active: true };

export interface FaqModalHandle {
  open: (item?: FaqItem) => void;
}

interface Props {
  onSaved: (item: FaqItem, mode: "create" | "update") => void;
  onDeleted: (id: string) => void;
}

export const FaqModal = forwardRef<FaqModalHandle, Props>(function FaqModal(
  { onSaved, onDeleted },
  ref,
) {
  const modalRef = useRef<HTMLElementTagNameMap["s-modal"]>(null);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [values, setValues] = useState<FaqInput>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useImperativeHandle(ref, () => ({
    open(item) {
      setEditing(item ?? null);
      setValues(
        item
          ? { question: item.question, answer: item.answer, category: item.category ?? "", active: item.active }
          : EMPTY,
      );
      setFieldErrors({});
      setFormError(null);
      setSaving(false);
      setDeleting(false);
      modalRef.current?.showOverlay();
    },
  }));

  const set = <K extends keyof FaqInput>(key: K, value: FaqInput[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function handleSubmit(event?: FormEvent) {
    event?.preventDefault();
    if (saving || deleting) return;

    const parsed = validateFaqInput(values);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const item = editing
        ? await faqApi.update(editing.id, parsed.value)
        : await faqApi.create(parsed.value);
      onSaved(item, editing ? "update" : "create");
      modalRef.current?.hideOverlay();
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        console.error("[faq] save failed", error);
        setFormError(error instanceof Error ? error.message : "Unexpected error. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing || saving || deleting) return;
    if (!window.confirm(`Delete “${editing.question}”? This cannot be undone.`)) return;

    setDeleting(true);
    setFormError(null);
    try {
      await faqApi.delete(editing.id);
      onDeleted(editing.id);
      modalRef.current?.hideOverlay();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        console.error("[faq] delete failed", error);
        setFormError(error instanceof Error ? error.message : "Could not delete FAQ entry.");
      }
    } finally {
      setDeleting(false);
    }
  }

  const busy = saving || deleting;

  return (
    <s-modal ref={modalRef} id={MODAL_ID} heading={editing ? "Edit FAQ" : "Add FAQ"}>
      <form onSubmit={handleSubmit} noValidate>
        <s-stack gap="base">
          {formError && <s-banner tone="critical">{formError}</s-banner>}
          <s-text-field
            label="Question"
            required
            maxLength={QUESTION_MAX}
            value={values.question}
            error={fieldErrors.question}
            onInput={(e) => set("question", e.currentTarget.value)}
          />
          <s-text-area
            label="Answer"
            required
            rows={6}
            maxLength={ANSWER_MAX}
            value={values.answer}
            error={fieldErrors.answer}
            onInput={(e) => set("answer", e.currentTarget.value)}
          />
          <s-text-field
            label="Category"
            details="Optional"
            maxLength={CATEGORY_MAX}
            value={values.category}
            error={fieldErrors.category}
            onInput={(e) => set("category", e.currentTarget.value)}
          />
          <s-checkbox
            label="Active"
            checked={values.active}
            onChange={(e) => set("active", e.currentTarget.checked)}
          />
        </s-stack>
      </form>

      <s-button
        slot="primary-action"
        variant="primary"
        loading={saving}
        disabled={deleting}
        onClick={() => void handleSubmit()}
      >
        {editing ? "Save" : "Create"}
      </s-button>
      {editing && (
        <s-button
          slot="secondary-actions"
          tone="critical"
          loading={deleting}
          disabled={busy && !deleting}
          onClick={() => void handleDelete()}
        >
          Delete
        </s-button>
      )}
      <s-button slot="secondary-actions" disabled={busy} commandFor={MODAL_ID} command="--hide">
        Cancel
      </s-button>
    </s-modal>
  );
});
