import Issue from '../models/Issue.js';

// Haversine distance in meters between two lat/lng coordinates
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371e3; // Earth radius in meters
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Tokenize and calculate Jaccard similarity between two texts
function calculateTextSimilarity(text1 = '', text2 = '') {
  const getTokens = str => new Set(
    str.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );

  const setA = getTokens(text1);
  const setB = getTokens(text2);
  if (!setA.size || !setB.size) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : Number((intersection / union).toFixed(2));
}

// Rule-based classification engine
const KEYWORDS = {
  Garbage: ['garbage', 'trash', 'waste', 'dump', 'bin', 'litter', 'plastic', 'debris', 'overflow', 'refuse', 'sweeping'],
  Water: ['water', 'pipe', 'leak', 'burst', 'tap', 'supply', 'contamination', 'drinking', 'pressure', 'tank', 'pipeline'],
  Roads: ['road', 'pothole', 'asphalt', 'tar', 'crack', 'street', 'pavement', 'footpath', 'divider', 'sidewalk', 'speedbreaker'],
  Streetlights: ['streetlight', 'light', 'pole', 'lamp', 'dark', 'bulb', 'flickering', 'sodium', 'cfl', 'led', 'wire hanging'],
  Drainage: ['drain', 'clog', 'sewage', 'gutter', 'overflow', 'manhole', 'stagnant', 'culvert', 'stormwater', 'smell'],
  Sanitation: ['toilet', 'urinal', 'restroom', 'hygiene', 'cleaning', 'odor', 'stink', 'disinfection', 'mosquito', 'pest'],
  Electrical: ['electric', 'transformer', 'shock', 'short circuit', 'power cut', 'cable', 'high voltage', 'generator', 'panel'],
  Buildings: ['wall', 'ceiling', 'door', 'window', 'roof', 'lift', 'elevator', 'staircase', 'railing', 'structural', 'collapse']
};

const DEPARTMENTS = {
  Garbage: 'Sanitation',
  Sanitation: 'Sanitation',
  Water: 'Water & Sewage',
  Drainage: 'Water & Sewage',
  Roads: 'Roads & Infrastructure',
  Streetlights: 'Electrical',
  Electrical: 'Electrical',
  Buildings: 'Civil Maintenance',
  Other: 'General Services'
};

const CRITICAL_KEYWORDS = ['hazard', 'danger', 'shock', 'spark', 'collapse', 'flood', 'overflowing', 'toxic', 'emergency', 'casualty', 'fire', 'burst'];
const HIGH_KEYWORDS = ['broken', 'heavy', 'urgent', 'blocked', 'contaminated', 'unsafe', 'major', 'severe'];

export async function analyzeComplaint({ title = '', description = '', category = '', location = null, tenantId }) {
  const combinedText = `${title} ${description}`.toLowerCase();

  let detectedCategory = category || 'Other';
  let categoryScores = {};

  for (const [cat, words] of Object.entries(KEYWORDS)) {
    let score = 0;
    for (const w of words) {
      if (combinedText.includes(w)) score += 1;
    }
    categoryScores[cat] = score;
  }

  // Find highest scoring category
  const sortedCategories = Object.entries(categoryScores).sort((a, b) => b[1] - a[1]);
  if (sortedCategories[0] && sortedCategories[0][1] > 0) {
    detectedCategory = sortedCategories[0][0];
  }

  // Determine suggested priority
  let detectedPriority = 'medium';
  if (CRITICAL_KEYWORDS.some(k => combinedText.includes(k))) {
    detectedPriority = 'urgent';
  } else if (HIGH_KEYWORDS.some(k => combinedText.includes(k))) {
    detectedPriority = 'high';
  } else if (combinedText.length < 30) {
    detectedPriority = 'low';
  }

  // Determine department
  const detectedDepartment = DEPARTMENTS[detectedCategory] || 'General Services';

  // Generate concise summary
  const summary = title.length > 10
    ? title
    : description.slice(0, 100).replace(/\n/g, ' ') + (description.length > 100 ? '…' : '');

  // Check for potential duplicate complaints in this tenant within last 30 days
  let duplicateRisk = 'none';
  let potentialDuplicateOf = null;
  let similarityScore = 0;
  let distanceMeters = null;

  if (tenantId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentIssues = await Issue.find({
      tenantId,
      createdAt: { $gte: thirtyDaysAgo },
      status: { $in: ['submitted', 'assigned', 'in_progress'] }
    }).select('_id title description location category priority ticketNumber createdAt').limit(50);

    for (const past of recentIssues) {
      const pastText = `${past.title} ${past.description}`;
      const sim = calculateTextSimilarity(combinedText, pastText);

      let dist = null;
      if (location?.lat && location?.lng && past.location?.lat && past.location?.lng) {
        dist = calculateDistanceMeters(location.lat, location.lng, past.location.lat, past.location.lng);
      }

      // Check duplicate condition:
      // High text similarity (> 0.45) OR close location (< 120 meters with moderate text similarity > 0.25)
      const isGeographicMatch = dist !== null && dist <= 120 && (sim > 0.25 || past.category === detectedCategory);
      const isTextMatch = sim > 0.55;

      if (isGeographicMatch || isTextMatch) {
        duplicateRisk = (dist !== null && dist <= 50 && sim > 0.4) ? 'high' : 'medium';
        potentialDuplicateOf = past._id;
        similarityScore = sim;
        distanceMeters = dist;
        break;
      }
    }
  }

  return {
    provider: 'rules-engine',
    suggestedCategory: detectedCategory,
    suggestedPriority: detectedPriority,
    suggestedDepartment: detectedDepartment,
    summary,
    confidence: sortedCategories[0]?.[1] > 0 ? 0.88 : 0.65,
    duplicateRisk,
    potentialDuplicateOf,
    similarityScore,
    distanceMeters
  };
}
