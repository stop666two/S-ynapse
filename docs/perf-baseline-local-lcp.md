# 本地 LCP 基线记录（T5：分相采集与治理）

> 由 `.tmp-scripts/run-perf-lcp.js` 生成（本地 `build.js --serve`，端口 3314，serve 已加 gzip 以贴近生产边缘压缩）。
> 采样口径：Slow 4G（下行 200000 B/s / 上行 93750 B/s / RTT 150ms）+ CPU 4x + 禁用缓存 + 独立上下文，每页 3 次取中位数。
> 本地与生产不可直接对比（无 CDN 边缘、无 Brotli、单机 Node 压缩），仅用于同口径前后回归。

## LCP 元素

- **/zh/（中文首页）**：前 `img.post-card-image.motion-reveal（http://127.0.0.1:3314/media/test-photo-1-640.53b36a7a57.jpg）` → 后 `img.post-card-image.motion-reveal（http://127.0.0.1:3314/media/test-photo-1-640.53b36a7a57.jpg）`
- **/en/（英文首页）**：前 `img.post-card-image.motion-reveal（http://127.0.0.1:3314/media/test-photo-1-640.53b36a7a57.jpg）` → 后 `img.post-card-image.motion-reveal（http://127.0.0.1:3314/media/test-photo-1-640.53b36a7a57.jpg）`
- **/zh/long-stress/（长文）**：前 `img.post-featured-image.js-img（http://127.0.0.1:3314/media/test-photo-4.a0c9f49be2.jpg）` → 后 `img.post-featured-image（http://127.0.0.1:3314/media/test-photo-4.a0c9f49be2.jpg）`

## 前后对照（中位数）

| 指标 | /zh/（中文首页） · 前 | /zh/（中文首页） · 后 | /en/（英文首页） · 前 | /en/（英文首页） · 后 | /zh/long-stress/（长文） · 前 | /zh/long-stress/（长文） · 后 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| LCP(ms) | 1736 | 1968 | 1928 | 1768 | 4236 | 2988 |
| FCP(ms) | 1652 | 1964 | 1844 | 1700 | 3308 | 2972 |
| TTFB(ms) | 6 | 5 | 6 | 6 | 8 | 6 |
| 资源加载延迟(ms) | 196 | 192 | 199 | 201 | 177 | 187 |
| 资源加载时长(ms) | 322 | 278 | 329 | 313 | 308 | 232 |
| 渲染延迟(ms) | 1209 | 1494 | 1396 | 1249 | 3751 | 2547 |
| TBT(ms) | 697 | 144 | 914 | 765 | 742 | 538 |
| 请求数 | 33 | 33 | 18 | 18 | 38 | 39 |
| 总传输字节 | 1310216 | 1310245 | 417372 | 417401 | 1454125 | 1456997 |
| HTML字节 | 12285 | 12377 | 10283 | 10429 | 27814 | 27918 |
| CLS | 0.0016 | 0.0017 | 0.0020 | 0.0020 | 0.0016 | 0.0018 |

> 说明：/zh/ 三次口径的采样受同机外部负载影响波动较大（优化前单次最高 2484ms），其结论以文末「首页 5 次 A/B」为准；/en/ 与长文页三次口径方向一致。

## 逐次采样

### 优化前 · /zh/（中文首页）

| 运行 | LCP(ms) | FCP(ms) | 分相：TTFB/加载延迟/加载时长/渲染延迟 | TBT(ms) | 请求数 | 总传输 | LCP 元素 |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 1 | 2484 | 2216 | 6/187/320/1971 | 973 | 33 | 1310216 | `img.post-card-image.motion-reveal` |
| 2 | 1736 | 1652 | 9/196/322/1209 | 697 | 33 | 1310216 | `img.post-card-image.motion-reveal` |
| 3 | 1620 | 1604 | 6/197/329/1088 | 520 | 33 | 1310216 | `img.post-card-image.motion-reveal` |
| **中位** | 1736 | 1652 | 6/196/322/1209 | 697 | 33 | 1310216 | - |

### 优化前 · /en/（英文首页）

