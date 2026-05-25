const express = require('express');
const {
    getProfileBySteamId,
    deleteProfileFromDb,
    getAllProfilesFromDb,
    deleteAllProfilesFromDb,
    fetchAndStoreFriends,
    getLocalProfile,
    getProfileFriends,
    getProfilesWithInventoryErrors,
    updateProfileNotes
} = require('../controllers/profileController');

const cs2InventoryRoutes = require('./cs2InventoryRoutes');

const router = express.Router();

// Route to fetch profile, check cache first then Steam API
router.get('/fetch/:identifier', getProfileBySteamId);

// Route to get all profiles from the local database (with sorting query params)
// *MUST* be defined before /local/:steamId to avoid capturing 'all' as steamId
router.get('/local/all', getAllProfilesFromDb);

// OPTIONS handler for local/all endpoint (CORS preflight)
router.options('/local/all', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Route to get profiles with inventory errors
// Changed from GET to POST to accept a list of SteamIDs in the body
router.post('/with-inventory-errors', getProfilesWithInventoryErrors);

// Route to delete ALL profiles from the local database
// *MUST* be defined before /local/:steamId for the same reason
router.delete('/local/all', deleteAllProfilesFromDb);

// Route to get profile directly from the local database
router.get('/local/:steamId', getLocalProfile);

// Route to update profile notes
router.put('/local/:steamId', updateProfileNotes);

// Route to delete profile from the local database
router.delete('/local/:steamId', deleteProfileFromDb);

// New route for getting cached friends of a profile
// IMPORTANT: Must be defined BEFORE the more generic /friends/:steamId route
router.get('/friends/list/:steamId', getProfileFriends);

// OPTIONS handler for friends list endpoint (CORS preflight)
router.options('/friends/list/:steamId', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Route for checking friend fetch status
router.get('/friends/status/:steamId', (req, res) => {
  const { steamId } = req.params;
  const webSocketService = require('../services/WebSocketService');
  
  const fetchProgress = webSocketService.getFriendFetchProgress(steamId);
  
  if (!fetchProgress) {
    return res.status(404).json({ 
      success: false, 
      message: 'No friend fetch status found for this steamId',
      data: null 
    });
  }
  
  return res.status(200).json({
    success: true,
    data: fetchProgress,
    message: `Friend fetch status for ${steamId}`
  });
});

// Route for fetching/storing friends (processing friends from Steam API)
// This must be defined AFTER more specific /friends/... routes
router.get('/friends/:steamId', fetchAndStoreFriends);

router.use(cs2InventoryRoutes);

module.exports = router;
