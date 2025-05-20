/**
 * Get client information from request
 * @param {Object} req - Express request object
 * @returns {Object} Client information
 */function getClientInfo(req) {
  const userAgent = req.headers["user-agent"] || "";
  let deviceType = "unknown";
  
  if (/mobile/i.test(userAgent)) {
    deviceType = "mobile";
  } else if (/tablet/i.test(userAgent)) {
    deviceType = "tablet";
  } else if (userAgent) {
    deviceType = "desktop";
  }

  // Accept-Language header, fallback to unknown
  const language = req.headers["accept-language"]?.split(",")[0] || "unknown";

  return {
    deviceType,
    language,
  };
}

module.exports = { getClientInfo };
