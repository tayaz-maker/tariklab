import {inspect} from 'node:util';

// Playwright 1.62.1 Chromium _onLoadingFinished sets body=encodedDataLength-headers.
// Its public sizes schema omits transferSize; the sum preserves the reported total.
export function responseTransferBytes(sizes) {
  const raw = {
    requestBodySize: sizes?.requestBodySize,
    requestHeadersSize: sizes?.requestHeadersSize,
    responseHeadersSize: sizes?.responseHeadersSize,
    responseBodySize: sizes?.responseBodySize,
  };
  const {responseHeadersSize: headers, responseBodySize: body} = raw;
  const validFields = Number.isSafeInteger(headers) && Number.isSafeInteger(body);
  const total = validFields ? headers + body : NaN;
  if (!validFields || headers < 0 || !Number.isSafeInteger(total) || total < 0) {
    throw new Error(`Invalid response sizes: ${inspect(raw)}`);
  }
  return total;
}
