"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function switchSubject(form) {
  const id = String(form.get("subject") || "");
  const jar = await cookies();
  if (id) jar.set("fs_subject", id, { httpOnly: true, sameSite: "lax", path: "/" }); else jar.delete("fs_subject");
  revalidatePath("/", "layout");
}
