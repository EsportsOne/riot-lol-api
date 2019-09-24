# Riot Lol API

This module lets you query the Riot API for LeagueOfLegends data and was extended from [here](https://github.com/Neamar/riot-lol-api).

You'll need a developer key from https://developer.riotgames.com.

This module was developed for people that need to poll the Riot API with a *very high* throughput (with peaks above the standard production rate limit of 300 calls / second / region).

## Installation
```
npm install --save github:EsportsOne/riot-lol-api
```

## Usage
```js
const RiotRequest = require('riot-lol-api');

const config = {
  apiKeys: GENERAL_RIOT_API_KEY, GARENA_RIOT_API_KEY,
  cache,
  options: {
    garenaRateLimitCap: 70,
    generalRateLimitCap: 70,
    defaultRetryPeriod: 10
  }
}

const riotRequest = new RiotRequest('my_api_key');

// See note about rate-limiting in the README.
// Also see https://developer.riotgames.com/rate-limiting.html#method-headers
riotRequest.request('na1', '/lol/summoner/v4/summoners/by-name/Mackerhan', function(err, data) {});
```

The library will take care of rate limiting and automatically retry on 500 and 503.

It will also maintain a very high request concurrency, dynamically updating concurrency to ensure you remain a good citizen and don't get blacklisted.

Ensure that your network adapter can deal with the traffic!
If necessary, you can distribute the library across multiple servers -- I'm currently using it with a production key distributed on 4 servers sending > 35 millions calls a day.

## Caching
The second argument in the constructor lets you define a cache object. This object should expose two keys, `get` and `set`. The default implementation does no caching:

```js
var cache = {
  get: function(region, endpoint, cb) {
    // Try to read from cache,
    // Return cb(null, data) if data is already available in your cache.
    // If it's a cache-miss, you still need to call cb(null, null) for the request to proceed.
    // Do not just call cb(null)!
    cb(null, null);
  },
  set: function(region, endpoint, cacheStrategy, data) {
    // Use this function to store `data`, which is the result of the API call to `endpoint` on `region`.
  }
};
```

`cacheStrategy` is a value over which you have total control when you call `.request()`:


```js
riotRequest.request('euw1', '/lol/summoner/v3/summoners/by-name/graphistos', YOUR_CACHE_STRATEGY, function(err, data) {});
```

When unspecified, `cacheStrategy` will default to `false`, and cache won't be used.
If the value is not falsy, the cache will be used and the value will be forwarded to you (in your `.set` cache method). The most common use case would be to send how long you want to store the data in cache, but this is completely up to you.

You may want to use a package like `lru-cache` to help you with caching -- note that you can plug any system you want (Redis, Riak, file system), just ensure you call `cb(null, data)`. If you send an error in the first argument, the library will forward this error directly to the callback specified in `.request()`.

You'll notice that the `set()` function has no callback, this is intentional. You can start async operations from here, but the system won't wait for your operation to complete before moving on to other requests.

In some situations, the `get()` function might be called more than once per endpoint. For performance, when a request is queued, it is checked instantly if it's in cache: if it isn't, it's added in a queue, and when the worker start that task he will ask the cache again in case the same request was already queued and has since then been cached.

## Rate limiting
The Riot API rate limiting is complex -- see https://developer.riotgames.com/rate-limiting.html for all the nitty gritty.

This library abstracts most of it away, automatically reading the headers values and adjusting this behavior to ensure your key doesn't get blacklisted.

Here is a sample code excerpt: 

```js
riotRequest.request('euw1', '/lol/summoner/v3/summoners/by-name/graphistos', function(err, data) {});
riotRequest.request('euw1', '/lol/champion-mastery/v3/champion-masteries/by-summoner/4203456', function(err, data) {});
riotRequest.request('euw1', '/lol/league/v3/positions/by-summoner/4203456', function(err, data) {});
```

## Settings
The `RiotRequest` constructor has a takes in a config object that should look liek this:
`{
  apiKeys: GENERAL_RIOT_API_KEY, GARENA_RIOT_API_KEY,
  cache,
  options: {
    garenaRateLimitCap: 70,
    generalRateLimitCap: 70,
    defaultRetryPeriod: 10
  }
}`
* `garenaRateLimitCap` - How much of the total rate limit you want to use for a garena region out of 100.
* `generalRateLimitCap` - How much of the total rate limit you want to use for a general region out of 100.
* `defaultRetryPeriod` (Default: 10) - The retry period to use if the `Retry-After` header is not present (Numeric).

## Logging
The library use `debug` for logging. To see logs, set this environment variable: `DEBUG=riot-lol-api:*`.

## Errors
Errors when trying to read the cache are forwarded directly to the requester.

HTTP errrors on the Riot API side will expose three properties:

* `.statusCode` containing the return code from the API (the most common one is 503. Note that the library is retrying by default all 5XX errors, so if you see it in your code it means that the error happened twice)
* `riotInternal` a flag set to true to help you distinguish network errors (fairly common) from more standard errors (e.g. from your cache)
* `extra`, an object exposing details about the request: endpoint, region, status code, whether the failure is due to a timeout... You may want to send this object directly to you error monitoring system.

Please remember that the library will automatically retry once when it receives a 500 and 503.

## Advanced topics
Honestly, skip this section if you're using the library for the first time. I started using this option past 20 million calls a day...

### Platform Cap
Use case:

* throttle some process based on region
 
You can used the expose method `setPlatformCap(platform, cap)` to cap how many requests of the available the region will use.

### Throttler
Use case:

* throttle some process to ensure other processes always have enough requests available.
 
Let's say you have a worker downloading games in the background, and you also have a frontend that can request games from the API in realtime to answer user requests. You always want the frontend to be able to request in realtime, but by default it's very likely your worker will use all capacity every 10s.
To prevent this, the library exposes a method named `setThrottle(platform, method, throttle)` (and `setThrottle(method, throttle)` which is automatically applied to all platforms).

For this particular use case, in your worker, you'd call `riotRequest.setThrottle('match', 100)` (replace `match` with the method name you use to qualify the request type when you call `.request()`). The library will then try to reserve 100 requests for uses in other processes (for instance, assuming you can do 250 calls per second, the worker will consume around 150 requests, leaving 100 requests for other processes). Exact count isn't guaranteed, but the closer you get to the specified throttled limit, the smaller the concurrency will be (down to a minimum of 1).

### Access internal queue
Use cases:

* automatically fail a request when queue is rate limited, rather than fill the queue with time sensitive requests
* hack around concurrency / tasks

`riot-lol-api` uses `async.queue` internally. One queue is generated for each platform / method combination. Every time you call `.request()`, caching will be checked for you, and if the request has to be done it will be queued in the corresponding queue. Queue concurrency is then automatically changed on a per request basis (access with `queue.concurrency`. When a queue is rate-limited, `queue.rateLimited` will be set to true, you can use this flag to skip non important requests.

To retrieve a specific queue, call `getQueue(platform, method)` on your `riotRequest` instance. If the queue does not exist, it will be created and reused for future requests on the same platform / method combination.
