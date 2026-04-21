import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error("Clerk webhook verify failed", err);
    return new NextResponse("invalid signature", { status: 400 });
  }

  const sb = supabaseAdmin();

  try {
    switch (evt.type) {
      case "user.created":
      case "user.updated": {
        const u = evt.data;
        const email =
          u.email_addresses?.find((e: { id: string }) => e.id === u.primary_email_address_id)
            ?.email_address ?? u.email_addresses?.[0]?.email_address ?? null;

        const { error } = await sb
          .from("users")
          .upsert(
            { clerk_user_id: u.id, email },
            { onConflict: "clerk_user_id" }
          );
        if (error) throw new Error(error.message);
        break;
      }
      case "user.deleted": {
        const { error } = await sb
          .from("users")
          .delete()
          .eq("clerk_user_id", evt.data.id);
        if (error) throw new Error(error.message);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Clerk webhook handler error", err);
    return new NextResponse("handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
