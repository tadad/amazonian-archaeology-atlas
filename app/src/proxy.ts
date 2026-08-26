import { NextResponse, type NextRequest } from "next/server";
import {
  defaultLocale,
  isLocale,
  localeCookieName,
  localeRequestHeader,
  type Locale,
} from "./i18n/config";

function browserLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;

  const preferences = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().toLocaleLowerCase().split(";");
      const qualityParameter = parameters.find((parameter) =>
        parameter.trim().startsWith("q="),
      );
      const quality = qualityParameter
        ? Number(qualityParameter.trim().slice(2))
        : 1;
      return { tag, quality };
    })
    .filter(({ tag, quality }) => tag && Number.isFinite(quality) && quality > 0)
    .sort((left, right) => right.quality - left.quality);

  for (const { tag } of preferences) {
    if (tag === "pt" || tag.startsWith("pt-")) return "pt";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return defaultLocale;
}

function isPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    /\/[^/]+\.[^/]+$/.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicAsset(pathname)) return NextResponse.next();

  const firstSegment = pathname.split("/")[1];
  if (isLocale(firstSegment)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(localeRequestHeader, firstSegment);

    const destination = request.nextUrl.clone();
    destination.pathname = pathname.slice(firstSegment.length + 1) || "/";
    const response = NextResponse.rewrite(destination, {
      request: { headers: requestHeaders },
    });
    response.cookies.set(localeCookieName, firstSegment, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  const savedLocale = request.cookies.get(localeCookieName)?.value;
  const locale = isLocale(savedLocale)
    ? savedLocale
    : browserLocale(request.headers.get("accept-language"));
  const destination = request.nextUrl.clone();
  destination.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
