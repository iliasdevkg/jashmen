/// API location, and the one place that knows how to turn the server's
/// media references into something the image loader can actually fetch.
library;

const String kApiBaseUrl = 'https://jashmenstudio.com/admin/api';

/// Origin of [kApiBaseUrl] — "https://jashmenstudio.com".
final String kApiOrigin = Uri.parse(kApiBaseUrl).origin;

/// Resolves a media reference from the API into an absolute URL, or null if
/// it isn't something we're willing to load.
///
/// Uploads come back as **site-relative paths** (`/admin/api/uploads/x.png`)
/// because the web client is served from the same origin and needs nothing
/// more. A native client has no origin of its own, so those paths have to be
/// resolved against the API host — without this every admin-uploaded image
/// in the app silently fails to load.
///
/// Also the gate on what may become an <img> src, mirroring the server's
/// sanitizeIconUrl (admin-api/contentStore.js): absolute http(s) passes
/// through, site-relative gets the origin, and anything else — emoji
/// avatars, `javascript:`, protocol-relative `//host` — returns null for the
/// caller to fall back on.
String? resolveMediaUrl(dynamic value) {
  final s = value?.toString().trim();
  if (s == null || s.isEmpty) return null;

  if (s.startsWith('//')) return null; // protocol-relative: not ours to trust
  if (s.startsWith('/')) return '$kApiOrigin$s';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;

  return null; // emoji avatars and anything unrecognised
}
