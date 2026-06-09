# Docker

`package-lock.json` should stay committed. Docker uses it with `npm ci` so builds install the exact dependency tree.

This Docker image serves the Expo Web export of the internal mobile app. Native Android/iOS builds should still be produced with Expo/EAS or the native toolchain.

## Build mobile web image

```bash
docker build ^
  --build-arg EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 ^
  --build-arg EXPO_PUBLIC_CUSTOMER_APP_BASE_URL=http://localhost:8080 ^
  -t trasua-mobile-web .
```

## Run mobile web

```bash
docker run -p 8081:80 trasua-mobile-web
```

The container serves the Expo static export with nginx and supports SPA route refresh fallback.
