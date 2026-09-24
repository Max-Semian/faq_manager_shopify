import { jsonError, readJson, withSession } from "@/lib/api";
import { createFaq, listFaqs } from "@/lib/faq";
import { validateFaqInput } from "@/lib/validation";

export const GET = withSession(async (session) => {
  const items = await listFaqs(session);
  return Response.json({ items });
});

export const POST = withSession(async (session, request) => {
  const parsed = validateFaqInput(await readJson(request));
  if (!parsed.ok) return jsonError(422, "Please fix the highlighted fields", parsed.fieldErrors);

  const result = await createFaq(session, parsed.value);
  if (!result.ok) {
    return jsonError(422, result.formErrors[0] ?? "Please fix the highlighted fields", result.fieldErrors);
  }
  return Response.json({ item: result.item }, { status: 201 });
});
