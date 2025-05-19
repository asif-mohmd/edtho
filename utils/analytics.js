const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

/**
 * Parse user agent string to get browser, OS, and device information
 * @param {string} userAgent - The user agent string
 * @returns {Object} Parsed user agent information
 */
function parseUserAgent(userAgent) {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  return {
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown',
    device: result.device.type || 'Desktop'
  };
}

/**
 * Get location information from IP address
 * @param {string} ip - The IP address
 * @returns {Object} Location information
 */
function getLocationFromIP(ip) {
  // Handle localhost and private IPs
  if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return {
      country: 'Local',
      city: 'Local',
      region: 'Local'
    };
  }

  const geo = geoip.lookup(ip);
  if (!geo) {
    return {
      country: 'Unknown',
      city: 'Unknown',
      region: 'Unknown'
    };
  }

  return {
    country: geo.country || 'Unknown',
    city: geo.city || 'Unknown',
    region: geo.region || 'Unknown'
  };
}

/**
 * Get client information from request
 * @param {Object} req - Express request object
 * @returns {Object} Client information
 */
function getClientInfo(req) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const location = getLocationFromIP(ip);
  const deviceInfo = parseUserAgent(userAgent);

  return {
    ip,
    ...location,
    userAgent,
    ...deviceInfo
  };
}

module.exports = {
  getClientInfo
}; 