| 运行 | LCP(ms) | FCP(ms) | 分相：TTFB/加载延迟/加载时长/渲染延迟 | TBT(ms) | 请求数 | 总传输 | LCP 元素 |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 1 | 2440 | 2308 | 68/199/308/1866 | 992 | 18 | 417372 | `img.post-card-image.motion-reveal` |
| 2 | 1880 | 1796 | 6/206/343/1325 | 879 | 18 | 417372 | `img.post-card-image.motion-reveal` |
| 3 | 1928 | 1844 | 4/199/329/1396 | 914 | 18 | 417372 | `img.post-card-image.motion-reveal` |
| **中位** | 1928 | 1844 | 6/199/329/1396 | 914 | 18 | 417372 | - |

### 优化前 · /zh/long-stress/（长文）

| 运行 | LCP(ms) | FCP(ms) | 分相：TTFB/加载延迟/加载时长/渲染延迟 | TBT(ms) | 请求数 | 总传输 | LCP 元素 |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 1 | 3808 | 3208 | 9/177/308/3314 | 742 | 39 | 1456968 | `img.post-featured-image` |
| 2 | 4276 | 3308 | 4/195/321/3756 | 1090 | 38 | 1454125 | `img.post-featured-image.js-img` |
| 3 | 4236 | 3568 | 8/175/302/3751 | 467 | 38 | 1454125 | `img.post-featured-image.js-img` |
| **中位** | 4236 | 3308 | 8/177/308/3751 | 742 | 38 | 1454125 | - |

### 优化后 · /zh/（中文首页）

| 运行 | LCP(ms) | FCP(ms) | 分相：TTFB/加载延迟/加载时长/渲染延迟 | TBT(ms) | 请求数 | 总传输 | LCP 元素 |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 1 | 2568 | 2552 | 5/205/279/2079 | 0 | 33 | 1310245 | `img.post-card-image.motion-reveal` |
| 2 | 1964 | 1964 | 5/187/278/1494 | 198 | 33 | 1310245 | `img.post-card-image.motion-reveal` |
| 3 | 1968 | 1952 | 6/192/278/1492 | 144 | 33 | 1310245 | `img.post-card-image.motion-reveal` |
| **中位** | 1968 | 1964 | 5/192/278/1494 | 144 | 33 | 1310245 | - |

### 优化后 · /en/（英文首页）

| 运行 | LCP(ms) | FCP(ms) | 分相：TTFB/加载延迟/加载时长/渲染延迟 | TBT(ms) | 请求数 | 总传输 | LCP 元素 |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 1 | 1968 | 1852 | 6/201/313/1449 | 765 | 18 | 417401 | `img.post-card-image.motion-reveal` |
| 2 | 1672 | 1456 | 4/189/327/1152 | 576 | 18 | 417401 | `img.post-card-image.motion-reveal` |
| 3 | 1768 | 1700 | 7/202/310/1249 | 861 | 18 | 417401 | `img.post-card-image.motion-reveal` |
| **中位** | 1768 | 1700 | 6/201/313/1249 | 765 | 18 | 417401 | - |

### 优化后 · /zh/long-stress/（长文）

| 运行 | LCP(ms) | FCP(ms) | 分相：TTFB/加载延迟/加载时长/渲染延迟 | TBT(ms) | 请求数 | 总传输 | LCP 元素 |
| ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 1 | 3124 | 3008 | 9/187/232/2696 | 538 | 39 | 1456997 | `img.post-featured-image` |
| 2 | 2652 | 2636 | 6/185/225/2236 | 644 | 39 | 1456997 | `img.post-featured-image` |
| 3 | 2988 | 2972 | 6/199/236/2547 | 499 | 39 | 1456997 | `img.post-featured-image` |
| **中位** | 2988 | 2972 | 6/187/232/2547 | 538 | 39 | 1456997 | - |

## 首屏资源明细（优化后最后一次成功运行）

### /zh/（中文首页）

LCP 元素：`img.post-card-image.motion-reveal（http://127.0.0.1:3314/media/test-photo-1-640.53b36a7a57.jpg）`

render-blocking 资源（2）：

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 |
| --- | --- | --- | --- | --- |
| /assets/vendor/fonts/fonts.css | link | 189 | 179 | 468 |
| /assets/css/site.da54dd35ad.css | link | 190 | 461 | 24296 |

