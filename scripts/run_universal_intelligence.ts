/**
 * Retired safety stub.
 *
 * This legacy job generated synthetic transitions from search titles and wrote
 * them straight into live artifacts. It is intentionally blocked: search is
 * for discovery only, while Evidence import and the canonical rebuild own the
 * research record.
 */
throw new Error('This legacy script is retired. Use research discovery, human-reviewed Evidence import, then npm run timeline:rebuild.');
