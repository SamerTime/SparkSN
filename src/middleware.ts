import { NextRequest, NextResponse } from "next/server";
export { default } from "next-auth/middleware";
import { getToken } from "next-auth/jwt";
import {
  copySupabaseCookies,
  updateSession,
} from "@/utils/supabase/middleware";

const redirectWithSupabaseCookies = (
  req: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string
) => {
  return copySupabaseCookies(
    supabaseResponse,
    NextResponse.redirect(new URL(pathname, req.url))
  );
};

export const middleware = async (req: NextRequest) => {
  const supabaseResponse = await updateSession(req);
  const token = await getToken({ req });
  const url = req.nextUrl;

  if (token && (url.pathname === "/login" || url.pathname === "/")) {
    return redirectWithSupabaseCookies(req, supabaseResponse, "/spark/recruiter");
  }

  if (token && url.pathname === "/signup") {
    return redirectWithSupabaseCookies(req, supabaseResponse, "/spark/recruiter");
  }

  if (
    !token &&
    (url.pathname === "/profile" ||
      url.pathname === "/companies" ||
      url.pathname.startsWith("/job/") ||
      url.pathname.startsWith("/feedback/") ||
      url.pathname.startsWith("/analysis/"))
  ) {
    return redirectWithSupabaseCookies(req, supabaseResponse, "/login");
  }

  if (token) {
    const userRole = token.role as string;

    if (userRole === "applicant" && url.pathname.startsWith("/analysis/")) {
      return redirectWithSupabaseCookies(req, supabaseResponse, "/spark/recruiter");
    }

    if (userRole === "recruiter" && url.pathname.startsWith("/feedback/")) {
      return redirectWithSupabaseCookies(req, supabaseResponse, "/spark/recruiter");
    }

    if (userRole === "applicant" && url.pathname === "/job/create") {
      return redirectWithSupabaseCookies(req, supabaseResponse, "/jobs");
    }

    if (userRole === "recruiter" && url.pathname.startsWith("/feedback/")) {
      return redirectWithSupabaseCookies(req, supabaseResponse, "/spark/recruiter");
    }
  }

  return supabaseResponse;
};

export const config = {
  matcher: [
    "/login",
    "/signup",
    "/",
    "/profile",
    "/companies",
    "/jobs/:path*",
    "/spark/:path*",
    "/job/:path*",
    "/feedback/:path*",
    "/analysis/:path*",
  ],
};