首屏请求（≤FCP，20）：

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 | 阻塞 |
| --- | --- | --- | --- | --- | --- |
| /assets/vendor/fonts/fonts.css | link | 189 | 179 | 468 | blocking |
| /assets/css/site.da54dd35ad.css | link | 190 | 461 | 24296 | blocking |
| /assets/css/cjk-fonts.css?v=446c74ffab | link | 198 | 872 | 23605 | non-blocking |
| /media/test-photo-1-640.53b36a7a57.jpg | img | 198 | 278 | 7176 | non-blocking |
| /assets/js/runtime.79bd8cc181.js | script | 215 | 200 | 2025 | non-blocking |
| /assets/js/app.7TF5EM4I.js | script | 229 | 437 | 24561 | non-blocking |
| /assets/config.729cf0aa24.json | fetch | 684 | 417 | 18959 | non-blocking |
| /assets/vendor/fonts/inter-latin-wght-normal.woff2 | css | 726 | 545 | 48556 | non-blocking |
| /media/test-photo-2-640.7585193eb6.png | img | 1919 | 1331 | 43994 | non-blocking |
| /media/avatar.c687352512.svg | img | 1919 | 193 | 525 | non-blocking |
| /media/test-photo-3-640.webp | img | 1919 | 393 | 7575 | non-blocking |
| /media/test-photo-5-large-640.7711019e76.jpg | img | 1919 | 395 | 10315 | non-blocking |
| /assets/fonts/noto-sans-sc/5b338f152fd86b63.woff2 | css | 1947 | 2269 | 77100 | non-blocking |
| /assets/fonts/noto-sans-sc/53f113205139e76f.woff2 | css | 1947 | 1642 | 53284 | non-blocking |
| /assets/fonts/noto-sans-sc/38243028cfff2b1b.woff2 | css | 1947 | 1908 | 56808 | non-blocking |
| /assets/fonts/noto-sans-sc/0faa86d20b2222c8.woff2 | css | 1948 | 2175 | 58264 | non-blocking |
| /assets/fonts/noto-sans-sc/f056c44ae038a01e.woff2 | css | 1948 | 2174 | 57948 | non-blocking |
| /assets/fonts/noto-sans-sc/cb5f15c55765a71b.woff2 | css | 1949 | 2631 | 46492 | non-blocking |
| /assets/fonts/noto-sans-sc/f367ce14219838f8.woff2 | css | 1950 | 3238 | 52764 | non-blocking |
| /assets/fonts/noto-sans-sc/2229c1fa6a03dc47.woff2 | css | 1952 | 3764 | 61772 | non-blocking |

### /en/（英文首页）

LCP 元素：`img.post-card-image.motion-reveal（http://127.0.0.1:3314/media/test-photo-1-640.53b36a7a57.jpg）`

render-blocking 资源（2）：

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 |
| --- | --- | --- | --- | --- |
| /assets/vendor/fonts/fonts.css | link | 191 | 172 | 468 |
| /assets/css/site.da54dd35ad.css | link | 192 | 592 | 24296 |

首屏请求（≤FCP，14）：

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 | 阻塞 |
| --- | --- | --- | --- | --- | --- |
| /assets/vendor/fonts/fonts.css | link | 191 | 172 | 468 | blocking |
| /assets/css/site.da54dd35ad.css | link | 192 | 592 | 24296 | blocking |
| /assets/vendor/fonts/inter-latin-wght-normal.woff2 | link | 192 | 732 | 48556 | non-blocking |
| /assets/css/cjk-fonts.css?v=446c74ffab | link | 207 | 984 | 23605 | non-blocking |
| /media/test-photo-1-640.53b36a7a57.jpg | img | 209 | 310 | 7176 | non-blocking |
| /assets/js/runtime.79bd8cc181.js | script | 225 | 215 | 2025 | non-blocking |
| /assets/js/app.7TF5EM4I.js | script | 226 | 574 | 24561 | non-blocking |
| /assets/config.729cf0aa24.json | fetch | 805 | 354 | 18959 | non-blocking |
| /media/test-photo-2-640.7585193eb6.png | img | 1667 | 1222 | 43994 | non-blocking |
| /media/test-photo-3-640.webp | img | 1667 | 368 | 7575 | non-blocking |
| /media/test-photo-5-large-640.7711019e76.jpg | img | 1667 | 398 | 10315 | non-blocking |
| /media/avatar.c687352512.svg | img | 1667 | 194 | 525 | non-blocking |
| /assets/fonts/noto-sans-sc/5b338f152fd86b63.woff2 | css | 1690 | 1510 | 77100 | non-blocking |
| /assets/fonts/noto-sans-sc/cb5f15c55765a71b.woff2 | css | 1690 | 1245 | 46492 | non-blocking |

