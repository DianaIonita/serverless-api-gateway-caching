# serverless-api-gateway-caching

## Intro
A plugin for the serverless framework which helps with configuring caching for API Gateway endpoints.

## Example

```yml
plugins:
  - serverless-api-gateway-caching

custom:
  # Enable or disable caching globally
  apiGatewayCaching:
    enabled: true
    clusterSize: '0.5'
    ttlInSeconds: 300

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
            cacheKeyParameters:
              - name: request.path.pawId
                required: true
              - name: request.header.Accept-Language
                required: false
```

## Limitations
Currently not supported:
- lambda functions with many http events
