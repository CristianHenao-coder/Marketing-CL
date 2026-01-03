export function errorHandlerMiddleware(err, req, res, next) {
  console.error("❌ Error:", err);

  const status = err?.statusCode || 500;
  if (res.headersSent) return next(err);

  res.status(status).send("Internal Server Error");
}
