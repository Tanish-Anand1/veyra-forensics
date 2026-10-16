const excluded =
  /(?:^|\/)(?:node_modules|dist|artifacts|output|tmp|test-results|playwright-report|\.vercel|\.impeccable|__pycache__)(?:\/|$)|(?:^|\/)\.env(?:\..*)?$|\.(?:log|pem|p12|pfx|key|pyc)$/i;
const credentials =
  /(?:sk-(?:proj-)?[A-Za-z0-9_-]{30,}|GOCSPX-[A-Za-z0-9_-]{20,}|apify_api_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@)/;

export function checkSourceFile(path, bytes) {
  const normalized = path.replaceAll("\\", "/");
  if (normalized !== ".env.example" && excluded.test(normalized))
    throw new Error(`Private or generated file excluded: ${normalized}`);
  if (credentials.test(bytes.toString("utf8")))
    throw new Error(`Credential pattern detected in ${normalized}`);
}
