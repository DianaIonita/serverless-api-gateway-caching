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

## Cache key parameters
You would define these for endpoints where the response varies according to one or more request parameters. API Gateway creates entries in the cache keyed based on them. Note that cache key parameters are case sensitive.
Specifying where the request parameters can be found:
- request.path.PARAM_NAME
- request.querystring.PARAM_NAME
- request.multivaluequerystring.PARAM_NAME
- request.header.PARAM_NAME
- request.multivalueheader.PARAM_NAME
- request.body
- request.body.JSONPath_EXPRESSION

## Examples

### Minimal setup

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  # Enable or disable caching globally
  apiGatewayCaching:
    enabled: true

functions:
  # Responses are cached
  list-all-cats:
    handler: rest_api/cats/get/handler.handle
    events:
      - http:
          path: /cats
          method: get
          caching:
            enabled: true

  # Responses are *not* cached
  update-cat:
    handler: rest_api/cat/post/handler.handle
    events:
      - http:
          path: /cat
          method: post

  # Responses are cached based on the 'pawId' path parameter and the 'Accept-Language' header
  get-cat-by-paw-id:
    handler: rest_api/cat/get/handler.handle
    events:
      - http:
          path: /cats/{pawId}
          method: get
          caching:
            enabled: true
            cacheKeyParameters:
              - name: request.path.pawId
              - name: request.header.Accept-Language

  # Responses are cached based on the 'breed' query string parameter and the 'Accept-Language' header
  get-cats-by-breed:
    handler: rest_api/cat/get/handler.handle
    events:
      - http:
          path: /cats
          method: get
          caching:
            enabled: true
            cacheKeyParameters:
              - name: request.querystring.breed
              - name: request.header.Accept-Language
```

### Configuring the cache cluster size and cache time to live
Cache time to live, invalidation settings and data encryption are applied to all functions, unless specifically overridden.

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  # Enable or disable caching globally
  apiGatewayCaching:
    enabled: true
    clusterSize: '0.5' # defaults to '0.5'
    ttlInSeconds: 300 # defaults to the maximum allowed: 3600
    dataEncrypted: true # defaults to false
    perKeyInvalidation:
      requireAuthorization: true # default is true
      handleUnauthorizedRequests: Ignore # default is "IgnoreWithWarning"

```

### Configuring per-function cache time to live, cache invalidation strategy, cache key parameters and cache data encryption

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  # Enable or disable caching globally
  apiGatewayCaching:
    enabled: true

functions:
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
            dataEncrypted: true # default is false
            perKeyInvalidation:
              requireAuthorization: true # default is true
              handleUnauthorizedRequests: Fail # default is "IgnoreWithWarning"
            cacheKeyParameters:
              - name: request.path.pawId
              - name: request.header.Accept-Language
```


### Configuring a shared api gateway
No modifications will be applied to the root caching configuration of the api gateway,  
Cache time to live, invalidation settings and data encryption are applied to all functions, unless specifically overridden.

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  # Enable or disable caching globally
  apiGatewayCaching:
    enabled: true
    apiGatewayIsShared: true
    clusterSize: '0.5' # defaults to '0.5'
    ttlInSeconds: 300 # defaults to the maximum allowed: 3600
    dataEncrypted: true # defaults to false
    perKeyInvalidation:
      requireAuthorization: true # default is true
      handleUnauthorizedRequests: Ignore # default is "IgnoreWithWarning"

```
