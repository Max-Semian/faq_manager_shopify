import { jsonError, readJson, withSession } from "@/lib/api";
import { deleteFaq, getFaq, metaobjectGid, updateFaq } from "@/lib/faq";
import { validateFaqInput } from "@/lib/validation";

interface Ctx {
  params: Promise<{ id: string }>;
}

async function faqIdFromParams(params: Promise<{ id: string }>) {
  return metaobjectGid((await params).id);
}

export const PATCH = withSession<Ctx>(async (session, request, { params }) => {
  const id = await faqIdFromParams(params);
  if (!id) return jsonError(400, "Invalid FAQ id");

  const parsed = validateFaqInput(await readJson(request));
  if (!parsed.ok) return jsonError(422, "Please fix the highlighted fields", parsed.fieldErrors);

  // Guard against using this endpoint to edit metaobjects of other types.
  if (!(await getFaq(session, id))) return jsonError(404, "FAQ entry not found");

  const result = await updateFaq(session, id, parsed.value);
  if (!result.ok) {
    return jsonError(422, result.formErrors[0] ?? "Please fix the highlighted fields", result.fieldErrors);
  }
  return Response.json({ item: result.item });
});

export const DELETE = withSession<Ctx>(async (session, _request, { params }) => {
  const id = await faqIdFromParams(params);
  if (!id) return jsonError(400, "Invalid FAQ id");

  if (!(await getFaq(session, id))) return jsonError(404, "FAQ entry not found");

  const result = await deleteFaq(session, id);
  if (!result.ok) {
    return jsonError(422, result.formErrors[0] ?? "Could not delete FAQ entry");
  }
  return Response.json({ ok: true });
});
