# serverless-api-gateway-caching

[![CircleCI](https://circleci.com/gh/DianaIonita/serverless-api-gateway-caching.svg?style=svg)](https://circleci.com/gh/DianaIonita/serverless-api-gateway-caching)
![npm](https://img.shields.io/npm/v/serverless-api-gateway-caching.svg)
[![npm downloads](https://img.shields.io/npm/dt/serverless-api-gateway-caching.svg?style=svg)](https://www.npmjs.com/package/serverless-api-gateway-caching)

## Intro
A plugin for the serverless framework which helps with configuring caching for API Gateway endpoints.

## Quick Start
* If you enable caching globally, it does *NOT* automatically enable caching for your endpoints - you have to be explicit about which endpoints should have caching enabled.
However, disabling caching globally disables it across endpoints.

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
```

## Time-to-live, encryption, cache invalidation settings

You can use the `apiGatewayCaching` section ("global settings") to quickly configure cache time-to-live, data encryption and per-key cache invalidation for all endpoints. The settings are inherited by each endpoint for which caching is enabled.

Cache `clusterSize` can only be specified under global settings, because there's only one cluster per API Gateway stage.

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true
    clusterSize: '0.5' # defaults to '0.5'
    ttlInSeconds: 300 # defaults to the maximum allowed: 3600
    dataEncrypted: true # defaults to false
    perKeyInvalidation:
      requireAuthorization: true # default is true
      handleUnauthorizedRequests: Ignore # default is "IgnoreWithWarning".
```

### Configuring per-endpoint settings

If you need a specific endpoint to override any of the global settings, you can add them like this:

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true
    ttlInSeconds: 300

functions:
  get-cat-by-paw-id:
    handler: rest_api/cat/get/handler.handle
    events:
      - http:
          path: /cats/{pawId}
          method: get
          caching:
            enabled: true
            ttlInSeconds: 3600 # overrides the global setting for ttlInSeconds
            dataEncrypted: true # default is false
            perKeyInvalidation:
              requireAuthorization: true # default is true
              handleUnauthorizedRequests: Fail # default is "IgnoreWithWarning"
            cacheKeyParameters:
              - name: request.path.pawId
              - name: request.header.Accept-Language
```

## Good to know
* For HTTP method `ANY`, caching will be enabled only for the `GET` method and disabled for the other methods.

## Per-key cache invalidation
If you don't configure per-key cache invalidation authorization, by default it is *required*.
You can configure how to handle unauthorized requests to invalidate a cache key using the options:
* `Ignore` - ignores the request to invalidate the cache key.
* `IgnoreWithWarning` - ignores the request to invalidate and adds a `warning` header in the response.
* `Fail` - fails the request to invalidate the cache key with a 403 response status code.

## Cache key parameters
You would define these for endpoints where the response varies according to one or more request parameters. API Gateway creates entries in the cache keyed based on them.
Please note that cache key parameters are *case sensitive*.

### Quick overview of how cache entries are created
Suppose the configuration looks like this:

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true

functions:
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
              - name: request.querystring.catName
```

When the endpoint is hit, API Gateway will create cache entries based on the `pawId` path parameter and the `catName` query string parameter. For instance:
- `GET /cats/4` will create a cache entry for `pawId=4` and `catName` as `undefined`.
- `GET /cats/34?catName=Toby` will create a cache entry for `pawId=34` and `catName=Toby`.
- `GET /cats/72?catName=Dixon&furColour=white` will create a cache entry for `pawId=72` and `catName=Dixon`, but will ignore the `furColour` query string parameter. That means that a subsequent request to `GET /cats/72?catName=Dixon&furColour=black` will return the cached response for `pawId=72` and `catName=Dixon`.

### Cache key parameters from the path, query string and header
When an endpoint varies its responses based on values found in the `path`, `query string` or `header`, you can specify all the parameter names as cache key parameters:

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true

functions:
  get-cats:
    handler: rest_api/cat/get/handler.handle
    events:
      - http:
          path: /cats/{city}/{shelterId}/
          method: get
          caching:
            enabled: true
            cacheKeyParameters:
              - name: request.path.city
              - name: request.path.shelterId
              - name: request.querystring.breed
              - name: request.querystring.furColour
              - name: request.header.Accept-Language
```

### Caching catch-all path parameters
When you specify a catch-all route that intercepts all requests to the path and routes them to the same function, you can also configure the path as a cache key parameter.
In this example: 

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true

functions:
  get-cats:
    handler: rest_api/cat/get/handler.handle
    events:
      - http:
          path: /cats/{proxy+}
          method: get
          caching:
            enabled: true
            cacheKeyParameters:
              - name: request.path.proxy
```
API Gateway will create cache entries like this:
- `GET /cats/toby/` will create a cache entry for `proxy=toby`
- `GET /cats/in/london` will create an entry for `proxy=in/london`
- `GET /cats/in/london?named=toby` will only create an entry for `proxy=in/london`, ignoring the query string. Note, however, that you can also add the `named` query string parameter as a cache key parameter and it will cache based on that value as well.


### Cache key parameters from the body
When the cache key parameter is the entire request body, you must set up a mapping from the client method request to the integration request.

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true

functions:
  # Cache responses for POST requests based on the whole request body
  cats-graphql:
    handler: graphql/handler.handle
    events:
      - http:
          path: /graphql
          method: post
          integration: lambda # you must use lambda integration (instead of the default proxy integration) for this to work
          caching:
            enabled: true
            cacheKeyParameters:
              - name: integration.request.header.bodyValue
                mappedFrom: method.request.body
```

When the cache key parameter is part of the request body, you can define a JSONPath expression. The following example uses as cache key parameter the `cities[0].petCount` value from the request body:

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true

functions:
  # Cache responses for POST requests based on the whole request body
  cats-graphql:
    handler: graphql/handler.handle
    events:
      - http:
          path: /graphql
          method: post
          integration: lambda # you must use lambda integration (instead of the default proxy integration) for this to work
          caching:
            enabled: true
            cacheKeyParameters:
              - name: integration.request.header.petCount
                mappedFrom: method.request.body.cities[0].petCount
```

### Limitations
Cache key parameters coming from multi-value query strings and multi-value headers are currently not supported.

## Configuring a shared API Gateway
This just means that no changes are applied to the root caching configuration of the API Gateway, however `ttlInSeconds`, `dataEncryption` and `perKeyInvalidation` are still applied to all functions, unless specifically overridden.

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true
    apiGatewayIsShared: true
    clusterSize: '0.5'
    ttlInSeconds: 300
    dataEncrypted: true
    perKeyInvalidation:
      requireAuthorization: true
      handleUnauthorizedRequests: Ignore
```

## Configuring caching settings for endpoints defined in CloudFormation
You can use this feature to configure caching for endpoints which are defined in CloudFormation and not as serverless functions.
If your `serverless.yml` contains, for example, a [HTTP Proxy](https://www.serverless.com/framework/docs/providers/aws/events/apigateway/#setting-an-http-proxy-on-api-gateway) like this:

```yml
resources:
  Resources:
    ProxyResource:
      Type: AWS::ApiGateway::Resource
      Properties:
        ParentId:
          Fn::GetAtt:
            - ApiGatewayRestApi # the default Rest API logical ID
            - RootResourceId
        PathPart: serverless # the endpoint in your API that is set as proxy
        RestApiId:
          Ref: ApiGatewayRestApi
    ProxyMethod:
      Type: AWS::ApiGateway::Method
      Properties:
        ResourceId:
          Ref: ProxyResource
        RestApiId:
          Ref: ApiGatewayRestApi
        HttpMethod: GET
        AuthorizationType: NONE
        MethodResponses:
          - StatusCode: 200
        Integration:
          IntegrationHttpMethod: POST
          Type: HTTP
          Uri: http://serverless.com # the URL you want to set a proxy to
          IntegrationResponses:
            - StatusCode: 200
```

Then you can configure caching for it like this:

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true
    additionalEndpoints:
      - method: GET
        path: /serverless
        caching:
          enabled: true # it must be specifically enabled
          ttlInSeconds: 1200 # if not set, inherited from global settings
          dataEncrypted: true # if not set, inherited from global settings
```

## More Examples

A function with several endpoints:

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true

functions:
  get-cat-by-pawId:
    handler: rest_api/cat/get/handler.handle
    events:
      - http:
          path: /cats/{pawId}
          method: get
          caching:
            enabled: true
            cacheKeyParameters:
              - name: request.path.pawId
              - name: request.querystring.includeAdopted
              - name: request.header.Accept-Language
      - http:
          path: /cats
          method: get
          caching:
            enabled: true
            cacheKeyParameters:
              - name: request.querystring.pawId
              - name: request.querystring.includeAdopted
              - name: request.header.Accept-Language
```

Cache key parameters found in the `body` and as `querystring`:

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  apiGatewayCaching:
    enabled: true

functions:
  list-cats:
    handler: rest_api/cat/get/handler.handle
    events:
      - http:
          path: /cats
          method: post
          integration: lambda # you must use lambda integration for this to work
          caching:
            enabled: true
            cacheKeyParameters:
              - name: request.querystring.catName
              - name: integration.request.header.furColour
                mappedFrom: method.request.body.furColour
```
