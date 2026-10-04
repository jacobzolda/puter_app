// container health check: exit 0 if the API answers, 1 if it does not
const port = process.env.PORT || 3001;
fetch(`http://127.0.0.1:${port}/api/health`)
  .then((res) => process.exit(res.ok ? 0 : 1))
  .catch(() => process.exit(1));