import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabaseAdmin, DISH_PHOTOS_BUCKET } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { fileType } = await req.json();
  if (!fileType || !fileType.startsWith("image/")) {
    return Response.json({ error: "Invalid file type" }, { status: 400 });
  }

  const ext = fileType.split("/")[1] ?? "jpg";
  const path = `${session.user.id}/${Date.now()}.${ext}`;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(DISH_PHOTOS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return Response.json({ error: "Failed to create upload URL" }, { status: 500 });
  }

  const publicUrl = supabase.storage
    .from(DISH_PHOTOS_BUCKET)
    .getPublicUrl(path).data.publicUrl;

  return Response.json({ signedUrl: data.signedUrl, publicUrl, path });
}