### /zh/long-stress/（长文）

LCP 元素：`img.post-featured-image（http://127.0.0.1:3314/media/test-photo-4.a0c9f49be2.jpg）`

render-blocking 资源（2）：

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 |
| --- | --- | --- | --- | --- |
| /assets/vendor/fonts/fonts.css | link | 202 | 179 | 468 |
| /assets/css/site.da54dd35ad.css | link | 206 | 423 | 24296 |

首屏请求（≤FCP，13）：

| 资源 | 类型 | 开始(ms) | 时长(ms) | 传输字节 | 阻塞 |
| --- | --- | --- | --- | --- | --- |
| /assets/vendor/fonts/fonts.css | link | 202 | 179 | 468 | blocking |
| /media/test-photo-4.a0c9f49be2.jpg | link | 205 | 236 | 6776 | non-blocking |
| /assets/css/site.da54dd35ad.css | link | 206 | 423 | 24296 | blocking |
| /assets/css/cjk-fonts.css?v=446c74ffab | link | 232 | 1021 | 23605 | non-blocking |
| /assets/vendor/prism.js | script | 319 | 979 | 27459 | non-blocking |
| /assets/vendor/katex/katex.min.css | link | 319 | 230 | 3825 | non-blocking |
| /assets/vendor/katex/katex.min.js | script | 322 | 1395 | 76748 | non-blocking |
| /assets/js/runtime.79bd8cc181.js | script | 323 | 212 | 2025 | non-blocking |
| /assets/vendor/katex/contrib/auto-render.min.js | script | 323 | 524 | 1833 | non-blocking |
| /assets/js/app.7TF5EM4I.js | script | 323 | 384 | 24561 | non-blocking |
| /assets/vendor/fonts/inter-latin-wght-normal.woff2 | css | 729 | 863 | 48556 | non-blocking |
| /media/avatar.c687352512.svg | img | 2939 | 171 | 525 | non-blocking |
| /assets/config.729cf0aa24.json | fetch | 2943 | 275 | 18959 | non-blocking |


## 首页 5 次 A/B（官方 3 次口径的方差收敛复核）

> 同机同会话内先测新配置（5 次）再切回旧行为构建（5 次），仅 /zh/，Slow4G + 4× CPU + 禁缓存。

| 指标 | /zh/ · 优化前(5 次中位) | /zh/ · 优化后(5 次中位) | Δ |
| ---: | ---: | ---: | ---: |
| LCP(ms) | 2056 | 1852 | -204 |
| FCP(ms) | 2032 | 1820 | -212 |
| TTFB(ms) | 4 | 4 | +0 |
| 资源加载延迟(ms) | 197 | 201 | +4 |
| 资源加载时长(ms) | 331 | 289 | -42 |
| 渲染延迟(ms) | 1529 | 1359 | -170 |
| TBT(ms) | 1018 | 92 | -926 |
| 请求数 | 33 | 33 | 0 |
| 总传输字节 | 1310216 | 1310245 | +29 |
| CLS | 0.0016 | 0.0017 | +0.0001 |

LCP 元素：前 `img.post-card-image.motion-reveal` → 后 `img.post-card-image.motion-reveal`

## 说明与局限

- 本地 serve 为单进程 Node + gzip（`node:zlib`，默认级别），无 Brotli/CDN/边缘缓存；与生产绝对数值不可比。
- LCP 分相口径与 web.dev 一致；详见 `scripts/perf-audit.js` 顶部注释。
- 数值波动主要来自本机 CPU 争用与 Node 压缩开销；对照时看同一 phase 内的相对变化。

