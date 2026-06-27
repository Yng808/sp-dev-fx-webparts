# Fast Load Caching

Fast load caching lets a `PagedViewLoader` rehydrate list item entities from a local browser cache before it finishes talking to SharePoint. This gives users a faster first render for list-backed screens while SharePoint remains the source of truth.

The cache is stored with the browser Cache API. It is not `localStorage` or `sessionStorage`. The online live update service opens a per-user cache named from the current user's login, and each cached view is stored by site URL and SharePoint view ID.

## Enabling Fast Load

Enable fast load on a `PagedViewLoader` by passing `fastLoad: { useCache: true }` in the loader configuration.

```ts
super({
    ctor: Event,
    view: schema.eventsList.view_AllEvents,
    timezones,
    spo,
    liveUpdate,
    fastLoad: { useCache: true }
});
```

Fast load requires the live update service. The loader uses live update both to create the cache and to keep cached data close to the latest SharePoint state.

Fast load is only supported for the local SharePoint site. A loader cannot use `fastLoad.useCache` when it is configured with a non-local `siteURL`.

## Load Flow

When a loader starts, it first checks whether fast load is enabled and whether the view has a persisted SharePoint view ID.

If a valid cache entry exists, the loader:

1. Deserializes cached list item rows into entities.
2. Publishes those entities to the `AsyncData` stream for immediate rendering.
3. Queries SharePoint for changes since the cached change token.
4. Applies inserts, updates, and deletes from SharePoint.
5. Saves the refreshed entity collection back into the cache.

If the cache is missing, stale, expired, or incompatible with the schema, the loader falls back to loading all pages from SharePoint and then writes the loaded entities into the cache.

## Expiration And Invalidation

The default cache expiration is five days, defined by `FAST_LOAD_EXPIRATION_DAYS` in `PagedViewLoader`.

```ts
const FAST_LOAD_EXPIRATION_DAYS = 5;
```

A cached item is considered invalid when:

* The cached timestamp is older than the configured expiration.
* The cached schema version does not match the current list schema version.
* Rehydrating the cached data throws an error.
* A critical persist error occurs and the loader purges the cache.

The expiration can be overridden per loader:

```ts
fastLoad: {
    useCache: true,
    expiration: 1
}
```

## Serialization Details

Fast load reuses the loader's existing entity mapping functions instead of introducing a separate serialization model.

When saving, `ListItemCache` calls the loader's `updateListItem` function to convert each entity back into SharePoint-style list item fields. It also stores list metadata needed to validate the cache later:

* Timestamp
* Current SharePoint change token
* Schema version
* Cached list item results
* Referenced users

User fields are stored compactly by user ID, then expanded back into SharePoint user result objects during cache load. This allows the normal `toEntity` path to rebuild entities, relationships, dates, people fields, lookups, and other field types the same way it does when rows come directly from SharePoint.

Deleted entities are excluded from the cache unless the entity type supports soft delete.

## Relationship To Live Update

Fast load is designed to work with live update. The cache gives the app an immediate local copy, then live update and SharePoint change tokens reconcile that copy with the latest list changes.

This means cached data may appear briefly before the background refresh completes, but it should not be treated as authoritative. SharePoint list data is still the permanent source, and successful loads or saves refresh the cache for the next visit.
