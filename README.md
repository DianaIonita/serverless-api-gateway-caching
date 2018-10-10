# serverless-api-gateway-caching

[![CircleCI](https://circleci.com/gh/DianaIonita/serverless-api-gateway-caching.svg?style=svg)](https://circleci.com/gh/DianaIonita/serverless-api-gateway-caching)

## Intro
A plugin for the serverless framework which helps with configuring caching for API Gateway endpoints.

## Good to know
* If you enable caching globally, it does NOT automatically enable caching for your endpoints - you have to be explicit about which endpoints should have caching enabled.
However, disabling caching globally disables it across endpoints.
* If you don't specify `ttlInSeconds` and `perKeyInvalidation` for an endpoint which has caching enabled, these settings are inherited from global settings.
* For HTTP method `ANY`, caching will be enabled only for the `GET` method and disabled for the other methods.

## Per-key cache invalidation
If you don't configure per-key cache invalidation authorization, by default it is *required*.
You can configure how to handle unauthorized requests to invalidate a cache key using the options:
* `Ignore` - ignores the request to invalidate the cache key.
* `IgnoreWithWarning` - ignores the request to invalidate and adds a `warning` header in the response.
* `Fail` - fails the request to invalidate the cache key with a 403 response status code.

## Currently not supported:
* lambda functions with many HTTP events.

## Example

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  # Enable or disable caching globally
  apiGatewayCaching:
    enabled: true
    clusterSize: '0.5' # defaults to '0.5'
    ttlInSeconds: 300 # defaults to the maximum allowed: 3600
    perKeyInvalidation:
      requireAuthorization: true # default is true
      handleUnauthorizedRequests: IgnoreWithWarning # default is "IgnoreWithWarning"

functions:
  # Responses are not cached
  list-all-cats:
    handler: rest_api/cats/get/handler.handle
    role: listCatsRole
    events:
      - http:
          path: /cats
          method: get
          caching:
            enabled: false # default is false

  # Responses are cached based on the 'pawId' path parameter and the 'Accept-Language' header
  get-cat-by-paw-id:
    handler: rest_api/cat/get/handler.handle
    events:
      - http:
          path: /cats/{pawId}
          method: get
          caching:
            enabled: true
            ttlInSeconds: 3600
            perKeyInvalidation:
              requireAuthorization: true
              handleUnauthorizedRequests: Ignore
            cacheKeyParameters:
              - name: request.path.pawId
                required: false # default is true
              - name: request.header.Accept-Language
```
