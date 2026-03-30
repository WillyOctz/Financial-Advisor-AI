import { NextResponse, NextRequest } from "next/server";

// Paths that don't require authentication
const publicPaths = [
  "/",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/verify-2fa",
];

// Paths that require authentication and protected
const protectedPaths = [
  "/dashboard",
  "/analysis",
  "/chats",
  "/forecast",
  "transactions",
  "/upload",
];

// paths that require email verification
const verifiedEmailPaths = [
  "/dashboard",
  "/analysis",
  "/chats",
  "/forecast",
  "transactions",
  "/upload",
];

export function Middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get tokens from cookies or localstorage
  const token = request.cookies.get("token")?.value;
  const partialToken = request.cookies.get("partial_token")?.value;

  let user = null;
  try {
    const userCookie = request.cookies.get("user")?.value;
    user = userCookie ? JSON.parse(userCookie) : null;
  } catch (error) {
    // Invalid data user in cookie
  }

  // Handle the 2FA flow
  const isOn2FAVerification = pathname.startsWith("/verify-2fa");

  if (isOn2FAVerification) {
    // if the user has full token, redirect them to dashboard
    if (token && user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // if no partial token, redirect to login
    if (!partialToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // allow access to verify-2fa if they have partial token
    return NextResponse.next();
  }

  // check if path is public
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (isPublicPath) {
    // if user is already authenticated and tried to access login/register page
    if (
      (pathname.startsWith("/login") || pathname.startsWith("/register")) &&
      token &&
      user
    ) {
      // if they need 2FA, redirect them to verify-2fa
      if (partialToken) {
        return NextResponse.redirect(new URL("/verify-2fa", request.url));
      }

      // otherwise redirect to dashboard
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // allow access to public paths
    return NextResponse.next();
  }

  // check if its protected path
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtectedPath) {
    // no token at all - redirect to login
    if (!token && !partialToken) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // has partial token (needs 2FA) but trying to access protected routes
    if (partialToken && !token) {
      return NextResponse.redirect(new URL("/verify-2fa", request.url));
    }

    // has token but no user data
    if (token && !user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // check email verification for specific paths
    const requiresEmailVerification = verifiedEmailPaths.some((path) =>
      pathname.startsWith(path)
    );

    if (requiresEmailVerification && user && !user.is_verified) {
      // Redirect to email verification page
      return NextResponse.redirect(new URL("/verify-email", request.url));
    }

    // user is authenticated and has required permissions
    return NextResponse.next();
  }

  // default : allow access to other paths
  return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next|_static|_vercel|favicon.ico|sitemap.xml|robots.txt).*)',
    ]
}
