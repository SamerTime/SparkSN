import { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export const middleware = async (req: NextRequest) => {
  return updateSession(req);
};

export const config = {
  matcher: [
    "/",
    "/jobs/:path*",
    "/spark/:path*",
  ],
};
