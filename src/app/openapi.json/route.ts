import { appUrl } from "@/lib/stripe";
import { openApiSpec } from "@/lib/llms";

export const dynamic = "force-static";

export function GET() {
  return Response.json(openApiSpec(appUrl().replace(/\/$/, "")), {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
