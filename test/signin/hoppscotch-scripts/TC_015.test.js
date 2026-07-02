// Auto-generated post-request tests for TC_015
function responseJson() {
  try {
    var body = pw.response.body;
    if (typeof body === 'string') return JSON.parse(body);
    return body || {};
  } catch (e) { return {}; }
}
function responseToken(body) {
  if (!body || typeof body !== 'object') return null;
  var token = body.accessToken || body.token || body.access_token;
  if (body.data && typeof body.data === 'object') {
    token = token || body.data.accessToken || body.data.token || body.data.access_token;
  }
  return token;
}
function responseError(body) {
  if (!body || typeof body !== 'object') return '';
  var msg = body.message || body.error || '';
  if (Array.isArray(body.errors) && body.errors.length) {
    msg = body.errors.map(function (e) { return String(e); }).join('; ');
  }
  return String(msg);
}

pw.test("TC_015: Valid login after fix - HTTP status", function () {
  var allowed = [200, 201];
  var ok = allowed.indexOf(pw.response.status) !== -1;
  pw.expect(ok).toBe(true);
});

pw.test("TC_015: Valid login after fix - access token present", function () {
  var token = responseToken(responseJson());
  var ok = typeof token === 'string' && token.trim().length > 0;
  pw.expect(ok).toBe(true);
});

pw.test("TC_015: Valid login after fix - response time under 30s", function () {
  var rt = pw.response.responseTime || pw.response.time || pw.response.elapsedTime || 0;
  var ok = typeof rt === 'number' && rt >= 0 && rt < 30000;
  pw.expect(ok).toBe(true);
});